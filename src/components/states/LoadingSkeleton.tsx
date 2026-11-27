import './LoadingSkeleton.css'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface LoadingSkeletonProps {
  variant?:
    | 'text'
    | 'card'
    | 'form'
    | 'table'
    | 'dashboard'
    | 'stat-widget'
    | 'list-row'
    | 'bond-row'
    | 'trust-score'
  rows?: number
  width?: string
  height?: string
}

export default function LoadingSkeleton({
  variant = 'text',
  rows = 3,
  width = '100%',
  height,
}: LoadingSkeletonProps) {
  // Honor prefers-reduced-motion at the JS layer: when the user requests reduced
  // motion we omit the shimmer animation entirely instead of relying on the
  // global CSS override. Components that control animation via inline styles
  // need an explicit JS signal so the choice also propagates to any future
  // imperative animation logic.
  const prefersReducedMotion = useReducedMotion()

  // Base inline style used by the original variants (kept for backward-compat
  // with tests that check inline style properties).
  const baseStyle = {
    background: 'var(--credence-skeleton-gradient)',
    backgroundSize: '200% 100%',
    ...(prefersReducedMotion ? {} : { animation: 'var(--credence-motion-skeleton)' }),
    borderRadius: 'var(--credence-radius-lg)',
  }

  // CSS-class helper used by the new variants.
  const baseClass = ['skeleton', prefersReducedMotion ? 'skeleton--no-animation' : '']
    .filter(Boolean)
    .join(' ')

  // -------------------------------------------------------------------------
  // Existing variants — preserved AS IS to keep test expectations intact
  // -------------------------------------------------------------------------

  if (variant === 'text') {
    return (
      <div style={{ width }} role="status" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              height: '1rem',
              marginBottom: i < rows - 1 ? '0.75rem' : '0',
              width: i === rows - 1 ? '60%' : '100%',
            }}
          />
        ))}
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div
        style={{
          border: '1px solid var(--credence-border-default)',
          borderRadius: 'var(--credence-radius-xl)',
          padding: 'var(--credence-space-6)',
          width,
        }}
        role="status"
        aria-label="Loading"
      >
        <div style={{ ...baseStyle, height: '1.5rem', width: '40%', marginBottom: '1rem' }} />
        <div style={{ ...baseStyle, height: '1rem', marginBottom: '0.5rem' }} />
        <div style={{ ...baseStyle, height: '1rem', width: '80%' }} />
      </div>
    )
  }

  if (variant === 'form') {
    return (
      <div style={{ width }} role="status" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ marginBottom: '1.5rem' }}>
            <div
              style={{ ...baseStyle, height: '0.875rem', width: '30%', marginBottom: '0.5rem' }}
            />
            <div style={{ ...baseStyle, height: '2.75rem' }} />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div style={{ width }} role="status" aria-label="Loading">
        <div style={{ ...baseStyle, height: '3rem', marginBottom: '0.5rem' }} />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ ...baseStyle, height: '3.5rem', marginBottom: '0.5rem' }} />
        ))}
      </div>
    )
  }

  if (variant === 'dashboard') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          width,
        }}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              height: '120px',
              padding: 'var(--credence-space-6)',
              border: '1px solid var(--credence-border-default)',
              borderRadius: 'var(--credence-radius-xl)',
            }}
          />
        ))}
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // New variants — use CSS classes for styling
  // -------------------------------------------------------------------------

  if (variant === 'stat-widget') {
    return (
      <div
        className="skeleton--stat-widget"
        style={{ width }}
        role="status"
        aria-label="Loading"
      >
        <div className={`${baseClass} skeleton--stat-label`} />
        <div className={`${baseClass} skeleton--stat-value`} />
        <div className={`${baseClass} skeleton--stat-sub`} />
      </div>
    )
  }

  if (variant === 'list-row') {
    return (
      <div
        className="skeleton-wrapper"
        style={{ width }}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton--list-row">
            <div className={`${baseClass} skeleton--list-avatar`} />
            <div className="skeleton--list-content">
              <div className={`${baseClass} skeleton--list-title`} />
              <div className={`${baseClass} skeleton--list-sub`} />
            </div>
            <div className={`${baseClass} skeleton--list-meta`} />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'bond-row') {
    return (
      <div
        className="skeleton-wrapper"
        style={{ width }}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton--bond-row">
            <div className="skeleton--bond-left">
              <div className={`${baseClass} skeleton--bond-amount`} />
              <div className={`${baseClass} skeleton--bond-status`} />
            </div>
            <div className="skeleton--bond-right">
              <div className={`${baseClass} skeleton--bond-btn`} />
              <div className={`${baseClass} skeleton--bond-btn`} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'trust-score') {
    return (
      <div
        className="skeleton--trust-score-page"
        style={{ width }}
        role="status"
        aria-label="Loading"
      >
        <div className="skeleton--trust-score-header">
          <div className={`${baseClass} skeleton--trust-gauge`} />
          <div className={`${baseClass} skeleton--trust-tier-badge`} />
        </div>
        <div className="skeleton--trust-stats-row">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className={`${baseClass} skeleton--trust-stat-card`} />
          ))}
        </div>
      </div>
    )
  }

  // Fallback — generic block
  return (
    <div
      style={{ ...baseStyle, width, height: height || '4rem' }}
      role="status"
      aria-label="Loading"
    />
  )
}
