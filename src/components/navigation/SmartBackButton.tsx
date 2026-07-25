import { ButtonHTMLAttributes } from 'react'
import Button from '../Button'
import { useSmartBack } from '../../hooks/useSmartBack'
import { DEFAULT_FALLBACK_ROUTE } from '../../config/navigation'
import './SmartBackButton.css'

export interface SmartBackButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visible label text */
  label?: string
  /** Fallback route when no prior history or route state exists */
  fallback?: string
  /** Button visual variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Additional CSS class names */
  className?: string
  /** Accessible ARIA label override */
  ariaLabel?: string
}

/**
 * Reusable navigation button component that uses smart-back navigation.
 * Honours prior-route history when present and falls back to `/dashboard`
 * (or custom fallback) when no prior route exists.
 */
export default function SmartBackButton({
  label = 'Go Back',
  fallback = DEFAULT_FALLBACK_ROUTE,
  variant = 'secondary',
  className = '',
  ariaLabel,
  onClick,
  ...props
}: SmartBackButtonProps) {
  const { goBack } = useSmartBack({ fallback })

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(event)
    }
    if (!event.defaultPrevented) {
      goBack()
    }
  }

  const combinedClassName = ['credence-smart-back-button', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Button
      type="button"
      variant={variant}
      className={combinedClassName}
      onClick={handleClick}
      aria-label={ariaLabel || label}
      {...props}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Button>
  )
}
