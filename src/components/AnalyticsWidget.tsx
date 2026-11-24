import { useState } from 'react'
import Toggle from './controls/Toggle'
import './AnalyticsWidget.css'

// ── Types ────────────────────────────────────────────────────────────────────

/** A single numeric metric shown in the analytics widget. */
export interface AnalyticsMetric {
  /** Human-readable label for the metric (e.g. "Trust Score"). */
  label: string
  /** Numeric value for the period. */
  value: number
  /**
   * Optional formatter applied to `value` before display.
   * Defaults to `String(value)` when omitted.
   */
  format?: (value: number) => string
  /** Optional unit suffix appended after the formatted value (e.g. "USDC"). */
  unit?: string
}

/** Data bundle describing one time period. */
export interface AnalyticsPeriodData {
  /** Short period label shown in the header (e.g. "Jul 2026"). */
  label: string
  /** Metrics to display for this period. */
  metrics: AnalyticsMetric[]
}

export interface AnalyticsWidgetProps {
  /** Widget heading displayed at the top of the card. */
  title: string
  /** Data for the most-recent / "current" period. */
  currentPeriod: AnalyticsPeriodData
  /**
   * Data for the preceding / "previous" period.
   * When supplied the compare-periods toggle is rendered.
   * When omitted the toggle is hidden and only the current period is shown.
   */
  previousPeriod?: AnalyticsPeriodData
  /**
   * Whether the compare-periods view is on by default.
   * Only relevant when `previousPeriod` is provided.
   * @default false
   */
  defaultCompare?: boolean
  /**
   * Controlled value for the compare-periods toggle.
   * Supply alongside `onCompareChange` to lift state up.
   */
  compareEnabled?: boolean
  /**
   * Callback fired when the compare toggle is flipped.
   * If supplied, the component becomes controlled (the caller owns toggle state).
   */
  onCompareChange?: (next: boolean) => void
  /** Additional CSS class names appended to the widget root. */
  className?: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMetricValue(metric: AnalyticsMetric): string {
  const formatted = metric.format ? metric.format(metric.value) : String(metric.value)
  return metric.unit ? `${formatted} ${metric.unit}` : formatted
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface PeriodColumnProps {
  period: AnalyticsPeriodData
  /** When true the column is highlighted as the primary / focal period. */
  isCurrent?: boolean
}

function PeriodColumn({ period, isCurrent = false }: PeriodColumnProps) {
  return (
    <div
      className={`analytics-widget__period ${isCurrent ? 'analytics-widget__period--current' : 'analytics-widget__period--previous'}`}
      aria-label={`${period.label} metrics`}
    >
      <p className="analytics-widget__period-label">{period.label}</p>
      <dl className="analytics-widget__metrics">
        {period.metrics.map((metric) => (
          <div className="analytics-widget__metric" key={metric.label}>
            <dt className="analytics-widget__metric-label">{metric.label}</dt>
            <dd className="analytics-widget__metric-value">{formatMetricValue(metric)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * AnalyticsWidget
 *
 * Displays one or two periods of numeric metrics.  When `previousPeriod` is
 * supplied a "Compare periods" toggle appears; flipping it slides the previous
 * period column into view alongside the current period so operators can do a
 * quick side-by-side comparison without leaving the dashboard.
 *
 * The component can be used in both uncontrolled (default) and controlled modes:
 * - **Uncontrolled**: omit `compareEnabled` / `onCompareChange`; the widget
 *   manages toggle state internally using `defaultCompare`.
 * - **Controlled**: supply both `compareEnabled` and `onCompareChange` to lift
 *   toggle state to the parent.
 */
export default function AnalyticsWidget({
  title,
  currentPeriod,
  previousPeriod,
  defaultCompare = false,
  compareEnabled,
  onCompareChange,
  className = '',
}: AnalyticsWidgetProps) {
  // Internal state used only in uncontrolled mode.
  const [internalCompare, setInternalCompare] = useState(defaultCompare)

  const isControlled = compareEnabled !== undefined
  const isComparing = isControlled ? compareEnabled : internalCompare

  const handleToggle = (next: boolean) => {
    if (!isControlled) {
      setInternalCompare(next)
    }
    onCompareChange?.(next)
  }

  const toggleId = 'analytics-widget-compare-toggle'

  return (
    <section className={`analytics-widget ${className}`.trim()} aria-label={title}>
      <header className="analytics-widget__header">
        <h2 className="analytics-widget__title">{title}</h2>

        {previousPeriod && (
          <div className="analytics-widget__toggle-row">
            <label htmlFor={toggleId} className="analytics-widget__toggle-label">
              Compare periods
            </label>
            <Toggle
              id={toggleId}
              checked={isComparing}
              onChange={handleToggle}
              ariaLabel="Compare current and previous periods"
            />
          </div>
        )}
      </header>

      <div
        className={`analytics-widget__body ${isComparing && previousPeriod ? 'analytics-widget__body--comparing' : ''}`}
      >
        {isComparing && previousPeriod && (
          <PeriodColumn period={previousPeriod} isCurrent={false} />
        )}
        <PeriodColumn period={currentPeriod} isCurrent />
      </div>
    </section>
  )
}
