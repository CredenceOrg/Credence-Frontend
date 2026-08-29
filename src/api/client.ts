import { emitWalletSessionEvent, generateCorrelationId } from '../lib/walletAudit'

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  /** Stable key for retrying one state-changing operation safely. */
  idempotencyKey?: string
  /**
   * When true, bypasses the client-side rate limiter for this call only.
   * Defaults to false. Intended for tests; production callers should never
   * need this.
   */
  skipRateLimit?: boolean
  /**
   * When provided, the request is only dispatched if the active identity
   * epoch matches this value at call time **and** when the response arrives.
   * A mismatch at either point causes the promise to reject with
   * {@link ApiSessionConflictError}, leaving no partial state.
   *
   * Pass the epoch obtained from {@link getIdentityEpoch} at the moment the
   * caller reads the identity it intends to act on. The client advances the
   * epoch automatically on every {@link setIdentityEpoch} call (disconnect,
   * reconnect, expiry).
   */
  identityEpoch?: number
}

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

/**
 * Thrown by `apiFetch` when the client-side rate limiter rejects a request.
 *
 * Extends `ApiError` with `status: 429` so existing handlers that only check
 * `err instanceof ApiError` keep working unchanged; code that wants to
 * specifically retry-after a cooldown can additionally narrow on this class
 * (or on `err.status === 429`).
 */
export class ApiRateLimitError extends ApiError {
  readonly retryAfterMs: number

