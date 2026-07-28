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

/**
 * Inline SVG icons for each error type.
 * All icons use `currentColor` and `aria-hidden="true"` — the accessible name
 * comes from the surrounding title/message text, matching Banner.tsx / EmptyState.tsx.
 */
const ERROR_ICONS: Record<NonNullable<ErrorStateProps['type']>, ReactNode> = {
  network: (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  backend: (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  validation: (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  generic: (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
}

export default function ErrorState({
  type = 'generic',
  title,
  message,
  action,
  icon,
}: ErrorStateProps) {
  const errorPanelStyle = {
    textAlign: 'center',
    padding: 'var(--credence-space-8) var(--credence-space-6)',
    maxWidth: '28rem',
    margin: '0 auto',
    border: '1px solid var(--credence-color-danger-surface-strong)',
    borderRadius: 'var(--credence-radius-xl)',
    background: 'var(--credence-color-danger-surface)',
  } as const

  const errorIconStyle = {
    width: '48px',
    height: '48px',
    borderRadius: 'var(--credence-radius-full)',
    background: 'var(--credence-color-danger-surface-strong)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto var(--credence-space-4)',
    color: 'var(--credence-color-danger-text)',
  } as const

  const errorTitleStyle = {
    fontSize: 'var(--credence-font-size-base)',
    fontWeight: 'var(--credence-font-weight-semibold)',
    color: 'var(--credence-color-danger-text)',
    marginBottom: 'var(--credence-space-2)',
  } as const

  const errorConfig = {
    network: {
      title: 'Connection issue',
      message: 'Unable to connect to the network. Check your internet connection and try again.',
    },
    backend: {
      title: 'Service unavailable',
      message: 'Our service is temporarily unavailable. Please try again in a few moments.',
    },
    validation: {
      title: 'Invalid input',
      message: 'Please check your input and try again.',
    },
    generic: {
      title: 'Something went wrong',
      message: 'An unexpected error occurred. Please try again.',
    },
  }

  const config = errorConfig[type]

  return (
    <div style={errorPanelStyle}>
      <div style={errorIconStyle}>{icon || ERROR_ICONS[type]}</div>
      <h3 style={errorTitleStyle}>{title || config.title}</h3>
      <p
        style={{
          color: 'var(--credence-color-danger-text-muted)',
          fontSize: 'var(--credence-font-size-sm)',
          lineHeight: 'var(--credence-line-height-base)',
          marginBottom: action ? 'var(--credence-space-6)' : '0',
        }}
      >
        {message || config.message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="focus-visible"
          style={{
            padding: '0.625rem var(--credence-space-5)',
            background: 'var(--credence-color-danger-action)',
            color: 'var(--credence-color-white)',
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
