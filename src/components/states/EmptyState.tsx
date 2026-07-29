import { ReactNode } from 'react'
import './EmptyState.css'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
    isLoading?: boolean
  }
  illustration?: 'bond' | 'trust' | 'dispute' | 'attestation' | 'activity'
}

/**
 * Inline SVG icons for each illustration variant.
 * All icons use `currentColor` and `aria-hidden="true"` — the accessible name
 * comes from the surrounding title/description text, matching Toast.tsx / ThemeToggle.tsx.
 */
const ILLUSTRATION_ICONS: Record<
  NonNullable<EmptyStateProps['illustration']>,
  ReactNode
> = {
  bond: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  trust: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  dispute: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  attestation: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  activity: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  illustration,
}: EmptyStateProps) {
  const iconClass = illustration
    ? `empty-state__icon empty-state__icon--${illustration}`
    : 'empty-state__icon'

  const renderedIcon = icon ? (
    <div className="empty-state__icon">{icon}</div>
  ) : illustration ? (
    <div className={iconClass}>{ILLUSTRATION_ICONS[illustration]}</div>
  ) : null

  return (
    <div className="empty-state">
      {renderedIcon}
      <h3 className="empty-state__title">{title}</h3>
      <p
        className={`empty-state__description${action ? ' empty-state__description--hasAction' : ''}`}
      >
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`empty-state__action${action.variant === 'secondary' ? ' empty-state__action--secondary' : ''}`}
          disabled={action.isLoading}
          aria-busy={action.isLoading}
        >
          {action.isLoading ? 'Connecting…' : action.label}
        </button>
      )}
    </div>
  )
}