  constructor(retryAfterMs: number, message = 'Too many requests', payload?: unknown) {
    super(429, message, payload)
    this.name = 'ApiRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Thrown by `apiFetch` when a session identity conflict is detected.
 *
 * ## When is this thrown?
 *
 * A conflict is detected in two places:
 *
 * 1. **Pre-flight** — the caller supplied an `identityEpoch` option and the
 *    active epoch has already advanced (disconnect / reconnect / expiry) before
 *    the request even hits the network. The request is never dispatched.
 *
 * 2. **Post-flight** — the epoch advanced *while* the request was in-flight
 *    (e.g. the user disconnected their wallet before the response arrived). The
 *    response is discarded and the promise rejects with this error. No partial
 *    state is committed.
 *
 * ## Extends ApiError
 *
 * `status` is `409` so that existing `err instanceof ApiError` handlers keep
 * working. Code that wants specific conflict handling can narrow on this class
 * or on `err.status === 409`.
 *
 * ## Retry contract
 *
 * **Do not retry automatically.** A conflict means the identity changed; the
 * correct recovery path is to check the current session state and, if the user
 * is still authenticated, re-acquire a fresh epoch via {@link getIdentityEpoch}
 * before re-issuing the request.
 */
export class ApiSessionConflictError extends ApiError {
  /** Epoch value at the time the request was created (now stale). */
  readonly staleEpoch: number
  /** Epoch value at the time the conflict was detected (current). */
  readonly currentEpoch: number

  constructor(staleEpoch: number, currentEpoch: number, message?: string) {
    super(
      409,
      message ??
        `Session identity changed during request (epoch ${staleEpoch} → ${currentEpoch}). Re-authenticate and retry.`,
      { staleEpoch, currentEpoch }
    )
    this.name = 'ApiSessionConflictError'
    this.staleEpoch = staleEpoch
    this.currentEpoch = currentEpoch
  }
}

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env

export const API_BASE_URL = normalizeBaseUrl(env?.VITE_API_BASE_URL || '/api')

type ReplayEntry = {
  fingerprint: string
  promise: Promise<unknown>
}

const replayEntries = new Map<string, ReplayEntry>()
/**
 * Process-wide default rate limiter consulted by `apiFetch`.
 *
 * Built once at module init from environment overrides on top of
 * {@link DEFAULT_API_RATE_LIMIT}. Exposed (read-only via {@link
 * apiRateLimiterSnapshot}) so tests can inspect current configuration and
 * tear down bucket state via {@link resetApiRateLimiter}.
 */
const rateLimitOverrides = readApiRateLimitOverrides({
  VITE_API_RATE_LIMIT_MAX: env?.VITE_API_RATE_LIMIT_MAX,
  VITE_API_RATE_LIMIT_WINDOW_MS: env?.VITE_API_RATE_LIMIT_WINDOW_MS,
  VITE_API_RATE_LIMIT_ENABLED: env?.VITE_API_RATE_LIMIT_ENABLED,
})

export const defaultApiRateLimiter = new ApiRateLimiter({
  maxRequests: rateLimitOverrides.maxRequests ?? DEFAULT_API_RATE_LIMIT.maxRequests,
  windowMs: rateLimitOverrides.windowMs ?? DEFAULT_API_RATE_LIMIT.windowMs,
  enabled: rateLimitOverrides.enabled ?? DEFAULT_API_RATE_LIMIT.enabled,
})

/**
 * Read-only snapshot of the active rate-limiter configuration.
 *
 * The returned object is deep-frozen at runtime — callers cannot mutate it
 * through the type system or at language level.
 */
export function apiRateLimiterSnapshot(): Readonly<{
  maxRequests: number
  windowMs: number
  enabled: boolean
}> {
  const cfg = defaultApiRateLimiter.config
  return Object.freeze({
    maxRequests: cfg.maxRequests,
    windowMs: cfg.windowMs,
    enabled: cfg.enabled,
  })
}

/**
 * Resets the process-wide default limiter to an empty window.
 *
 * Intended for tests that call `apiFetch` repeatedly and would otherwise
 * saturate the bucket. Not for production use.
 */
export function resetApiRateLimiter(): void {
  defaultApiRateLimiter.reset()
}

let _identityEpoch = 0

/** Returns the current identity epoch. */
export function getIdentityEpoch(): number {
  return _identityEpoch
}

/** Advances the identity epoch, or sets it explicitly when an epoch is given. */
export function setIdentityEpoch(epoch?: number): number {
  _identityEpoch = epoch ?? _identityEpoch + 1
  return _identityEpoch
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '/') {
    return ''
  }
  return trimmed.replace(/\/+$/, '')
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : '/' + path
  return '' + API_BASE_URL + normalizedPath
}

function isJsonBody(body: ApiFetchOptions['body']): body is Record<string, unknown> | unknown[] {
  const isReadableStream = typeof ReadableStream !== 'undefined' && body instanceof ReadableStream

  return (
    Boolean(body) &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(body) &&
    !(body instanceof URLSearchParams) &&
    !isReadableStream
  )
}

function buildHeaders(
  headers: HeadersInit | undefined,
  hasJsonBody: boolean,
  correlationId: string
): Headers {
  const nextHeaders = new Headers(headers)
  if (!nextHeaders.has('Accept')) {
    nextHeaders.set('Accept', 'application/json')
  }
  if (hasJsonBody && !nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json')
  }
  if (!nextHeaders.has('X-Correlation-ID')) {
    nextHeaders.set('X-Correlation-ID', correlationId)
  }
  return nextHeaders
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  return text || undefined
}

function errorMessage(status: number, payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message
  }
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }
  return 'Request failed with status ' + status
}

function requestFingerprint(
  url: string,
  init: RequestInit,
  serializedBody: BodyInit | undefined,
  headers: Headers
): string {
  const comparableHeaders: string[] = []
  headers.forEach((value, name) => {
    if (name !== 'idempotency-key' && name !== 'x-correlation-id') {
      comparableHeaders.push(`${name}:${value}`)
    }
  })

  return JSON.stringify([
    url,
    init.method || 'GET',
    comparableHeaders.join('\n'),
    serializedBody ?? null,
  ])
}

