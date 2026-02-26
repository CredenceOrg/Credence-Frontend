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

export default function EmptyState({
  icon,
  title,
  description,
  action,
  illustration,
}: EmptyStateProps) {
  const getIllustration = () => {
    const iconStyle = {
      width: '64px',
      height: '64px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1rem',
      fontSize: '2rem',
    }

    const illustrations = {
      bond: { bg: '#dbeafe', emoji: '🔒' },
      trust: { bg: '#ddd6fe', emoji: '⭐' },
      dispute: { bg: '#fee2e2', emoji: '⚖️' },
      attestation: { bg: '#d1fae5', emoji: '✓' },
      activity: { bg: '#fef3c7', emoji: '📊' },
    }

    const config = illustration ? illustrations[illustration] : null

    if (icon) {
      return <div style={iconStyle}>{icon}</div>
    }

    if (config) {
      return (
        <div style={{ ...iconStyle, background: config.bg }}>
          {config.emoji}
        </div>
      )
    }

    return null
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        maxWidth: '28rem',
        margin: '0 auto',
      }}
    >
      {getIllustration()}
      <h3
        style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#0f172a',
          marginBottom: '0.5rem',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: '#64748b',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          marginBottom: action ? '1.5rem' : '0',
        }}
      >
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '0.75rem 1.5rem',
            background: action.variant === 'secondary' ? '#e2e8f0' : '#0ea5e9',
            color: action.variant === 'secondary' ? '#0f172a' : '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
