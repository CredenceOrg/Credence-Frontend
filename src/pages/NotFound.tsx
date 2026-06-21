import { useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFound() {
  const navigate = useNavigate()

  useDocumentTitle('Page Not Found')

  return (
    <div
      style={{
        textAlign: 'center',
        padding: 'var(--credence-space-12) var(--credence-space-6)',
        maxWidth: '28rem',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      }}
    >
      {/* 404 Icon */}
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--credence-radius-full)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--credence-space-4)',
          fontSize: '2.5rem',
          background: 'var(--credence-color-danger-surface-strong)',
        }}
      >
        ❌
      </div>

      {/* Heading */}
      <h1
        style={{
          fontSize: 'var(--credence-font-size-xl)',
          fontWeight: 'var(--credence-font-weight-bold)',
          color: 'var(--credence-text-primary)',
          marginBottom: 'var(--credence-space-2)',
        }}
      >
        Page Not Found
      </h1>

      {/* Subheading */}
      <p
        style={{
          fontSize: 'var(--credence-font-size-lg)',
          fontWeight: 'var(--credence-font-weight-semibold)',
          color: 'var(--credence-color-danger-text)',
          marginBottom: 'var(--credence-space-4)',
        }}
      >
        404
      </p>

      {/* Description */}
      <p
        style={{
          color: 'var(--credence-text-secondary)',
          fontSize: 'var(--credence-font-size-sm)',
          lineHeight: 'var(--credence-line-height-base)',
          marginBottom: 'var(--credence-space-6)',
        }}
      >
        The page you're looking for doesn't exist. It may have been moved or removed.
      </p>

      {/* Recovery Actions */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--credence-space-3)',
          width: '100%',
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            padding: 'var(--credence-space-3) var(--credence-space-6)',
            background: 'var(--credence-color-primary-soft)',
            color: 'var(--credence-color-white)',
            border: 'none',
            borderRadius: 'var(--credence-radius-lg)',
            fontWeight: 'var(--credence-font-weight-semibold)',
            fontSize: 'var(--credence-font-size-sm)',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--credence-color-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--credence-color-primary-soft)'
          }}
        >
          Back to Home
        </button>

        <button
          onClick={() => navigate(-1)}
          style={{
            padding: 'var(--credence-space-3) var(--credence-space-6)',
            background: 'transparent',
            color: 'var(--credence-text-primary)',
            border: '1px solid var(--credence-border-default)',
            borderRadius: 'var(--credence-radius-lg)',
            fontWeight: 'var(--credence-font-weight-semibold)',
            fontSize: 'var(--credence-font-size-sm)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--credence-border-default)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          Go Back
        </button>
      </div>

      {/* Secondary Help Text */}
      <p
        style={{
          color: 'var(--credence-text-secondary)',
          fontSize: 'var(--credence-font-size-xs)',
          lineHeight: 'var(--credence-line-height-sm)',
          marginTop: 'var(--credence-space-6)',
        }}
      >
        Use the navigation above to find what you're looking for, or{' '}
        <a
          href="/"
          style={{
            color: 'var(--credence-color-primary)',
            textDecoration: 'none',
            fontWeight: 'var(--credence-font-weight-semibold)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.textDecoration = 'underline'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.textDecoration = 'none'
          }}
        >
          return home
        </a>
        .
      </p>
    </div>
  )
}
