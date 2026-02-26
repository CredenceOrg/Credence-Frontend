import { ReactNode } from 'react'

interface ErrorStateProps {
  type?: 'network' | 'backend' | 'validation' | 'generic'
  title?: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: ReactNode
}

export default function ErrorState({
  type = 'generic',
  title,
  message,
  action,
  icon,
}: ErrorStateProps) {
  const errorConfig = {
    network: {
      title: 'Connection issue',
      message: 'Unable to connect to the network. Check your internet connection and try again.',
      emoji: '🌐',
    },
    backend: {
      title: 'Service unavailable',
      message: 'Our service is temporarily unavailable. Please try again in a few moments.',
      emoji: '⚠️',
    },
    validation: {
      title: 'Invalid input',
      message: 'Please check your input and try again.',
      emoji: '❌',
    },
    generic: {
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
      emoji: '⚠️',
    },
  }

  const config = errorConfig[type]

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '2rem 1.5rem',
        maxWidth: '28rem',
        margin: '0 auto',
        border: '1px solid #fee2e2',
        borderRadius: '12px',
        background: '#fef2f2',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          fontSize: '1.5rem',
        }}
      >
        {icon || config.emoji}
      </div>
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 600,
          color: '#991b1b',
          marginBottom: '0.5rem',
        }}
      >
        {title || config.title}
      </h3>
      <p
        style={{
          color: '#7f1d1d',
          fontSize: '0.875rem',
          lineHeight: '1.5',
          marginBottom: action ? '1.5rem' : '0',
        }}
      >
        {message || config.message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '0.625rem 1.25rem',
            background: '#dc2626',
            color: '#fff',
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
