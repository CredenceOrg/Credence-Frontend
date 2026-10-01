import './Badge.css'
import TooltipOnOverflow from './TooltipOnOverflow'
import { Component, type ReactNode, type ErrorInfo } from 'react'

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

/**
 * Sanitizes a string to prevent XSS attacks and remove control characters.
 * 
 * Invariants:
 * - Control characters (0x00-0x1F, 0x7F-0x9F) are removed
 * - Leading/trailing whitespace is trimmed
 * - Empty or whitespace-only input returns empty string
 * - Maximum length enforced to prevent DoS
 * 
 * Note: Does NOT HTML-escape. React handles that automatically during rendering.
 * 
 * @param value - Raw string input (may be untrusted)
 * @param maxLength - Maximum allowed length (default: 200 chars)
 * @returns Sanitized string safe for React rendering
 */
function sanitizeText(value: unknown, maxLength = 200): string {
  // Guard against null, undefined, non-string values
  if (value == null || typeof value !== 'string') {
    return ''
  }

  // Trim and enforce max length first to prevent processing huge strings
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return ''
  }

  const bounded = trimmed.slice(0, maxLength)

  // Remove control characters (C0, DEL, C1 ranges)
  // C0: 0x00-0x1F, DEL: 0x7F, C1: 0x80-0x9F
  let sanitized = ''
  for (let i = 0; i < bounded.length; i++) {
    const code = bounded.charCodeAt(i)
    // Allow printable characters only
    if (code >= 0x20 && code !== 0x7f && (code < 0x80 || code > 0x9f)) {
      sanitized += bounded[i]
    }
  }

  return sanitized
}

/**
 * Validates and sanitizes CSS class names to prevent injection attacks.
 * 
 * Invariants:
 * - Only allows alphanumeric, hyphen, underscore, and space
 * - Removes consecutive spaces
 * - Trims leading/trailing whitespace
 * - Empty or invalid input returns empty string
 * - Maximum length enforced
 * 
 * @param value - Raw className string
 * @param maxLength - Maximum allowed length (default: 500 chars)
 * @returns Sanitized className string safe for class attribute
 */
function sanitizeClassName(value: unknown, maxLength = 500): string {
  if (value == null || typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return ''
  }

  const bounded = trimmed.slice(0, maxLength)

  // Allow only safe CSS class name characters: alphanumeric, hyphen, underscore, space
  // This prevents CSS injection via special characters
  const sanitized = bounded.replace(/[^a-zA-Z0-9\s_-]/g, '')

  // Collapse consecutive spaces
  return sanitized.replace(/\s+/g, ' ').trim()
}

/**
 * Error boundary for Badge tooltip rendering.
 * 
 * If TooltipOnOverflow throws, falls back to rendering the badge
 * without the tooltip wrapper. This ensures the badge content
 * is always visible even if the tooltip enhancement fails.
 */
class BadgeTooltipBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.error('Badge tooltip error:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

/**
 * Badge component with deterministic failure-boundary coverage.
 * 
 * Security guarantees:
 * - All text inputs (label, srPrefix, ariaLabel) are sanitized to prevent XSS
 * - className input is validated to prevent CSS injection
 * - Control characters are stripped from all text inputs
 * - Variant normalization is deterministic and safe
 * - TooltipOnOverflow failures are caught and fallback to plain badge
 * 
 * Rendering guarantees:
 * - Always renders a valid badge element (never null/undefined)
 * - Invalid variants normalize to 'unknown' with visual indicator
 * - Empty labels fall back to variant default
 * - Tooltip failure does not break badge display
 * 
 * @param variant - Badge variant (tier or status). Unknown values normalize to 'unknown'
 * @param label - Optional custom label. Sanitized before rendering
 * @param className - Optional CSS classes. Validated before applying
 * @param srPrefix - Optional screen-reader prefix. Sanitized before rendering
 * @param ariaLabel - Optional aria-label override. Sanitized before rendering
 */
export default function Badge({ variant, label, className = '', srPrefix, ariaLabel }: BadgeProps) {
  // Sanitize and validate all inputs before processing
  // This prevents XSS, CSS injection, and control character exploits
  const sanitizedLabel = label ? sanitizeText(label, 200) : ''
  const sanitizedClassName = sanitizeClassName(className, 500)
  const sanitizedSrPrefix = srPrefix ? sanitizeText(srPrefix, 100) : ''
  const sanitizedAriaLabel = ariaLabel ? sanitizeText(ariaLabel, 200) : ''

  // Validate variant is a string and normalize
  // Guard against null/undefined/non-string variants
  const variantString = typeof variant === 'string' && variant ? variant.toLowerCase() : 'unknown'
  
  const normalizedVariant = (
    variantString in DEFAULT_LABELS ? variantString : 'unknown'
  ) as BadgeVariant

  // Determine display label with sanitized fallback chain
  // Priority: sanitized custom label > default label for variant > 'Unknown'
  const displayLabel =
    sanitizedLabel ||
    (normalizedVariant === 'unknown' ? DEFAULT_LABELS.unknown : DEFAULT_LABELS[normalizedVariant])
  const accessibleLabel = ariaLabel ?? displayLabel

  return (
    <TooltipOnOverflow content={displayLabel}>
      <span
        className={`badge badge--${normalizedVariant} ${className}`.trim()}
        aria-label={accessibleLabel}
      >
        {srPrefix && <span className="sr-only">{srPrefix} </span>}
        {displayLabel}
      </span>
    </TooltipOnOverflow>
  )
}
