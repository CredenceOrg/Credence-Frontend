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
  const baseStyle = {
    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '8px',
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
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.5rem',
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
            <div style={{ ...baseStyle, height: '0.875rem', width: '30%', marginBottom: '0.5rem' }} />
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', width }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              height: '120px',
              padding: '1.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
            }}
          />
        ))}
      </div>
    )
  }

  return <div style={{ ...baseStyle, width, height: height || '4rem' }} />
}
