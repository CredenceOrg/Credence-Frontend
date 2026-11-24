/** Resolved (non-"system") theme. */
export type Theme = 'light' | 'dark'

/** Window event the header ThemeToggle listens to for externally requested changes. */
export const THEME_CHANNEL_EVENT = 'theme-change'

/** The theme a toggle moves to from `theme`. Shared by ThemeToggle and the `T` shortcut. */
export function getNextTheme(theme: Theme): Theme {
  return theme === 'light' ? 'dark' : 'light'
}

/**
 * The theme currently applied to the page: the document's `data-theme` when it
 * is a valid value, otherwise the OS preference. Never throws.
 */
export function getCurrentTheme(): Theme {
  if (typeof document !== 'undefined') {
    const applied = document.documentElement.dataset.theme
    if (applied === 'light' || applied === 'dark') return applied
  }
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
  } catch {
    // fall through to light
  }
  return 'light'
}
