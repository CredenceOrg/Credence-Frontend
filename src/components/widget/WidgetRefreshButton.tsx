import { forwardRef, type ButtonHTMLAttributes } from 'react'
import './WidgetRefreshButton.css'

export interface WidgetRefreshButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'aria-busy'
> {
  /** Click handler — typically `() => widgetCache.refresh()`. */
  onRefresh: () => void
  /** Loading state — disables the button and shows a spinner. */
  isLoading?: boolean
  /**
   * Human-readable widget name used in the aria-label and tooltip.
   * Examples: `"recent activity"`, `"active bonds"`.
   */
  label?: string
  /**
   * Timestamp (ms since epoch) of the last successful fetch. Surfaces a
   * `Last updated Xs ago` cue in the tooltip and accessible name.
   */
  lastUpdated?: number
}

function formatRelative(lastUpdated: number | undefined, now: number = Date.now()): string {
  if (typeof lastUpdated !== 'number') return 'never'
  const delta = Math.max(0, now - lastUpdated)
  if (delta < 5_000) return 'just now'
  if (delta < 60_000) return `${Math.floor(delta / 1_000)}s ago`
  if (delta < 60 * 60_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 24 * 60 * 60_000) return `${Math.floor(delta / (60 * 60_000))}h ago`
  return new Date(lastUpdated).toLocaleString()
}

/**
 * Small icon button that triggers a per-widget refresh.
 *
 * Visible behaviour:
 *  - Idle: a circular-arrow icon with a tooltip showing the last update time.
 *  - Loading: a spinner; the button is `disabled` and `aria-busy="true"`.
 *  - Hover/focus: token-driven hover background and focus ring (no
 *    hard-coded colours or radii, see `WidgetRefreshButton.css`).
 *
 * Accessibility:
 *  - `aria-label` includes the widget name so screen reader users hear
 *    "Refresh recent activity" instead of just "button".
 *  - `title` mirrors the label so sighted keyboard users see the cue too.
 */
const WidgetRefreshButton = forwardRef<HTMLButtonElement, WidgetRefreshButtonProps>(
  function WidgetRefreshButton(
    {
      onRefresh,
      isLoading = false,
      disabled = false,
      label = 'widget',
      lastUpdated,
      className,
      type = 'button',
      ...rest
    },
    ref
  ) {
    const isDisabled = disabled || isLoading
    const ariaLabel = isLoading
      ? `Refreshing ${label}`
      : `Refresh ${label}` + (lastUpdated ? `. Last updated ${formatRelative(lastUpdated)}` : '')

    const classes = ['widget-refresh', isLoading ? 'widget-refresh--loading' : '', className ?? '']
      .filter(Boolean)
      .join(' ')

    return (
      <button
        ref={ref}
        type={type}
        onClick={onRefresh}
        disabled={isDisabled}
        aria-busy={isLoading ? true : undefined}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={classes}
        {...rest}
      >
        {isLoading ? (
          <svg
            viewBox="0 0 24 24"
            className="widget-refresh__icon widget-refresh__icon--spinner"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="3"
            />
            <path
              d="M22 12a10 10 0 0 1-10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="widget-refresh__icon"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M17.65 6.35A8 8 0 0 0 12 4a8 8 0 1 0 7.5 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
            />
          </svg>
        )}
      </button>
    )
  }
)

export default WidgetRefreshButton
