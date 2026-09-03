import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'
import { TEST_IDS } from '../config/testIds'
import LoadingSpinner from './LoadingSpinner'
import './Button.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Loading state - shows spinner and disables interaction */
  isLoading?: boolean
  /** Loading text override - defaults based on children text */
  loadingText?: string
  /** Full width button */
  fullWidth?: boolean
  /** Button content */
  children: ReactNode
  'data-testid'?: string
}

/**
 * Standardized button component with consistent variants and interactive states.
 * Includes accessible focus styles and loading state support.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    fullWidth = false,
    disabled,
    children,
    className = '',
    type = 'button',
    'data-testid': dataTestId,
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading
  const finalTestId = dataTestId ?? (variant === 'primary' ? TEST_IDS.PRIMARY_CTA : undefined)

  // Determine loading announcement text
  const getLoadingText = (): string => {
    if (loadingText) return loadingText
    // Default loading announcement
    return 'Sending…'
  }

  return (
    <button
      ref={ref}
      type={type}
      data-testid={finalTestId}
      disabled={isDisabled}
      className={[
        'credence-button',
        `credence-button--${variant}`,
        `credence-button--${size}`,
        fullWidth ? 'credence-button--full-width' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={isLoading}
      aria-disabled={isDisabled}
      {...props}
    >
      {isLoading && (
        <LoadingSpinner
          className="credence-button__spinner"
          iconClassName="credence-button__spinner-icon"
          aria-hidden="true"
        />
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {isLoading ? getLoadingText() : ''}
      </span>
      <span className={isLoading ? 'credence-button__content--loading' : ''}>{children}</span>
    </button>
  )
})

export default Button
