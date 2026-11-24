import './Kbd.css'

export type KbdSize = 'sm' | 'md' | 'lg'

export interface KbdProps {
  /**
   * The key label to display. Use platform-agnostic labels such as `"Ctrl"`,
   * `"Shift"`, `"Esc"`, or single characters like `"K"`.
   */
  children: string
  /**
   * Visual size of the key chip.
   * - `sm` — compact; suited for dense tooltips and inline prose.
   * - `md` — default; matches the KeyboardShortcutsDialog key size.
   * - `lg` — spacious; suited for large-print contexts and onboarding copy.
   *
   * @default 'md'
   */
  size?: KbdSize
  /**
   * Additional CSS class names appended to the root element. Use sparingly —
   * prefer the `size` prop for sizing overrides.
   */
  className?: string
  /**
   * Accessible label for the key. Defaults to `children`. Provide this when
   * the key symbol alone would be ambiguous to assistive technology, e.g.
   * `ariaLabel="Command"` for `"⌘"`.
   */
  ariaLabel?: string
}

/**
 * Renders a single keyboard key with a raised-button visual.
 *
 * Use this wherever the UI needs to display a keyboard shortcut consistently —
 * in docs, tooltips, onboarding copy, or the KeyboardShortcutsDialog.
 *
 * ```tsx
 * // Single key
 * <Kbd>Esc</Kbd>
 *
 * // Composite shortcut — wrap each key in its own <Kbd>
 * <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>
 *
 * // Platform symbol with accessible label
 * <Kbd ariaLabel="Command">⌘</Kbd>
 * ```
 *
 * Styling uses only `--credence-*` design tokens; no hard-coded colours,
 * spacing, or radii. Dark-mode is handled via `[data-theme='dark']`.
 */
export default function Kbd({ children, size = 'md', className = '', ariaLabel }: KbdProps) {
  const classes = ['credence-kbd', `credence-kbd--${size}`, className].filter(Boolean).join(' ')

  return (
    <kbd className={classes} aria-label={ariaLabel ?? children}>
      {children}
    </kbd>
  )
}