function replayConflict(key: string): ApiError {
  return new ApiError(
    409,
    `Idempotency key has already been used for a different operation: ${key}`,
    {
      code: 'idempotency_key_conflict',
    }
  )
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, idempotencyKey, identityEpoch, skipRateLimit = false, ...init } = options
  const hasJsonBody = isJsonBody(body)
  const serializedBody = hasJsonBody ? JSON.stringify(body) : (body ?? undefined)
  const method = init.method ?? 'GET'
  const requestHeaders = buildHeaders(headers, hasJsonBody, generateCorrelationId())
  const correlationId = requestHeaders.get('X-Correlation-ID') ?? ''
  const requestContext = {
    path,
    method,
    correlationId,
    skipRateLimit,
    identityEpoch,
  }

  if (idempotencyKey !== undefined) {
    const normalizedKey = idempotencyKey.trim()
    if (!normalizedKey) {
      throw new ApiError(400, 'Idempotency key must not be empty', {
        code: 'invalid_idempotency_key',
      })
    }

    const existing = replayEntries.get(normalizedKey)
    const url = buildUrl(path)
    const fingerprint = requestFingerprint(url, init, serializedBody, requestHeaders)

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw replayConflict(normalizedKey)
      }
      return existing.promise as Promise<T>
    }

    requestHeaders.set('Idempotency-Key', normalizedKey)
    const requestPromise = apiFetchWithoutReplay<T>(
      url,
      init,
      requestHeaders,
      serializedBody,
      requestContext
    )
    replayEntries.set(normalizedKey, { fingerprint, promise: requestPromise })
    requestPromise.catch(() => {
      if (replayEntries.get(normalizedKey)?.promise === requestPromise) {
        replayEntries.delete(normalizedKey)
      }
    })
    return requestPromise
  }

  return apiFetchWithoutReplay<T>(
    buildUrl(path),
    init,
    requestHeaders,
    serializedBody,
    requestContext
  )
}

async function apiFetchWithoutReplay<T>(
  url: string,
  init: RequestInit,
  headers: Headers,
  serializedBody: BodyInit | undefined,
  requestContext: {
    path: string
    method: string
    correlationId: string
    skipRateLimit: boolean
    identityEpoch?: number
  }
): Promise<T> {
  const { path, method, correlationId, skipRateLimit, identityEpoch } = requestContext

  // Rate-limit gate: cheap O(k) sliding-window check before paying the cost
  // of a fetch + DNS + TLS round-trip. When the bucket is empty we surface a
  // typed ApiRateLimitError instead of letting a runaway loop slam prod.
  if (!skipRateLimit) {
    const decision = defaultApiRateLimiter.acquire()
    if (!decision.allowed) {
      throw new ApiRateLimitError(
        decision.retryAfterMs,
        `Too many requests, retry in ${decision.retryAfterMs}ms`,
        { retryAfterMs: decision.retryAfterMs }
      )
    }
  }

  // Pre-flight identity epoch check.
  //
  // If the caller supplied an epoch, verify it against the current module-
  // level epoch before issuing the request. An epoch mismatch here means the
  // session already changed (disconnect / reconnect / expiry) before this
  // request even hit the network — reject immediately without dispatching.
  if (identityEpoch !== undefined && identityEpoch !== _identityEpoch) {
    throw new ApiSessionConflictError(
      identityEpoch,
      _identityEpoch,
      `Session identity changed before request was dispatched (epoch ${identityEpoch} → ${_identityEpoch}).`
    )
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers,
      body: serializedBody,
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      emitWalletSessionEvent('action_failed', {
        address: null,
        network: null,
        correlationId,
        metadata: { path, method, aborted: true },
      })
      throw error
    }
    const message = error instanceof Error ? error.message : 'Network request failed'
    emitWalletSessionEvent('action_failed', {
      address: null,
      network: null,
      correlationId,
      metadata: { path, method, status: 0, message },
    })
    throw new ApiError(0, message, error)
  }

  // Post-flight identity epoch check.
  //
  // The request was in-flight during an await. Check that the epoch has not
  // advanced since the pre-flight check. If it has, the response belongs to a
  // now-stale session and must be discarded. Reject with ApiSessionConflictError
  // so the caller can decide whether to re-authenticate and retry.
  if (identityEpoch !== undefined && identityEpoch !== _identityEpoch) {
    throw new ApiSessionConflictError(
      identityEpoch,
      _identityEpoch,
      `Session identity changed while request was in-flight (epoch ${identityEpoch} → ${_identityEpoch}). Response discarded.`
    )
  }

  const payload = await parseResponse(response)

  if (!response.ok) {
    const message = errorMessage(response.status, payload)
    emitWalletSessionEvent('action_failed', {
      address: null,
      network: null,
      correlationId,
      metadata: { path, method, status: response.status, message },
    })
    throw new ApiError(response.status, message, payload)
  }

  emitWalletSessionEvent('action_succeeded', {
    address: null,
    network: null,
    correlationId,
    metadata: { path, method, status: response.status },
  })

  return payload as T
}
