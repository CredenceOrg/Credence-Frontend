import { useCallback, useEffect, useRef, useState } from 'react'
import './ThemeToggle.css'

export type Theme = 'light' | 'dark'

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

/**
 * Resolves the initial theme from persisted state and the OS preference.
 *
 * Invariants:
 * - Never throws: any storage/media failure falls back to a deterministic 'light'.
 * - Only the exact values 'light'/'dark' are accepted from storage; anything else
 *   is treated as absent (corrupted/tampered state cannot latch an invalid theme).
 */
export function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  try {
    const saved = window.localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can throw (disabled cookies, private mode, quota). Fall through to OS.
  }

  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme)

  // Tracks whether the most recent toggle attempt was applied to the document.
  // Used to give the button a deterministic, diagnosable error state without
  // losing the user's chosen theme in memory.
  const [error, setError] = useState<string | null>(null)
  const lastAppliedRef = useRef<Theme | null>(null)

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

  /**
   * Deterministic toggle. Computes the next theme from the current value and applies
   * it exactly once per click, even under concurrent/rapid re-entrant clicks.
   */
  const handleClick = useCallback(() => {
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
