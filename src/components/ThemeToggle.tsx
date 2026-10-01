import { useCallback, useEffect, useRef, useState } from 'react'
import './ThemeToggle.css'

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

function MoonIcon() {
  return (
    <svg className="theme-toggle__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M12.03 2.26a.75.75 0 0 0-1.06.92 6 6 0 0 1 7.5 7.5.75.75 0 0 0 .92-1.06 7.5 7.5 0 0 0-7.36-7.36zM7.47 3.7A7 7 0 1 0 16.3 12.53a5.5 5.5 0 1 1-8.83-8.83z" />
    </svg>
  )
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme)

  // Tracks whether the user has explicitly chosen a theme during this mount.
  // While false, OS preference changes are honored; once true, they are ignored
  // so an explicit choice is never silently overwritten.
  const hasExplicitChoice = useRef(false)
  // Guards against out-of-order / duplicate async writes from a rapid
  // succession of toggles or OS events: only the latest commit is applied.
  const writeGeneration = useRef(0)

  // Tracks whether the most recent toggle attempt was applied to the document.
  // Used to give the button a deterministic, diagnosable error state without
  // losing the user's chosen theme in memory.
  const [error, setError] = useState<string | null>(null)
  const lastAppliedRef = useRef<Theme | null>(null)

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
      lastAppliedRef.current = theme
      setError(null)
    } catch {
      // Never throw from an effect: a theme write failure must not crash the tree.
      // Surface a generic message; do not leak the underlying error.
      setError('Unable to apply the theme.')
    }

    try {
      window.localStorage.setItem('theme', theme)
    } catch {
      // Persistence failure is non-fatal: the in-memory theme remains authoritative.
    }
  }, [theme])

const toggleTheme = useCallback(() => {
  setTheme((current) => (current === 'light' ? 'dark' : 'light'))
}, [])

  const nextTheme: Theme = theme === 'light' ? 'dark' : 'light'
  const hasError = error !== null

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === 'dark'}
      aria-invalid={hasError ? 'true' : undefined}
      title={error ? error : `Switch to ${nextTheme} mode`}
      data-theme-state={theme}
    >
      {theme === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
