# Implementation Examples

This document provides practical code examples for implementing empty states, error states, and loading skeletons in Credence Frontend pages.

---

## Bond Page Examples

### Complete Bond Page with States

```tsx
import { useState } from 'react'
import EmptyState from '../components/states/EmptyState'
import ErrorState from '../components/states/ErrorState'
import LoadingSkeleton from '../components/states/LoadingSkeleton'

export default function Bond() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasBond, setHasBond] = useState(false)

  // Simulated data fetch
  const { data: bondData, isLoading: isFetching, error: fetchError } = useBondData()

  if (isFetching) {
    return (
      <div>
        <h1 style={{ marginBottom: '0.5rem' }}>Bond USDC</h1>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
          Lock USDC into the Credence contract to build your economic reputation.
        </p>
        <LoadingSkeleton variant="form" rows={2} width="24rem" />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div>
        <h1 style={{ marginBottom: '0.5rem' }}>Bond USDC</h1>
        <ErrorState
          type="network"
          action={{
            label: "Try again",
            onClick: () => window.location.reload()
          }}
        />
      </div>
    )
  }

  if (!bondData || bondData.length === 0) {
    return (
      <div>
        <h1 style={{ marginBottom: '0.5rem' }}>Bond USDC</h1>
        <EmptyState
          illustration="bond"
          title="No bond created yet"
          description="Lock USDC into Credence to build your economic reputation and unlock trust-based opportunities."
          action={{
            label: "Create your first bond",
            onClick: () => setHasBond(true)
          }}
        />
      </div>
    )
  }

  // Regular bond form
  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Bond USDC</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Lock USDC into the Credence contract to build your economic reputation.
      </p>
      {/* Bond form implementation */}
    </div>
  )
}
```

---

## Trust Score Page Examples

### Trust Score with All States

```tsx
import { useState } from 'react'
import EmptyState from '../components/states/EmptyState'
import ErrorState from '../components/states/ErrorState'
import LoadingSkeleton from '../components/states/LoadingSkeleton'

export default function TrustScore() {
  const [address, setAddress] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scoreData, setScoreData] = useState<any>(null)

  const handleLookup = async () => {
    setIsSearching(true)
    setError(null)

    try {
      // Validate address format
      if (!address.startsWith('G') || address.length !== 56) {
        throw new Error('invalid_address')
      }

      // Simulated API call
      const response = await fetch(`/api/trust-score/${address}`)
      
      if (!response.ok) {
        throw new Error('backend_error')
      }

      const data = await response.json()
      setScoreData(data)
    } catch (err: any) {
      if (err.message === 'invalid_address') {
        setError('validation')
      } else if (err.message === 'backend_error') {
        setError('backend')
      } else {
        setError('network')
      }
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Trust Score</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Your reputation score is computed from bond amount, duration, and attestations.
      </p>

      {/* Search Form */}
      <div style={{ maxWidth: '24rem', marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Identity / Wallet address
        </label>
        <input
          type="text"
          placeholder="G..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '1rem',
            marginBottom: '1rem',
          }}
        />
        <button
          onClick={handleLookup}
          disabled={isSearching}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isSearching ? 'Looking up...' : 'Look up score'}
        </button>
      </div>

      {/* States */}
      {isSearching && (
        <LoadingSkeleton variant="card" width="24rem" />
      )}

      {error === 'validation' && (
        <ErrorState
          type="validation"
          title="Invalid wallet address"
          message="Please enter a valid Stellar address starting with 'G' and containing 56 characters."
          action={{
            label: "Try again",
            onClick: () => setError(null)
          }}
        />
      )}

      {error === 'backend' && (
        <ErrorState
          type="backend"
          action={{
            label: "Retry",
            onClick: handleLookup
          }}
        />
      )}

      {error === 'network' && (
        <ErrorState
          type="network"
          action={{
            label: "Try again",
            onClick: handleLookup
          }}
        />
      )}

      {!isSearching && !error && scoreData === null && address && (
        <EmptyState
          illustration="trust"
          title="No trust score found"
          description="This address hasn't established a trust score yet. Create a bond and gather attestations to build reputation."
        />
      )}

      {scoreData && (
        <div style={{
          maxWidth: '24rem',
          padding: '1.5rem',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#fff',
        }}>
          <h3>Trust Score: {scoreData.score}</h3>
          {/* Score details */}
        </div>
      )}
    </div>
  )
}
```

