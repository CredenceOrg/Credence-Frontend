import { useRef, type KeyboardEvent } from 'react'
import './controls.css'

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string = string> {
  id?: string
  /** Accessible label for the group (reads as "Theme mode: Light / Dark / System"). */
  ariaLabel: string
  value: T
  onChange: (next: T) => void
  options: SegmentedControlOption<T>[]
  disabled?: boolean
}

/**
 * Resolves the writing direction that applies to `element` by walking up to the
 * nearest explicit `dir` attribute. Falls back to `ltr`, which matches the
 * document default and keeps arrow mapping deterministic in tests.
 */
export function resolveDirection(element: HTMLElement | null): 'ltr' | 'rtl' {
  let node: HTMLElement | null = element
  while (node) {
    const dir = node.getAttribute('dir')
    if (dir === 'rtl' || dir === 'ltr') return dir
    node = node.parentElement
  }
  return 'ltr'
}

/**
 * SegmentedControl — a pill-strip of mutually exclusive options.
 *
 * Renders as a `role="radiogroup"` containing individual `role="radio"`
 * buttons so screen readers correctly announce the group label and current
 * selection.
 *
 * Keyboard contract (WAI-ARIA radio group pattern):
 *  - The group is a single tab stop: only the checked option has `tabIndex=0`
 *    (the first option when nothing is checked); the rest are `-1`.
 *  - `ArrowRight` / `ArrowDown` move to the next option, `ArrowLeft` /
 *    `ArrowUp` to the previous one, wrapping at the ends. In an RTL container
 *    (`dir="rtl"` on the control or an ancestor) the horizontal arrows swap so
 *    `ArrowRight` moves backwards visually.
 *  - `Home` / `End` jump to the first / last option.
 *  - Selection follows focus: moving focus also calls `onChange`, so the
 *    checked option always matches the focused one.
 *  - When `disabled` is set the whole group is inert and no key is handled.
 *
 * Token usage:
 *  - Layout / spacing via `--credence-space-*`
 *  - Colors via `--credence-color-primary*` and `--credence-surface-card`
 *  - Motion via `--credence-motion-duration-fast`
 *  - Focus ring via `--credence-focus-ring`
 */
export default function SegmentedControl<T extends string = string>({
  id,
  ariaLabel,
  value,
  onChange,
  options,
  disabled = false,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  // The single tab stop is the checked option; if `value` matches no option
  // (e.g. a stale setting) the first option keeps the group reachable.
  const checkedIndex = options.findIndex((opt) => opt.value === value)
  const tabStopIndex = checkedIndex >= 0 ? checkedIndex : 0

  const moveTo = (index: number) => {
    const next = options[index]
    if (!next) return
    onChange(next.value)
    optionRefs.current[index]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const { key } = event
    if (
      key !== 'ArrowLeft' &&
      key !== 'ArrowRight' &&
      key !== 'ArrowUp' &&
      key !== 'ArrowDown' &&
      key !== 'Home' &&
      key !== 'End'
    ) {
      return
    }
    if (options.length === 0) return

    event.preventDefault()

    // Focus may sit on an option that has not been committed yet if a consumer
    // ignores `onChange`; prefer the focused element so arrows stay relative to
    // what the user sees focused.
    const focusedIndex = optionRefs.current.findIndex(
      (node) => node !== null && node === document.activeElement
    )
    const currentIndex = focusedIndex >= 0 ? focusedIndex : tabStopIndex

    if (key === 'Home') {
      moveTo(0)
      return
    }
    if (key === 'End') {
      moveTo(options.length - 1)
      return
    }

    const isRtl = resolveDirection(groupRef.current) === 'rtl'
    const forward =
      key === 'ArrowDown' || (key === 'ArrowRight' && !isRtl) || (key === 'ArrowLeft' && isRtl)
    const delta = forward ? 1 : -1
    const nextIndex = (currentIndex + delta + options.length) % options.length
    moveTo(nextIndex)
  }

  return (
    <div
      ref={groupRef}
      id={id}
      className="control-segmented"
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
    >
      {options.map((opt, index) => (
        <button
          key={opt.value}
          ref={(node) => {
            optionRefs.current[index] = node
          }}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          tabIndex={index === tabStopIndex ? 0 : -1}
          disabled={disabled}
          className={`control-segmented__option${value === opt.value ? ' control-segmented__option--selected' : ''}`}
          onClick={() => !disabled && onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
