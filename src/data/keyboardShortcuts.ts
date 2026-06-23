/**
 * Central registry of all global keyboard shortcuts in the Credence app.
 *
 * ## Adding a new shortcut
 * 1. Add a new entry to this array.
 * 2. Wire up the actual listener in the appropriate component or hook.
 * 3. The dialog will automatically reflect the new entry — no other change needed.
 *
 * @example
 * ```ts
 * {
 *   group: 'Navigation',
 *   label: 'Go to Dashboard',
 *   keys: ['G', 'D'],
 * }
 * ```
 */

export interface KeyboardShortcut {
  /** Logical grouping displayed as a section heading in the help dialog. */
  group: string
  /** Human-readable description of what the shortcut does. */
  label: string
  /**
   * The key(s) the user presses, displayed as individual `<kbd>` elements.
   * Use platform-agnostic labels (e.g. "Esc", "?", "Shift").
   */
  keys: string[]
}

/** All global keyboard shortcuts, ordered by group then action. */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // ── General ─────────────────────────────────────────────────────────────
  {
    group: 'General',
    label: 'Open keyboard shortcuts help',
    keys: ['Shift', '?'],
  },
  {
    group: 'General',
    label: 'Dismiss dialog / close overlay',
    keys: ['Esc'],
  },
  // ── Theme ────────────────────────────────────────────────────────────────
  {
    group: 'Appearance',
    label: 'Toggle light / dark theme',
    keys: ['T'],
  },
]
