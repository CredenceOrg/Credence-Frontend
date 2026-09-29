import { useCallback, useEffect, useRef, useState } from 'react'
import './ThemeToggle.css'

const THEME_STORAGE_KEY = 'theme'
const THEME_CHANNEL_EVENT = 'theme-change'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export type Theme = 'light' | 'dark'

export type ThemeToggleState = 'idle' | 'loading' | 'error' | 'stale' | 'permission-denied'

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

function MoonIcon() {
  return (
    <svg className="theme-toggle__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M12.03 2.26a.75.75 0 0 0-1.06.92 6 6 0 0 1 7.5 7.5.75.75 0 0 0 .92-1.06 7.5 7.5 0 0 0-7.36-7.36zM7.47 3.7A7 7 0 1 0 16.3 12.53a5.5 5.5 0 1 1-8.83-8.83z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg
      className="theme-toggle__spinner"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M10 2a8 8 0 1 1-8 8" />
    </svg>
  )
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(resolveTheme)
  const [state, setState] = useState<ThemeToggleState>('idle')
  // Tracks whether the user has explicitly chosen a theme during this mount.
  // While false, OS preference changes are honored; once true, they are ignored
  // so an explicit choice is never silently overwritten.
  const hasExplicitChoice = useRef(false)
  // Guards against out-of-order / duplicate async writes from a rapid
  // succession of toggles or OS events: only the latest commit is applied.
  const writeGeneration = useRef(0)
  // Tracks whether the component is still mounted so async continuations
  // cannot commit state after unmount (stale commit guard).
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Single source of truth for applying a theme to the document and storage.
  // Idempotent: repeated calls with the same theme are no-ops.
  const commitTheme = useCallback((nextTheme: Theme) => {
    const generation = ++writeGeneration.current
    setTheme((prev) => {
      if (prev === nextTheme) return prev
      // Apply to the document only for the latest commited generation.
      if (generation === writeGeneration.current) {
        try {
          document.documentElement.dataset.theme = nextTheme
        } catch {
          // DOM writes are best-effort; state remains consistent.
        }
        persistTheme(nextTheme)
      }
      return nextTheme
    })
  }, [])

  // Keep the document in sync with the current theme on every commit.
  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme
    } catch {
      // ignore DOM availability failures
    }
    persistTheme(theme)
  }, [theme])

  // React to OS preference changes only while no explicit choice exists.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    let mql: MediaQueryList
    try {
      mql = window.matchMedia(DARK_QUERY)
    } catch {
      return
    }

    const handleChange = (event: MediaQueryListEvent) => {
      if (hasExplicitChoice.current) return
      commitTheme(event.matches ? 'dark' : 'light')
    }

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange)
      return () => mql.removeEventListener('change', handleChange)
    }

    // Legacy Safari / fallback API.
    if (typeof mql.addListener === 'function') {
      mql.addListener(handleChange)
      return () => mql.removeListener(handleChange)
    }

    return undefined
  }, [commitTheme])

  // External consumers (e.g. the Settings context) can request a theme
  // change without duplicating the persistence / DOM invariants.
  useEffect(() => {
    const handleExternal = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: unknown }>).detail
      const next = detail?.theme
      if (!isValidTheme(next)) return
      hasExplicitChoice.current = true
      commitTheme(next)
    }

    window.addEventListener(THEME_CHANGE_EVENT, handleExternal)
    return () => window.removeEventListener(THEME_CHANGE_EVENT, handleExternal)
  }, [commitTheme])

  /**
   * Commit an explicit theme change with deterministic failure-boundary
   * handling.
   *
   * Invariants:
   * - The in-memory theme is always committed, even if persistence or DOM
   *   writes fail, so the toggle never gets stuck or loses user intent.
   * - A persistence failure is surfaced as a non-fatal 'error' state that
   *   self-recovers on the next successful commit (retry-safe).
   * - A DOM write failure is surfaced as 'permission-denied' without
   *   exposing the underlying error message.
   * - Only the latest generation may mutate the DOM / storage, so concurrent
   *   or out-of-order commits cannot produce an inconsistent result.
   */
  const commitExplicitTheme = useCallback((nextTheme: Theme) => {
    const generation = ++writeGeneration.current
    if (!isMounted.current) return

    // Always commit the in-memory theme first: the toggle must remain
    // responsive even when external systems are degraded.
    setTheme(nextTheme)

    let domFailed = false
    try {
      document.documentElement.dataset.theme = nextTheme
    } catch {
      domFailed = true
    }

    let persistFailed = false
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      persistFailed = true
    }

    // Only the latest generation may mutate the visible failure state.
    if (generation !== writeGeneration.current) return

    if (domFailed) {
      setState('permission-denied')
      return
    }
    if (persistFailed) {
      setState('error')
      return
    }
    setState('idle')
  }, [])

  const toggleTheme = () => {
    hasExplicitChoice.current = true
    commitExplicitTheme(theme === 'light' ? 'dark' : 'light')
  }

  const nextTheme = theme === 'light' ? 'dark' : 'light'
  const isLoading = state === 'loading'
  const isDisabled = isLoading

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick=toggleTheme
      disabled={isDisabled}
      data-state={state}
      aria-busy={isLoading ? 'true' : undefined}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
      title={`Switch to ${nextTheme} mode}`}
    >
      {isLoading ? <SpinnerIcon /> : theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