---

## Home Page Examples

### Home with Highlights and Empty States

```tsx
import { Link } from 'react-router-dom'
import EmptyState from '../components/states/EmptyState'
import LoadingSkeleton from '../components/states/LoadingSkeleton'

export default function Home() {
  const { data: highlights, isLoading } = useHighlights()

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Credence — Economic Trust</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        On-chain economic identity on Stellar. Stake USDC as a programmable reputation bond.
      </p>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
        <Link
          to="/bond"
          style={{
            padding: '0.75rem 1.25rem',
            background: '#0ea5e9',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 600,
          }}
        >
          Create bond
        </Link>
        <Link
          to="/trust"
          style={{
            padding: '0.75rem 1.25rem',
            background: '#e2e8f0',
            color: '#0f172a',
            borderRadius: '8px',
            fontWeight: 600,
          }}
        >
          View trust score
        </Link>
      </div>

      {/* Highlights Section */}
      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Activity</h2>
        
        {isLoading ? (
          <LoadingSkeleton variant="dashboard" rows={3} />
        ) : highlights && highlights.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}>
            {highlights.map((item: any) => (
              <div key={item.id} style={{
                padding: '1.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                background: '#fff'
              }}>
                {/* Highlight card content */}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            illustration="activity"
            title="No activity yet"
            description="Your bonds, attestations, and governance participation will appear here."
            action={{
              label: "Create your first bond",
              onClick: () => window.location.href = '/bond'
            }}
          />
        )}
      </section>
    </div>
  )
}
```

---

## Activity/Governance Page Examples

### Activity with Multiple Empty States

```tsx
import { useState } from 'react'
import EmptyState from '../components/states/EmptyState'
import LoadingSkeleton from '../components/states/LoadingSkeleton'

export default function Activity() {
  const [activeTab, setActiveTab] = useState<'disputes' | 'attestations'>('disputes')
  const { data: disputes, isLoading: loadingDisputes } = useDisputes()
  const { data: attestations, isLoading: loadingAttestations } = useAttestations()

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Activity & Governance</h1>
      <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Track your disputes, attestations, and governance participation.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setActiveTab('disputes')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'disputes' ? '2px solid #0ea5e9' : 'none',
            fontWeight: activeTab === 'disputes' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          Disputes
        </button>
        <button
          onClick={() => setActiveTab('attestations')}
          style={{
            padding: '0.75rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'attestations' ? '2px solid #0ea5e9' : 'none',
            fontWeight: activeTab === 'attestations' ? 600 : 400,
            cursor: 'pointer',
          }}
        >
          Attestations
        </button>
      </div>

      {/* Disputes Tab */}
      {activeTab === 'disputes' && (
        <>
          {loadingDisputes ? (
            <LoadingSkeleton variant="table" rows={5} />
          ) : disputes && disputes.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              {/* Table content */}
            </table>
          ) : (
            <EmptyState
              illustration="dispute"
              title="No disputes"
              description="You have no active or past disputes. Your reputation remains intact."
            />
          )}
        </>
      )}

      {/* Attestations Tab */}
      {activeTab === 'attestations' && (
        <>
          {loadingAttestations ? (
            <LoadingSkeleton variant="table" rows={5} />
          ) : attestations && attestations.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              {/* Table content */}
            </table>
          ) : (
            <EmptyState
              illustration="attestation"
              title="No attestations yet"
              description="Attestations from trusted parties strengthen your reputation. Complete transactions and request attestations to build trust."
              action={{
                label: "Request attestation",
                onClick: () => console.log('Navigate to attestation request')
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
```

---

