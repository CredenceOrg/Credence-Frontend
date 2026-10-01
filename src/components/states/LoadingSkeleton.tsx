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

const DEFAULT_ROWS = 3
const MAX_SAFE_ROWS = 24

function sanitizeRows(value: number | undefined): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return DEFAULT_ROWS
  if (value <= 0) return DEFAULT_ROWS
  return Math.min(value, MAX_SAFE_ROWS)
}

function sanitizeCssSize(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

export default function LoadingSkeleton({
  variant = 'text',
  rows = DEFAULT_ROWS,
  width = '100%',
  height,
}: LoadingSkeletonProps) {
  const safeVariant = typeof variant === 'string' ? variant : 'text'
  const safeRows = sanitizeRows(rows)
  const safeWidth = sanitizeCssSize(width, '100%')
  const safeHeight = sanitizeCssSize(height, '4rem')

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

  if (safeVariant === 'text') {
    return (
      <div style={{ width: safeWidth }} role="status" aria-label="Loading">
        {Array.from({ length: safeRows }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              height: '1rem',
              marginBottom: i < safeRows - 1 ? '0.75rem' : '0',
              width: i === safeRows - 1 ? '60%' : '100%',
            }}
          />
        ))}
      </div>
    )
  }

  if (safeVariant === 'card') {
    return (
      <div
        style={{
          border: '1px solid var(--credence-border-default)',
          borderRadius: 'var(--credence-radius-xl)',
          padding: 'var(--credence-space-6)',
          width: safeWidth,
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

  if (safeVariant === 'form') {
    return (
      <div style={{ width: safeWidth }} role="status" aria-label="Loading">
        {Array.from({ length: safeRows }).map((_, i) => (
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

  if (safeVariant === 'table') {
    return (
      <div style={{ width: safeWidth }} role="status" aria-label="Loading">
        <div style={{ ...baseStyle, height: '3rem', marginBottom: '0.5rem' }} />
        {Array.from({ length: safeRows }).map((_, i) => (
          <div key={i} style={{ ...baseStyle, height: '3.5rem', marginBottom: '0.5rem' }} />
        ))}
      </div>
    )
  }

  if (safeVariant === 'dashboard') {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1rem',
          width: safeWidth,
        }}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: safeRows }).map((_, i) => (
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

  if (safeVariant === 'stat-widget') {
    return (
      <div
        className="skeleton--stat-widget"
        style={{ width: safeWidth }}
        role="status"
        aria-label="Loading"
      >
        <div className={`${baseClass} skeleton--stat-label`} />
        <div className={`${baseClass} skeleton--stat-value`} />
        <div className={`${baseClass} skeleton--stat-sub`} />
      </div>
    )
  }

  if (safeVariant === 'list-row') {
    return (
      <div
        className="skeleton-wrapper"
        style={{ width: safeWidth }}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: safeRows }).map((_, i) => (
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

  if (safeVariant === 'bond-row') {
    return (
      <div
        className="skeleton-wrapper"
        style={{ width: safeWidth }}
        role="status"
        aria-label="Loading"
      >
        {Array.from({ length: safeRows }).map((_, i) => (
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

  if (safeVariant === 'trust-score') {
    return (
      <div
        className="skeleton--trust-score-page"
        style={{ width: safeWidth }}
        role="status"
        aria-label="Loading"
      >
        <div className="skeleton--trust-score-header">
          <div className={`${baseClass} skeleton--trust-gauge`} />
          <div className={`${baseClass} skeleton--trust-tier-badge`} />
        </div>
        <div className="skeleton--trust-stats-row">
          {Array.from({ length: safeRows }).map((_, i) => (
            <div key={i} className={`${baseClass} skeleton--trust-stat-card`} />
          ))}
        </div>
      </div>
    )
  }

  // Fallback — generic block
  return (
    <div
      style={{ ...baseStyle, width: safeWidth, height: safeHeight }}
      role="status"
      aria-label="Loading"
    />
  )
}
