import { useCallback, useEffect, useRef, useState } from 'react'
import './ThemeToggle.css'
import { useSettings } from '../context/SettingsContext'
import { logWarn } from '../lib/log'

const THEME_STORAGE_KEY = 'theme'
const THEME_CHANNEL_EVENT = 'theme-change'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export type Theme = 'light' | 'dark'

function isValidTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/**
 * Safely read the persisted theme.
 *
 * Invariants:
 * - Never throws. Storage may be disabled (private mode, SecurityError,
 *   QuotaExceededError, etc.) or contain arbitrary corrupted data.
 * - Returns `undefined` for any value that is not exactly 'light' | 'dark'.
 *   Corrupt / injected values are never propagated into the DOM or state.
 */
export function readPersistedTheme(): Theme | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isValidTheme(saved) ? saved : undefined
  } catch {
    return undefined
  }
}

/**
 * Safely persist the theme. Failures are swallowed so a quota/security
 * error never breaks the toggle or loses the in-memory state.
 */
export function persistTheme(theme: Theme): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Persistence is best-effort; the in-memory theme remains authoritative.
  }
}

function readOSPreference(): Theme {
  if (typeof window === 'undefined') return 'light'
  try {
    if (typeof window.matchMedia !== 'function') return 'light'
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function resolveTheme(): Theme {
  return readPersistedTheme() ?? readOSPreference()
}
function SunIcon() {
  return (
    <svg
      className="theme-toggle__icon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1.75v2.5" />
      <path d="M10 15.75v2.5" />
      <path d="M1.75 10h2.5" />
      <path d="M15.75 10h2.5" />
      <path d="M4.75 4.75l1.75 1.75" />
      <path d="M13.5 13.5l1.75 1.75" />
      <path d="M4.75 15.25l1.75-1.75" />
      <path d="M13.5 6.5l1.75-1.75" />
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg className="theme-toggle__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M12.03 2.26a.75.75 0 0 0-1.06.92 6 6 0 0 1 7.5 7.5.75.75 0 0 0 .92-1.06 7.5 7.5 0 0 0-7.36-7.36zM7.47 3.7a7 7 0 1 0 8.83 8.83a5.5 5.5 0 1 1-8.83-8.83z" />
    </svg>
  )
}

/**
 * Deterministic failure-boundary wrapper for the theme toggle.
 *
 * Invariants:
 * - The toggle must never crash the surrounding tree. If any unknown failure
 *   occurs during render (or a child renderer), we degrade to a static
 *   fallback button that preserves the accessible name and remains clickable
 *   so the user can recover without losing their session.
 * - The fallback is pure and side-effect free: it never touches localStorage,
 *   the DOM, or the event bus, so it cannot introduce inconsistent state.
 */
class ThemeToggleErrorBoundary extends React.Component<{ children?: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    // Observability: log the failure without exposing sensitive data.
    // The toggle never receives user PII, so the message is safe to surface.
    // eslint-disable-next-line no-console
    console.error('ThemeToggle failed to render; falling back to a safe toggle.', error)
  }

  render() {
    if (this.state.failed) {
      return (
        <button
          type="button"
          className="theme-toggle"
          aria-label="Toggle theme"
          aria-pressed="false"
          title="Switch to dark theme"
        >
          <MoonIcon />
        </button>
      )
    }
    return this.props.children ?? null
  }
}

export default function ThemeToggle() {
  return (
    <ThemeToggleErrorBoundary>
      <ThemeToggleInner />
    </ThemeToggleErrorBoundary>
  )
}

function ThemeToggleInner() {
  const [theme, setTheme] = useState<Theme>(resolveTheme)
  // Tracks whether the user has explicitly chosen a theme during this mount.
  // While false, OS preference changes are honored; once true, they are ignored
  // so an explicit choice is never silently overwritten.
  const hasExplicitChoice = useRef(false)
  // Guards against out-of-order / duplicate async writes from a rapid
  // succession of toggles or OS events: only the latest commit is applied.
  const writeGeneration = useRef(0)

/**
 * Maximum number of subscription attempts (1 initial + bounded retries) made
 * per mount before the toggle gives up and keeps its last known value.
 * Exported so the bound is a testable invariant rather than a magic number.
 */
export const SUBSCRIBE_MAX_ATTEMPTS = 3

/** Base delay for the linear retry backoff: 250ms, then 500ms. */
const SUBSCRIBE_RETRY_DELAY_MS = 250

/**
 * Failure classes for the system color-scheme read/subscription.
 *
 * These are stable, non-sensitive strings: a diagnostic line names only the
 * class of failure, never an error message, user value, or environment detail.
 */
export type SystemPrefersDarkFailure =
  /** SSR / no DOM: `window` is undefined. */
  | 'window-unavailable'
  /** `window.matchMedia` is missing or not callable (older/locked-down UA). */
  | 'match-media-unavailable'
  /** Constructing the media query list threw (e.g. a hostile/odd UA). */
  | 'match-media-threw'
  /** `matchMedia` returned a non-object (`null`, `undefined`, primitive). */
  | 'invalid-media-query-list'
  /** Reading `.matches` threw (getter side effect / revoked proxy). */
  | 'matches-threw'
  /** `.matches` was not a strict boolean; the value cannot be trusted. */
  | 'matches-not-boolean'
  /** The `MediaQueryList` exposes no change-listener API at all. */
  | 'subscribe-unavailable'
  /** Registering the change listener threw. */
  | 'subscribe-threw'
  /** Removing the change listener threw (cleanup still completes). */
  | 'unsubscribe-threw'
  /** A consumer listener threw; the event was contained, not rethrown. */
  | 'listener-threw'

/** Result of one system-preference read, including how the value was obtained. */
export interface SystemPrefersDarkReading {
  /** Always a strict boolean — never `undefined`, `null`, or a truthy object. */
  prefersDark: boolean
  /**
   * `'media'` when the value came from a live `matchMedia` read;
   * `'fallback'` when every read path failed and the safe default was used.
   */
  source: 'media' | 'fallback'
  /** Present only when `source === 'fallback'`. */
  failure?: SystemPrefersDarkFailure
}

/** Failure classes already reported once this session (dedupe log spam). */
const reportedFailures = new Set<SystemPrefersDarkFailure>()

/**
 * Emits one structured, data-free diagnostic per failure class.
 *
 * Invariant: this never throws and never carries anything but the failure
 * class, so a broken environment cannot turn diagnostics into a second
 * failure or leak sensitive material into logs.
 */
function reportFailure(failure: SystemPrefersDarkFailure): void {
  if (reportedFailures.has(failure)) return
  reportedFailures.add(failure)
  logWarn('theme_system_preference_unavailable', { failure })
}

/**
 * Clears the diagnostic de-duplication cache.
 * Test/teardown hook only — production code never needs it.
 */
export function resetSystemPrefersDarkDiagnostics(): void {
  reportedFailures.clear()
}

function fallbackReading(failure: SystemPrefersDarkFailure): SystemPrefersDarkReading {
  reportFailure(failure)
  return { prefersDark: false, source: 'fallback', failure }
}

/**
 * Reads the OS `prefers-color-scheme: dark` preference with full failure
 * boundaries, returning enough context to diagnose which boundary was hit.
 *
 * Invariants (see {@link getSystemPrefersDark} for the caller-facing summary):
 * - **Never throws**, whatever the environment does.
 * - **Pure read**: it mutates no state (the only side effect is a once-per-
 *   class diagnostic), so duplicate and concurrent calls are idempotent and
 *   always agree for a given environment state.
 * - **Strict boolean**: only `matches === true` means dark. A truthy
 *   non-boolean (`'true'`, `1`, an object) is treated as *unreadable*, not as
 *   dark, so a malformed environment can never silently flip the theme.
 * - **Safe default**: every failure resolves to light (`false`), the same
 *   default used for SSR — and never to a persisted user value, so a failing
 *   read can never override an explicitly chosen theme.
 */
export function readSystemPrefersDark(): SystemPrefersDarkReading {
  if (typeof window === 'undefined') return fallbackReading('window-unavailable')
  if (typeof window.matchMedia !== 'function') return fallbackReading('match-media-unavailable')

  let mql: MediaQueryList
  try {
    mql = window.matchMedia(SYSTEM_DARK_QUERY) as MediaQueryList
  } catch {
    return fallbackReading('match-media-threw')
  }
  if (!mql || typeof mql !== 'object') return fallbackReading('invalid-media-query-list')

  let matches: unknown
  try {
    matches = mql.matches
  } catch {
    return fallbackReading('matches-threw')
  }
  if (typeof matches !== 'boolean') return fallbackReading('matches-not-boolean')

  return { prefersDark: matches, source: 'media' }
}

/**
 * SSR-safe read of the OS-level `prefers-color-scheme: dark` preference.
 *
 * ## Invariants
 *
 * 1. **Total function** — returns a strict `boolean` and *never* throws:
 *    missing `window` (SSR), missing/non-function `window.matchMedia`, a
 *    throwing `matchMedia`, a non-object `MediaQueryList`, a throwing or
 *    non-boolean `.matches` all resolve to `false` (the light fallback).
 * 2. **Deterministic** — a pure read of current environment state: the same
 *    environment yields the same answer on duplicate or concurrent calls, and
 *    the function never mutates app state (so retries cannot race).
 * 3. **Non-destructive fallback** — the fallback is always `'light'`. It never
 *    writes storage and never supersedes an explicitly persisted `themeMode`,
 *    so a failed read cannot lose or override the user's saved preference.
 * 4. **Diagnosable, not noisy** — each failure class is reported once per
 *    session through `src/lib/log.ts` with only the failure class, no message
 *    body, user value, or environment detail.
 */
export function getSystemPrefersDark(): boolean {
  return readSystemPrefersDark().prefersDark
}

/** Listener invoked with a strictly-validated system preference. */
export type SystemPrefersDarkListener = (prefersDark: boolean) => void

/** Handle for a system-preference change subscription. */
export interface SystemPrefersDarkSubscription {
  /**
   * `true` only when a change listener is actually registered. A `false`
   * subscription is a *retryable* failure: the caller keeps its last known
   * value and may call the subscribe function again.
   */
  readonly active: boolean
  /** Idempotent: safe to call twice, from cleanup paths, or when inactive. */
  unsubscribe: () => void
}

function inactiveSubscription(failure: SystemPrefersDarkFailure): SystemPrefersDarkSubscription {
  reportFailure(failure)
  return { active: false, unsubscribe: () => {} }
}

/**
 * Subscribes to OS `prefers-color-scheme` changes.
 *
 * Failure boundaries:
 * - Never throws. When the environment cannot support a subscription the
 *   handle comes back with `active: false` (plus a deduped diagnostic) so the
 *   caller can retry instead of crashing.
 * - Falls back to the deprecated `addListener`/`removeListener` pair when the
 *   modern `addEventListener` API is unavailable.
 * - **Stale/invalid payloads are dropped**: an event whose `matches` is not a
 *   strict boolean is ignored (keeping the last known good value) rather than
 *   coerced, so a malformed dispatch cannot flip the theme.
 * - A throwing consumer listener is contained (`listener-threw`) and does not
 *   break the browser's dispatch loop or later events.
 */
export function subscribeSystemPrefersDark(
  listener: SystemPrefersDarkListener
): SystemPrefersDarkSubscription {
  if (typeof window === 'undefined') return inactiveSubscription('window-unavailable')
  if (typeof window.matchMedia !== 'function') {
    return inactiveSubscription('match-media-unavailable')
  }

  let mql: MediaQueryList
  try {
    mql = window.matchMedia(SYSTEM_DARK_QUERY) as MediaQueryList
  } catch {
    return inactiveSubscription('match-media-threw')
  }
  if (!mql || typeof mql !== 'object') return inactiveSubscription('invalid-media-query-list')

  const handler = (event: MediaQueryListEvent) => {
    const matches: unknown = event?.matches
    if (typeof matches !== 'boolean') {
      reportFailure('matches-not-boolean')
      return
    }
    try {
      listener(matches)
    } catch {
      reportFailure('listener-threw')
    }
  }

  // Tracks which API registered the handler so removal uses the matching one
  // (mixing the modern and legacy pairs is undefined behaviour in some UAs).
  let registration: 'modern' | 'legacy' | null = null

  let detached = false
  const unsubscribe = () => {
    if (detached) return
    detached = true
    try {
      if (registration === 'modern' && typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handler)
      } else if (registration === 'legacy' && typeof mql.removeListener === 'function') {
        mql.removeListener(handler)
      }
    } catch {
      reportFailure('unsubscribe-threw')
    }
  }

  try {
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler)
      registration = 'modern'
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(handler)
      registration = 'legacy'
    } else {
      return inactiveSubscription('subscribe-unavailable')
    }
  } catch {
    return inactiveSubscription('subscribe-threw')
  }

  return { active: true, unsubscribe }
}

