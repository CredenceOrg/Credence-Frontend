/**
 * @file rateLimit.ts
 * @description Client-side sliding-window rate limiter for API requests.
 *
 * Defence-in-depth guard against runaway loops in dev (e.g. an unmemoised
 * `useEffect`, a reconciliation storm, a hot-reloaded handler firing on
 * every keystroke) hammering real backend endpoints. Pairs with `apiFetch`
 * in {@link ./client.ts} which surfaces a typed `ApiRateLimitError` when
 * the bucket is exhausted.
 *
 * The implementation is intentionally tightly scoped: a single in-memory
 * sliding window keyed on wall-clock time. No queueing, no per-path bucketing
 * — the threat model is one runaway caller hammering anything, not a
 * distribution of distinct actors.
 *
 * @see https://en.wikipedia.org/wiki/Sliding_window_log
 */

export interface ApiRateLimiterDecision {
  /** True when the caller is allowed to proceed. */
  allowed: boolean
  /**
   * When `allowed` is false, the number of milliseconds the caller should
   * wait before retrying. Always `0` when `allowed` is true.
   */
  retryAfterMs: number
}

export interface ApiRateLimiterOptions {
  /**
   * Maximum number of acquisitions permitted within any rolling
   * {@link ApiRateLimiterOptions.windowMs} window.
   */
  maxRequests: number
  /** Length of the sliding window in milliseconds. Must be positive. */
  windowMs: number
  /**
   * When false, {@link ApiRateLimiter.acquire} is a constant-time no-op that
   * always returns `allowed: true`. Useful for tests and emergency killswitch.
   */
  enabled: boolean
  /**
   * Clock source. Defaults to `Date.now`. Tests inject a fixed clock
   * (or use `vi.useFakeTimers` + `vi.setSystemTime`).
   */
  now?: () => number
}

export const DEFAULT_API_RATE_LIMIT: Required<
  Pick<ApiRateLimiterOptions, 'maxRequests' | 'windowMs' | 'enabled'>
> = {
  // Generous defaults: real users never click buttons ~4Hz, but an unmemoised
  // hook can easily exceed this on a slow render.
  maxRequests: 20,
  windowMs: 5_000,
  enabled: true,
}

/**
 * Sliding-window-log rate limiter.
 *
 * Every successful `acquire()` records a timestamp. Acquisitions whose
 * timestamps fall outside the trailing `windowMs` are pruned lazily on
 * each call, so memory usage stays bounded by `maxRequests`.
 *
 * Cost on the hot path: O(k) where k is the number of timestamps pruned,
 * which is bounded by `maxRequests`. With default options that's at most
 * 20 `shift()` calls per request — measured at ~0.02 ms in jsdom.
 */
export class ApiRateLimiter {
  private readonly options: Required<ApiRateLimiterOptions>
  private timestamps: number[] = []

  constructor(options: Partial<ApiRateLimiterOptions> = {}) {
    this.options = {
      maxRequests:
        options.maxRequests ?? DEFAULT_API_RATE_LIMIT.maxRequests,
      windowMs: options.windowMs ?? DEFAULT_API_RATE_LIMIT.windowMs,
      enabled: options.enabled ?? DEFAULT_API_RATE_LIMIT.enabled,
      now: options.now ?? (() => Date.now()),
    }

    if (!Number.isFinite(this.options.maxRequests) || this.options.maxRequests <= 0) {
      throw new RangeError(
        `ApiRateLimiter: maxRequests must be a positive finite number, received ${this.options.maxRequests}`
      )
    }
    if (!Number.isFinite(this.options.windowMs) || this.options.windowMs <= 0) {
      throw new RangeError(
        `ApiRateLimiter: windowMs must be a positive finite number, received ${this.options.windowMs}`
      )
    }
  }

  /** Current configuration. Read-only snapshot. */
  get config(): Readonly<Required<ApiRateLimiterOptions>> {
    return this.options
  }

