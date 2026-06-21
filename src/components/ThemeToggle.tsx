import './ThemeToggle.css'
import { useEffect, useState } from 'react'
import { useSettings } from '../context/SettingsContext'

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
    <svg
      className="theme-toggle__icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.03 2.26a.75.75 0 0 0-1.06.92 6 6 0 0 1 7.5 7.5.75.75 0 0 0 .92-1.06 7.5 7.5 0 0 0-7.36-7.36zM7.47 3.7A7 7 0 1 0 16.3 12.53a5.5 5.5 0 1 1-8.83-8.83z" />
    </svg>
  )
}

/** SSR-safe read of the OS-level `prefers-color-scheme: dark` preference. */
function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * ThemeToggle — a single-icon button for flipping the app between light and
 * dark mode.
 *
 * ## Single source of truth
 *
 * The displayed state is derived *entirely* from {@link useSettings}; this
 * component owns **no** theme state and writes to **no** storage key of its
 * own. {@link SettingsContext} is the sole owner of the theme (persisted under
 * the `credence:settings` key) and the sole writer of the document's
 * `data-theme` attribute. See `docs/dark-mode.md` for the model.
 *
 * The light/dark value shown is *resolved* from `themeMode`:
 * - `'light'` / `'dark'` resolve to themselves;
 * - `'system'` resolves via `matchMedia('(prefers-color-scheme: dark)')`.
 *
 * A `matchMedia` subscription keeps the resolved value (and therefore the icon,
 * `aria-pressed`, and `aria-label`) in sync when the OS theme changes while
 * `themeMode` is `'system'`, so the toggle always matches the document's
 * `data-theme`.
 *
 * Clicking flips `themeMode` to the *explicit* opposite of the currently
 * resolved theme (e.g. resolved-dark → `'light'`), never back to `'system'`.
 */
export default function ThemeToggle() {
  const { themeMode, setThemeMode } = useSettings()

  // Mirror the OS preference so the toggle re-renders when it changes while in
  // `system` mode. This is a *derived* value, not a second source of truth —
  // `themeMode` (owned by SettingsContext) remains authoritative.
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches)
    // Re-sync once on mount in case the OS preference changed before subscribing.
    setSystemPrefersDark(mql.matches)
    mql.addEventListener?.('change', handler)
    return () => mql.removeEventListener?.('change', handler)
  }, [])

  const resolved: 'light' | 'dark' =
    themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode
  const nextTheme = resolved === 'dark' ? 'light' : 'dark'

  const handleClick = () => setThemeMode(nextTheme)

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={resolved === 'dark'}
      title={`Switch to ${nextTheme} mode`}
    >
      {resolved === 'light' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}
