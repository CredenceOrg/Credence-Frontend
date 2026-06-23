import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'
import './Button.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Loading state - shows spinner and disables interaction */
  isLoading?: boolean
  /** Full width button */
  fullWidth?: boolean
  /** Button content */
  children: ReactNode
}

/**
 * Standardized button component with consistent variants and interactive states.
 * Includes accessible focus styles and loading state support.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    isLoading = false,
    fullWidth = false,
    disabled,
    children,
    className = '',
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={[
        'credence-button',
        `credence-button--${variant}`,
        fullWidth ? 'credence-button--full-width' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <span className="credence-button__spinner" aria-hidden="true">
          <svg
            className="credence-button__spinner-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="credence-button__spinner-track"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <circle
              className="credence-button__spinner-head"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}
      <span className={isLoading ? 'credence-button__content--loading' : ''}>{children}</span>
    </button>
  )
})

export default Button