## Reusable Hooks

### useAsyncState Hook

```tsx
import { useState, useCallback } from 'react'

interface AsyncState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  execute: (...args: any[]) => Promise<void>
  reset: () => void
}

export function useAsyncState<T>(
  asyncFunction: (...args: any[]) => Promise<T>
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(
    async (...args: any[]) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await asyncFunction(...args)
        setData(result)
      } catch (err: any) {
        setError(err.message || 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    },
    [asyncFunction]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setIsLoading(false)
  }, [])

  return { data, isLoading, error, execute, reset }
}
```

### Usage Example

```tsx
function MyComponent() {
  const { data, isLoading, error, execute } = useAsyncState(fetchData)

  useEffect(() => {
    execute()
  }, [])

  if (isLoading) return <LoadingSkeleton variant="card" />
  if (error) return <ErrorState type="network" />
  if (!data) return <EmptyState {...config} />

  return <Content data={data} />
}
```

---

## Testing Examples

### Testing Empty States

```tsx
import { render, screen } from '@testing-library/react'
import EmptyState from '../components/states/EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="No data"
        description="No data available"
      />
    )

    expect(screen.getByText('No data')).toBeInTheDocument()
    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    const handleClick = jest.fn()
    
    render(
      <EmptyState
        title="No data"
        description="No data available"
        action={{
          label: "Add data",
          onClick: handleClick
        }}
      />
    )

    const button = screen.getByRole('button', { name: 'Add data' })
    button.click()
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Testing Error States

```tsx
import { render, screen } from '@testing-library/react'
import ErrorState from '../components/states/ErrorState'

describe('ErrorState', () => {
  it('renders network error with default message', () => {
    render(<ErrorState type="network" />)

    expect(screen.getByText('Connection issue')).toBeInTheDocument()
    expect(screen.getByText(/Unable to connect/)).toBeInTheDocument()
  })

  it('renders custom error message', () => {
    render(
      <ErrorState
        type="generic"
        title="Custom error"
        message="Custom message"
      />
    )

    expect(screen.getByText('Custom error')).toBeInTheDocument()
    expect(screen.getByText('Custom message')).toBeInTheDocument()
  })
})
```

---

## Accessibility Guidelines

### ARIA Attributes

```tsx
// Loading State
<div role="status" aria-live="polite" aria-label="Loading content">
  <LoadingSkeleton variant="card" />
</div>

// Error State
<div role="alert" aria-live="assertive">
  <ErrorState type="network" />
</div>

// Empty State with Action
<EmptyState
  title="No data"
  description="Add your first item"
  action={{
    label: "Add item",
    onClick: handleAdd,
    // Button should be keyboard accessible by default
  }}
/>
```

### Keyboard Navigation

Ensure all interactive elements in states are keyboard accessible:

```tsx
<button
  onClick={handleAction}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleAction()
    }
  }}
  style={{ cursor: 'pointer' }}
>
  Action
</button>
```

---

## Performance Considerations

### Lazy Loading States

```tsx
import { lazy, Suspense } from 'react'
import LoadingSkeleton from '../components/states/LoadingSkeleton'

const HeavyComponent = lazy(() => import('./HeavyComponent'))

function MyPage() {
  return (
    <Suspense fallback={<LoadingSkeleton variant="dashboard" rows={3} />}>
      <HeavyComponent />
    </Suspense>
  )
}
```

### Debounced Loading States

```tsx
import { useState, useEffect } from 'react'

function useDelayedLoading(isLoading: boolean, delay = 300) {
  const [showLoading, setShowLoading] = useState(false)

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setShowLoading(true), delay)
      return () => clearTimeout(timer)
    } else {
      setShowLoading(false)
    }
  }, [isLoading, delay])

  return showLoading
}

// Usage: Only show loading state if operation takes > 300ms
function MyComponent() {
  const { isLoading } = useQuery()
  const showLoading = useDelayedLoading(isLoading)

  if (showLoading) return <LoadingSkeleton variant="card" />
  // ...
}
```
