import './Badge.css'
import TooltipOnOverflow from './TooltipOnOverflow'

export type BadgeVariant =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'active'
  | 'locked'
  | 'slashed'
  | 'grace-period'
  | 'unknown'

export interface BadgeProps {
  /** Tier or status variant. Unknown strings normalize to the `unknown` style. */
  variant: BadgeVariant | string
  /** Optional display label override. Defaults to the known variant label. */
  label?: string
  /** Additional class names appended to the badge root. */
  className?: string
  /**
   * Optional screen-reader-only prefix rendered before the visible label so
   * assistive technology can announce the badge in context (e.g. `"Bond status:"`
   * produces `"Bond status: Slashed"` when read aloud). No extra DOM is added
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

const DEFAULT_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  active: 'Active',
  locked: 'Locked',
  slashed: 'Slashed',
  'grace-period': 'Grace Period',
  unknown: 'Unknown',
}

export default function Badge({ variant, label, className = '', srPrefix }: BadgeProps) {
  const isKnown = variant.toLowerCase() in DEFAULT_LABELS
  const normalizedVariant = isKnown ? variant.toLowerCase() : 'unknown'

  const displayLabel =
    label ||
    (normalizedVariant === 'unknown' && variant.toLowerCase() !== 'unknown'
      ? variant
      : DEFAULT_LABELS[normalizedVariant])

  return (
    <TooltipOnOverflow content={displayLabel}>
      <span className={`badge badge--${normalizedVariant} ${className}`.trim()}>
        {srPrefix && <span className="sr-only">{srPrefix} </span>}
        {displayLabel}
      </span>
    </TooltipOnOverflow>
  )
}
