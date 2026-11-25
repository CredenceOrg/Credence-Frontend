import { useCallback, useEffect, useRef, useState } from 'react'
import './ThemeToggle.css'
import { THEME_CHANNEL_EVENT, getNextTheme, type Theme } from '../lib/themeCycle'

const THEME_STORAGE_KEY = 'theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export type { Theme }

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
  // SettingsProvider migrates the legacy key before the header mounts. Prefer
  // the canonical record so the toggle cannot overwrite the saved theme when
  // the lazy-loaded layout mounts after the provider's theme effect.
  try {
    const saved = JSON.parse(window.localStorage.getItem('credence:settings') ?? 'null')
    if (isValidTheme(saved?.themeMode)) return saved.themeMode
    if (saved?.themeMode === 'system') return readOSPreference()
  } catch {
    // Corrupt or unavailable settings must not prevent the legacy/OS fallback.
  }
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
      <path d="M12.03 2.26a.75.75 0 0 0-1.06.92 6 6 0 0 1 7.5 7.5.75.75 0 0 0 .92-1.06 7.5 7.5 0 0 0-7.36-7.36zM7.47 3.7A7 7 0 1 0 16.3 12.53a5.5 5.5 0 1 1-8.83-8.83z" />
    </svg>
  )
}

/** The OS media query that carries the dark-mode preference. */
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

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

  const toggleTheme = () => {
    hasExplicitChoice.current = true
    commitTheme(getNextTheme(theme))
  }

  const nextTheme = getNextTheme(theme)

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setThemeMode(nextTheme)}
      aria-label="Toggle theme"
      aria-pressed={resolved === 'dark'}
      title={`Switch to ${nextTheme} theme`}
      data-theme-source={themeSource}
    >
      {resolved === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
