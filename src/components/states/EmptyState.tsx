import { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
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
  { bg: string; svg: ReactNode }
> = {
  bond: {
    bg: 'var(--credence-color-platinum-surface)',
    svg: (
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
  },
  trust: {
    bg: 'var(--credence-color-trust-surface)',
    svg: (
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
  },
  dispute: {
    bg: 'var(--credence-color-danger-surface-strong)',
    svg: (
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
  },
  attestation: {
    bg: 'var(--credence-color-attestation-surface)',
    svg: (
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
  },
  activity: {
    bg: 'var(--credence-color-bronze-surface)',
    svg: (
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
  },
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  illustration,
}: EmptyStateProps) {
  const iconStyle = {
    width: '64px',
    height: '64px',
    borderRadius: 'var(--credence-radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto var(--credence-space-4)',
  }

  const config = illustration ? ILLUSTRATION_ICONS[illustration] : null

  const renderedIcon = icon ? (
    <div style={iconStyle}>{icon}</div>
  ) : config ? (
    <div style={{ ...iconStyle, background: config.bg }}>{config.svg}</div>
  ) : null

  return (
    <div
      style={{
        textAlign: 'center',
        padding: 'var(--credence-space-12) var(--credence-space-6)',
        maxWidth: '28rem',
        margin: '0 auto',
      }}
    >
      {renderedIcon}
      <h3
        style={{
          fontSize: 'var(--credence-font-size-lg)',
          fontWeight: 'var(--credence-font-weight-semibold)',
          color: 'var(--credence-text-primary)',
          marginBottom: 'var(--credence-space-2)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: 'var(--credence-text-secondary)',
          fontSize: 'var(--credence-font-size-sm)',
          lineHeight: 'var(--credence-line-height-base)',
          marginBottom: action ? 'var(--credence-space-6)' : '0',
        }}
      >
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="focus-visible"
          style={{
            padding: 'var(--credence-space-3) var(--credence-space-6)',
            background:
              action.variant === 'secondary'
                ? 'var(--credence-border-default)'
                : 'var(--credence-color-primary-soft)',
            color:
              action.variant === 'secondary'
                ? 'var(--credence-text-primary)'
                : 'var(--credence-color-white)',
            border: 'none',
            borderRadius: 'var(--credence-radius-lg)',
            fontWeight: 'var(--credence-font-weight-semibold)',
            cursor: 'pointer',
            fontSize: 'var(--credence-font-size-sm)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