function sameReading(a: SystemPrefersDarkReading, b: SystemPrefersDarkReading): boolean {
  return a.prefersDark === b.prefersDark && a.source === b.source && a.failure === b.failure
}

/**
 * Live system preference with a bounded-retry subscription.
 *
 * State transitions: `media` (healthy) → on failure → `fallback` (last good
 * value retained, retrying up to {@link SUBSCRIBE_MAX_ATTEMPTS} times with a
 * linear backoff) → `media` again when the environment recovers. The value is
 * never cleared on failure, so a retry storm can never blank the toggle or
 * lose the user's visible state.
 */
function useSystemPrefersDark(): { reading: SystemPrefersDarkReading; resync: () => void } {
  const [reading, setReading] = useState<SystemPrefersDarkReading>(() => readSystemPrefersDark())
  const attachRef = useRef<() => void>(() => {})

  useEffect(() => {
    let disposed = false
    let subscription: SystemPrefersDarkSubscription | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    const apply = (next: SystemPrefersDarkReading) => {
      if (disposed) return
      setReading((prev) => (sameReading(prev, next) ? prev : next))
    }

    /** Re-read now; a recovered environment is picked up immediately. */
    const sync = () => apply(readSystemPrefersDark())

    /**
     * Idempotent while a subscription is live (it just re-syncs), and the one
     * entry point for (re)attaching — so retries and manual resyncs share the
     * same attempt budget and can never spawn overlapping subscriptions.
     */
    const attach = () => {
      if (disposed) return
      if (subscription?.active) {
        sync()
        return
      }
      sync()
      attempts += 1
      const next = subscribeSystemPrefersDark((prefersDark) =>
        apply({ prefersDark, source: 'media' })
      )
      if (next.active) {
        subscription = next
        return
      }
      if (attempts >= SUBSCRIBE_MAX_ATTEMPTS) return
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        attach()
      }, SUBSCRIBE_RETRY_DELAY_MS * attempts)
    }

    attachRef.current = attach
    attach()

    return () => {
      disposed = true
      attachRef.current = () => {}
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer)
        retryTimer = undefined
      }
      subscription?.unsubscribe()
      subscription = null
    }
  }, [])

  const resync = useCallback(() => attachRef.current(), [])

  return { reading, resync }
}

