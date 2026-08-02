import { useEffect } from 'react'

/**
 * Resolved theme literal — always 'light' or 'dark' regardless of the
 * `themeMode` setting.
 */
export type ResolvedTheme = 'light' | 'dark'

/**
 * Theme mode preference — 'light' and 'dark' are explicit; 'system' defers to
 * the OS `prefers-color-scheme` media query.
 */
export type ThemeMode = 'light' | 'dark' | 'system'

/**
 * Apply a theme to `document.documentElement` and keep it in sync with the OS
 * preference when the mode is `'system'`.
 *
 * The effect:
 * 1. Resolves the effective theme (queries `matchMedia` when `themeMode` is
 *    `'system'`).
 * 2. Writes `data-theme` on `<html>`.
 * 3. When `themeMode === 'system'`, subscribes to `prefers-color-scheme: dark`
 *    changes and re-applies on every flip. The listener is removed when the mode
 *    changes away from `'system'` or on unmount.
 *
 * @param themeMode - The user's theme preference (`'light'` | `'dark'` | `'system'`).
 *   When `'system'` the OS preference is used to determine the actual theme.
 */
export function useThemeDetector(themeMode: ThemeMode): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = window.document.documentElement

    const apply = () => {
      if (themeMode === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.setAttribute('data-theme', isDark ? 'dark' : 'light')
      } else {
        root.setAttribute('data-theme', themeMode)
      }
    }

    apply()

    if (themeMode !== 'system') return

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => apply()
    mql.addEventListener?.('change', handler)
    return () => mql.removeEventListener?.('change', handler)
  }, [themeMode])
}