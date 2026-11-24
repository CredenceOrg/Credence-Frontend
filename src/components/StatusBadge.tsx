import './StatusBadge.css'
import TooltipOnOverflow from './TooltipOnOverflow'

/** The four lifecycle states a bond or operation can occupy. */
export type StatusBadgeVariant = 'pending' | 'active' | 'completed' | 'failed'

export interface StatusBadgeProps {
  /** Lifecycle status variant. */
  variant: StatusBadgeVariant
  /** Optional display label override. Defaults to the capitalised variant name. */
  label?: string
  /** Additional class names appended to the badge root. */
  className?: string
  /**
   * Optional screen-reader-only prefix rendered before the visible label so
   * assistive technology can announce the badge in context (e.g. `"Bond status:"`
   * produces `"Bond status: Pending"` when read aloud). No extra DOM is added
   * when this prop is omitted.
   */
  srPrefix?: string
  /**
   * Accessible label for the badge element. Defaults to the display label.
   * Provide this prop when the badge appears in a context where screen readers
   * need a more descriptive label than the visible text alone.
   */
  ariaLabel?: string
}

const DEFAULT_LABELS: Record<StatusBadgeVariant, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  failed: 'Failed',
}

export default function StatusBadge({
  variant,
  label,
  className = '',
  srPrefix,
  ariaLabel,
}: StatusBadgeProps) {
  const displayLabel = label ?? DEFAULT_LABELS[variant]
  const accessibleLabel = ariaLabel ?? displayLabel

  return (
    <TooltipOnOverflow content={displayLabel}>
      <span
        className={`status-badge status-badge--${variant} ${className}`.trim()}
        aria-label={accessibleLabel}
      >
        {srPrefix && <span className="sr-only">{srPrefix} </span>}
        {displayLabel}
      </span>
    </TooltipOnOverflow>
  )
}
