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
 * SegmentedControl — a pill-strip of mutually exclusive options.
 *
 * Renders as a `role="radiogroup"` containing individual `role="radio"`
 * buttons so screen readers correctly announce the group label and current
 * selection. Each segment is a `<button>` with `aria-checked` so the full
 * group is keyboard-operable with Tab + Space/Enter without needing arrow-key
 * roving focus (simpler, still accessible).
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
  return (
    <div
      id={id}
      className="control-segmented"
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
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