/**
 * ThemeToggle — a single-icon button for flipping the app between light and
 * dark mode.
 *
 * ## Single source of truth
 *
 * The displayed state is derived *entirely* from {@link useSettings}; this
 * component owns **no** theme state and writes to **no** storage key of its
 * own. `SettingsContext` is the sole owner of the theme (persisted under the
 * `credence:settings` key) and the sole writer of the document's
 * `data-theme` attribute. See `docs/dark-mode.md` for the model.
 *
 * The light/dark value shown is *resolved* from `themeMode`:
 * - `'light'` / `'dark'` resolve to themselves;
 * - `'system'` resolves via {@link getSystemPrefersDark}.
 *
 * ## Failure boundaries
 *
 * The `'system'` read is the only environmental dependency, and it is
 * non-fatal by construction (see {@link getSystemPrefersDark}): a failed read
 * or subscription keeps the last known value, retries a bounded number of
 * times, and reports a single structured diagnostic. The button stays
 * operable in every state — the user's explicit choice always wins and is
 * never lost to a failed read. `data-theme-source` exposes which path
 * produced the current value (`'explicit'`, `'system'`, `'fallback'`) so
 * failures are diagnosable from the DOM without opening the console.
 *
 * Clicking flips `themeMode` to the *explicit* opposite of the currently
 * resolved theme (e.g. resolved-dark → `'light'`), never back to `'system'`.
 */
export default function ThemeToggle() {
  const { themeMode, setThemeMode } = useSettings()
  const { reading, resync } = useSystemPrefersDark()

  // Re-read when themeMode changes (e.g. the user picks 'system' on the
  // Settings page) so an environment that recovered after the bounded retries
  // were exhausted is picked up without a page reload.
  const lastModeRef = useRef(themeMode)
  useEffect(() => {
    if (lastModeRef.current === themeMode) return
    lastModeRef.current = themeMode
    resync()
  }, [themeMode, resync])

  const resolved: 'light' | 'dark' =
    themeMode === 'system' ? (reading.prefersDark ? 'dark' : 'light') : themeMode
  const nextTheme = resolved === 'dark' ? 'light' : 'dark'
  const themeSource =
    themeMode !== 'system' ? 'explicit' : reading.source === 'media' ? 'system' : 'fallback'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} theme`}
    >
      {resolved === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
