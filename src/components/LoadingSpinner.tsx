import { HTMLAttributes } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import './LoadingSpinner.css'

export interface LoadingSpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /** Text fallback displayed when reduced motion is preferred */
  label?: string
  /** Size variant of the spinner icon */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS class names for the wrapper span */
  className?: string
  /** Additional CSS class names for the SVG icon */
  iconClassName?: string
}

/**
 * Accessible loading spinner component.
 * Renders an animated SVG spinner by default, and falls back to a static "Loading…"
 * text label when the user has enabled prefers-reduced-motion.
 */
export default function LoadingSpinner({
  label = 'Loading…',
  size = 'md',
  className = '',
  iconClassName = '',
  'aria-label': ariaLabel,
  ...props
}: LoadingSpinnerProps) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return (
      <span
        className={['credence-loading-spinner', 'credence-loading-spinner--reduced', className]
          .filter(Boolean)
          .join(' ')}
        aria-label={ariaLabel || label}
        {...props}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      className={[
        'credence-loading-spinner',
        `credence-loading-spinner--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
      {...props}
    >
      <svg
        className={['credence-loading-spinner__icon', iconClassName].filter(Boolean).join(' ')}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="credence-loading-spinner__track"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle
          className="credence-loading-spinner__head"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="50"
          strokeDashoffset="0"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}
