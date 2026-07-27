import './Progress.css'

export interface ProgressProps {
  /**
   * Current value of the progress indicator.
   * For determinate mode, provide a number between `min` and `max`.
   * Omit (or pass `undefined`) for indeterminate mode.
   */
  value?: number
  /** Minimum value for determinate mode. Defaults to 0. */
  min?: number
  /** Maximum value for determinate mode. Defaults to 100. */
  max?: number
  /**
   * Accessible label announcing what is loading.
   * Required: every progress bar must have an accessible name.
   */
  'aria-label': string
  /** Additional class names appended to the root element. */
  className?: string
  /** Size variant affecting bar height. Defaults to `'md'`. */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Colour variant for the progress fill.
   * Maps to design-token colour values. Defaults to `'primary'`.
   */
  color?: 'primary' | 'success' | 'warning' | 'danger'
  /**
   * Adds diagonal stripes to the fill bar for visual distinction.
   * Works in both determinate and indeterminate modes.
   */
  striped?: boolean
  /**
   * Animates the striped pattern so it scrolls across the bar.
   * Implies `striped` when set to `true`.
   * Respects `prefers-reduced-motion: reduce`.
   */
  animated?: boolean
}

/**
 * Accessible progress bar component.
 *
 * Renders a `role="progressbar"` element. When `value` is provided the bar is
 * **determinate** and `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`
 * reflect the current fill percentage. When `value` is omitted the bar is
 * **indeterminate** and none of the `aria-value*` attributes are set, signalling
 * to assistive technology that the completion amount is unknown.
 */
export default function Progress({
  value,
  min = 0,
  max = 100,
  'aria-label': ariaLabel,
  className = '',
  size = 'md',
  color = 'primary',
  striped = false,
  animated = false,
}: ProgressProps) {
  const isIndeterminate = value === undefined
  const showStripes = striped || animated
  const colorClass = `progress--color-${color}`

  const clampedValue = isIndeterminate ? undefined : Math.min(Math.max(value, min), max)
  const percentage = isIndeterminate
    ? undefined
    : max === min
      ? 0
      : ((clampedValue! - min) / (max - min)) * 100

  const rootClass = [
    'progress',
    `progress--${size}`,
    colorClass,
    isIndeterminate ? 'progress--indeterminate' : 'progress--determinate',
    showStripes ? 'progress--striped' : '',
    animated ? 'progress--animated' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={clampedValue}
      aria-valuemin={isIndeterminate ? undefined : min}
      aria-valuemax={isIndeterminate ? undefined : max}
      className={rootClass}
    >
      <div
        className="progress__track"
        aria-hidden="true"
      >
        <div
          className="progress__fill"
          style={
            isIndeterminate
              ? undefined
              : ({ '--progress-fill': `${percentage}%` } as React.CSSProperties & {
                  '--progress-fill': string
                })
          }
        />
      </div>
    </div>
  )
}