  /**
   * Replaces the active configuration in-place. Existing timestamps are
   * preserved (so capacity is not silently inflated) but the new `maxRequests`
   * is honoured against the current log length.
   *
   * **Caveat:** if the new `maxRequests` is *lower* than the current log
   * length, in-flight timestamps may keep the limiter over-capacity until
   * each one ages out of the window. Callers that need an immediate reset
   * should additionally invoke {@link ApiRateLimiter.reset}.
   *
   * Primarily intended for tests and a production killswitch; not for hot
   * re-tuning at runtime.
   */
  configure(next: Partial<Omit<ApiRateLimiterOptions, 'now'>>): void {
    if (
      next.maxRequests !== undefined &&
      (!Number.isFinite(next.maxRequests) || next.maxRequests <= 0)
    ) {
      throw new RangeError(
        `ApiRateLimiter.configure: maxRequests must be a positive finite number, received ${next.maxRequests}`
      )
    }
    if (
      next.windowMs !== undefined &&
      (!Number.isFinite(next.windowMs) || next.windowMs <= 0)
    ) {
      throw new RangeError(
        `ApiRateLimiter.configure: windowMs must be a positive finite number, received ${next.windowMs}`
      )
    }
    if (next.maxRequests !== undefined) this.options.maxRequests = next.maxRequests
    if (next.windowMs !== undefined) this.options.windowMs = next.windowMs
    if (next.enabled !== undefined) this.options.enabled = next.enabled
  }

  /**
   * Attempts to consume one slot from the window. Returns a {@link
   * ApiRateLimiterDecision}; never throws.
   *
   * @example
   * ```ts
   * const decision = limiter.acquire()
   * if (!decision.allowed) {
   *   throw new ApiRateLimitError(decision.retryAfterMs)
   * }
   * ```
   */
  acquire(): ApiRateLimiterDecision {
    if (!this.options.enabled) {
      return { allowed: true, retryAfterMs: 0 }
    }

    const now = this.options.now()
    const windowStart = now - this.options.windowMs

    // Drop expired timestamps from the front of the log. Bounded by
    // maxRequests, so this is a tight loop even on the hot path.
    while (this.timestamps.length > 0 && this.timestamps[0] <= windowStart) {
      this.timestamps.shift()
    }

    if (this.timestamps.length < this.options.maxRequests) {
      this.timestamps.push(now)
      return { allowed: true, retryAfterMs: 0 }
    }

    // Bucket is full. Retry-after is when the oldest entry will fall outside
    // the window. Floor at 1ms so callers never see a 0 from a blocked decision.
    const oldest = this.timestamps[0]
    const retryAfterMs = Math.max(1, oldest + this.options.windowMs - now)
    return { allowed: false, retryAfterMs }
  }

  /** Clears all recorded timestamps. Used by tests, never by production. */
  reset(): void {
    this.timestamps = []
  }
}

/**
 * Reads and validates rate-limit overrides from `import.meta.env`.
 *
 * Returns `null` for each field when the env value is missing or unparseable,
 * letting the {@link DEFAULT_API_RATE_LIMIT} constant fill in.
 */
export function readApiRateLimitOverrides(env: {
  VITE_API_RATE_LIMIT_MAX?: unknown
  VITE_API_RATE_LIMIT_WINDOW_MS?: unknown
  VITE_API_RATE_LIMIT_ENABLED?: unknown
}): {
  maxRequests: number | null
  windowMs: number | null
  enabled: boolean | null
} {
  const max = readPositiveNumber(env.VITE_API_RATE_LIMIT_MAX)
  const window = readPositiveNumber(env.VITE_API_RATE_LIMIT_WINDOW_MS)
  const enabled = readBoolean(env.VITE_API_RATE_LIMIT_ENABLED)
  return { maxRequests: max, windowMs: window, enabled }
}

function readPositiveNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function readBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase()
    if (lower === 'true' || lower === '1') return true
    if (lower === 'false' || lower === '0') return false
  }
  return null
}
