import { useReducedMotion } from '../../hooks/useReducedMotion'

interface LoadingSkeletonProps {
  variant?: 'text' | 'card' | 'form' | 'table' | 'dashboard'
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
  const baseStyle = {
    background: 'var(--credence-skeleton-gradient)',
    backgroundSize: '200% 100%',
    ...(prefersReducedMotion ? {} : { animation: 'var(--credence-motion-skeleton)' }),
    borderRadius: 'var(--credence-radius-lg)',
  }

  if (variant === 'text') {
    return (
      <div style={{ width }}>
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
      >
        <div style={{ ...baseStyle, height: '1.5rem', width: '40%', marginBottom: '1rem' }} />
        <div style={{ ...baseStyle, height: '1rem', marginBottom: '0.5rem' }} />
        <div style={{ ...baseStyle, height: '1rem', width: '80%' }} />
      </div>
    )
  }

  if (variant === 'form') {
    return (
      <div style={{ width }}>
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
      <div style={{ width }}>
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

  return <div style={{ ...baseStyle, width, height: height || '4rem' }} />
}
