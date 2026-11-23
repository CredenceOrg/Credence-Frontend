# Mutation System Integration Guide

This guide explains how to integrate the race-safe mutation system into existing components and handle the different error scenarios correctly.

## Quick Start: Adding Mutation to a Component

### Step 1: Import Required Functions

```typescript
import { useMutation } from '@/hooks/useMutation'
import { createIdempotencyKey } from '@/lib/mutationManager'
```

### Step 2: Set Up the Hook

```typescript
function BondCreateComponent() {
  const { 
    mutate,        // Async function to call
    isLoading,     // Loading state
    error,         // Error object or null
    errorCategory, // 'network' | 'rateLimit' | 'validation' | 'authorization' | 'server' | 'unknown'
    attempts,      // Number of attempts (including retries)
    isRetry,       // Whether this is a retry result
    data,          // Result data (Bond | null)
    reset,         // Reset to initial state
  } = useMutation<Bond>({
    onStart: () => {
      console.log('Mutation started')
    },
    onSuccess: (bond) => {
      console.log('Bond created:', bond)
      showSuccessNotification('Bond created successfully')
    },
    onError: (error, category) => {
      console.error('Mutation failed:', error, category)
      // Handle category-specific errors
    },
    onSettled: (data, error) => {
      console.log('Mutation settled (success or error)')
    },
  })

  // Rest of component...
}
```

### Step 3: Create Handler Function

```typescript
const handleCreateBond = async (amount: number, address: string) => {
  // Generate deterministic idempotency key
  // Same params = same key = safe to retry
  const idempotencyKey = createIdempotencyKey(
    '/api/bonds',
    'POST',
    { amount, address }
  )

  try {
    const bond = await mutate(
      async () => {
        const response = await fetch('/api/bonds', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            amount,
            address,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        return response.json()
      },
      // Optional: explicit idempotency key (used for dedup)
      { idempotencyKey }
    )

    console.log('Bond created:', bond)
    return bond
  } catch (error) {
    console.error('Failed to create bond:', error)
    throw error
  }
}
```

### Step 4: Render with Error Handling

```typescript
return (
  <div className="bond-create">
    <BondForm onSubmit={handleCreateBond} disabled={isLoading} />
    
    {isLoading && <LoadingSpinner />}
    
    {error && (
      <ErrorDisplay
        error={error}
        category={errorCategory}
        attempts={attempts}
        isRetry={isRetry}
        onRetry={() => handleCreateBond(lastAmount, lastAddress)}
      />
    )}
    
    {data && <BondSuccessCard bond={data} />}
  </div>
)
```

## Error Handling Patterns

### Pattern 1: Network Errors (Automatic Retry)

```typescript
const { error, errorCategory, isLoading } = useMutation<Bond>({
  onError: (error, category) => {
    if (category === 'network') {
      // Network errors automatically retry
      // No need to show retry button - system handles it
      // But you can show a "Retrying..." message
      return <RetryingMessage />
    }
  },
})
```

### Pattern 2: Rate Limiting (Show Wait Time)

```typescript
const { error, errorCategory } = useMutation<Bond>({
  onError: (error, category) => {
    if (category === 'rateLimit') {
      // Rate limited - user should wait and retry
      return (
        <RateLimitedMessage>
          You've made too many requests. Please wait a few moments and try again.
        </RateLimitedMessage>
      )
    }
  },
})
```

### Pattern 3: Validation Errors (Show Form Error)

```typescript
const { error, errorCategory } = useMutation<Bond>({
  onError: (error, category) => {
    if (category === 'validation') {
      // Validation error - show specific message
      return (
        <FormError message={error.message}>
          The bond amount must be a positive number.
        </FormError>
      )
    }
  },
})
```

### Pattern 4: Authorization Errors (Redirect to Login)

```typescript
const { error, errorCategory } = useMutation<Bond>({
  onError: (error, category) => {
    if (category === 'authorization') {
      // Not authorized - redirect to login
      localStorage.setItem('redirectAfterLogin', '/bonds')
      window.location.href = '/login'
    }
  },
})
```

### Pattern 5: Server Errors (Show Error, Allow Retry)

```typescript
const { error, errorCategory, mutate } = useMutation<Bond>({
  onError: (error, category) => {
    if (category === 'server') {
      // Server error - show error but allow retry
      return (
        <ServerErrorCard 
          error={error}
          onRetry={handleRetry}
        />
      )
    }
  },
})
```

### Pattern 6: Unknown Errors (Generic Fallback)

```typescript
const { error, errorCategory } = useMutation<Bond>({
  onError: (error, category) => {
    // Unknown error - generic message
    if (category === 'unknown') {
      return (
        <ErrorCard>
          An unexpected error occurred. Please try again.
          <details>
            <summary>Details</summary>
            <code>{error.message}</code>
          </details>
        </ErrorCard>
      )
    }
  },
})
```

## Complete Component Example: Bond Create

```typescript
import React, { useState } from 'react'
import { useMutation } from '@/hooks/useMutation'
import { createIdempotencyKey } from '@/lib/mutationManager'

interface Bond {
  id: string
  amount: number
  address: string
  status: 'pending' | 'active' | 'withdrawn'
  createdAt: string
}

function BondCreateDialog({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')

  const {
    mutate,
    isLoading,
    error,
    errorCategory,
    attempts,
    data: bond,
  } = useMutation<Bond>({
    onSuccess: (bond) => {
      // Close dialog after 2 seconds to show success
      setTimeout(onClose, 2000)
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || !address) {
      alert('Please fill in all fields')
      return
    }

    const bondAmount = parseFloat(amount)
    if (isNaN(bondAmount) || bondAmount <= 0) {
      alert('Amount must be a positive number')
      return
    }

    const idempotencyKey = createIdempotencyKey(
      '/api/bonds',
      'POST',
      { amount: bondAmount, address }
    )

    try {
      await mutate(
        async () => {
          const response = await fetch('/api/bonds', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({
              amount: bondAmount,
              address,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || `HTTP ${response.status}`)
          }

          return response.json() as Promise<Bond>
        },
        { idempotencyKey }
      )
    } catch (err) {
      console.error('Unexpected error:', err)
    }
  }

  if (bond) {
    return (
      <dialog open onClose={onClose}>
        <h2>Bond Created Successfully!</h2>
        <p>Bond ID: {bond.id}</p>
        <p>Amount: {bond.amount} USDC</p>
        <p>Address: {bond.address}</p>
        <button onClick={onClose}>Close</button>
      </dialog>
    )
  }

  return (
    <dialog open onClose={onClose}>
      <h2>Create New Bond</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="amount">Amount (USDC)</label>
          <input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isLoading}
            placeholder="1000"
          />
        </div>

        <div>
          <label htmlFor="address">Wallet Address</label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isLoading}
            placeholder="0x..."
          />
        </div>

        {isLoading && (
          <div className="loading">
            {attempts > 1 ? `Retrying (Attempt ${attempts})...` : 'Creating bond...'}
          </div>
        )}

        {error && (
          <div className="error">
            {renderError(error, errorCategory)}
          </div>
        )}

        <div className="actions">
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Bond'}
          </button>
          <button type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}

function renderError(error: Error, category: string): React.ReactNode {
  switch (category) {
    case 'network':
      return (
        <p>
          Network error - retrying automatically...
          <br />
          <small>{error.message}</small>
        </p>
      )
    case 'rateLimit':
      return (
        <p>
          You've made too many requests. Please wait a moment and try again.
          <br />
          <small>{error.message}</small>
        </p>
      )
    case 'validation':
      return <p>Invalid input: {error.message}</p>
    case 'authorization':
      return (
        <p>
          You don't have permission to create bonds.
          <br />
          <a href="/login">Sign in again</a>
        </p>
      )
    case 'server':
      return (
        <p>
          Server error - please try again
          <br />
          <small>{error.message}</small>
        </p>
      )
    default:
      return (
        <p>
          An unexpected error occurred
          <br />
          <small>{error.message}</small>
        </p>
      )
  }
}

export default BondCreateDialog
```

## Testing Mutations in Components

### Unit Test with vitest

```typescript
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMutation } from '@/hooks/useMutation'

describe('useMutation', () => {
  it('creates a bond successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'bond-123', amount: 1000 }),
    })
    global.fetch = mockFetch

    const { result } = renderHook(() => useMutation<{ id: string }>())

    let mutationResult
    await act(async () => {
      mutationResult = await result.current.mutate(async () => ({
        id: 'bond-123',
        amount: 1000,
      }))
    })

    expect(mutationResult.data).toEqual({ id: 'bond-123', amount: 1000 })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('handles network errors with retry', async () => {
    let attempts = 0
    const mockFn = vi.fn().mockImplementation(() => {
      attempts++
      if (attempts < 3) {
        throw new Error('Network request failed')
      }
      return { id: 'bond-123' }
    })

    const { result } = renderHook(() => useMutation<{ id: string }>())

    await act(async () => {
      await result.current.mutate(mockFn)
    })

    // Should have retried and eventually succeeded
    expect(mockFn).toHaveBeenCalled()
    expect(result.current.data).toEqual({ id: 'bond-123' })
    expect(result.current.attempts).toBeGreaterThan(1)
  })

  it('handles validation errors immediately', async () => {
    const mockFn = vi.fn().mockRejectedValue(
      new Error('Amount must be positive')
    )

    const { result } = renderHook(() => useMutation<{ id: string }>())

    await act(async () => {
      try {
        await result.current.mutate(mockFn)
      } catch (err) {
        // Expected to throw
      }
    })

    expect(result.current.error).not.toBeNull()
    expect(result.current.attempts).toBe(1) // No retry
    expect(result.current.errorCategory).toMatch(/validation|unknown/)
  })
})
```

## Concurrency Scenarios in Components

### Scenario: Rapid Multiple Mutations

```typescript
function BondBulkCreateComponent() {
  const { mutate } = useMutation<Bond>()

  const handleBulkCreate = async () => {
    // These mutations have different idempotency keys
    // They will execute concurrently (independent)
    const amounts = [100, 200, 300]
    
    const promises = amounts.map((amount) =>
      mutate(async () => {
        const key = createIdempotencyKey(
          '/api/bonds',
          'POST',
          { amount }
        )
        
        const response = await fetch('/api/bonds', {
          method: 'POST',
          headers: { 'X-Idempotency-Key': key },
          body: JSON.stringify({ amount }),
        })
        return response.json()
      })
    )

    // All execute in parallel
    const bonds = await Promise.all(promises)
    console.log('Created', bonds.length, 'bonds')
  }

  return <button onClick={handleBulkCreate}>Create Multiple Bonds</button>
}
```

### Scenario: Accidental Double-Click Protection

```typescript
function BondCreateButton() {
  const { mutate, isLoading } = useMutation<Bond>()
  const [lastKey, setLastKey] = useState<string | null>(null)

  const handleCreateBond = async (amount: number) => {
    // Generate key
    const key = createIdempotencyKey('/api/bonds', 'POST', { amount })
    
    // If same request already in flight, mutation will deduplicate
    // Both calls await the same promise
    if (key === lastKey && isLoading) {
      console.log('Request already in flight, deduplicating...')
    }

    setLastKey(key)

    try {
      const bond = await mutate(
        async () => {
          const response = await fetch('/api/bonds', {
            method: 'POST',
            headers: { 'X-Idempotency-Key': key },
            body: JSON.stringify({ amount }),
          })
          return response.json()
        },
        { idempotencyKey: key }
      )
      
      console.log('Bond created:', bond)
    } finally {
      setLastKey(null)
    }
  }

  return (
    // Even if user clicks button 5 times rapidly with same amount,
    // mutation only executes once and all 5 click handlers receive same result
    <button onClick={() => handleCreateBond(1000)} disabled={isLoading}>
      Create Bond
    </button>
  )
}
```

## Migration from Legacy Code

### Before (Manual Retry)

```typescript
const handleCreateBond = async (amount: number) => {
  let lastError
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch('/api/bonds', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      })
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        const delay = 500 * Math.pow(2, attempt)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}
```

### After (Using Mutation System)

```typescript
const { mutate } = useMutation<Bond>()

const handleCreateBond = async (amount: number) => {
  return await mutate(
    async () => {
      const response = await fetch('/api/bonds', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      })
      return response.json()
    }
  )
}
```

**Benefits:**
- ✓ Retry logic centralized
- ✓ Automatic error categorization
- ✓ Deduplication for free
- ✓ Event emission for monitoring
- ✓ Lifecycle callbacks
- ✓ Tested and proven in production

## Server-Side Idempotency (Required)

The client-side deduplication handles preventing redundant executions in the same browser process. For full protection, especially for financial operations, the server MUST also check idempotency keys:

### Express.js Example

```typescript
import { Router } from 'express'
import Redis from 'redis'

const router = Router()
const redis = new Redis()

router.post('/api/bonds', async (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key']
  
  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'Missing X-Idempotency-Key header',
    })
  }

  // Check cache for previous result
  const cached = await redis.get(`idempotency:${idempotencyKey}`)
  if (cached) {
    console.log('Idempotent request - returning cached result')
    return res.json(JSON.parse(cached))
  }

  // Process new request
  try {
    const bond = await Bond.create(req.body)
    
    // Cache result with TTL (24 hours)
    await redis.setex(
      `idempotency:${idempotencyKey}`,
      86400,
      JSON.stringify(bond)
    )
    
    res.json(bond)
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message,
    })
  }
})

export default router
```

## Monitoring and Debugging

### Enable Event Logging

```typescript
import { getGlobalMutationManager } from '@/lib/mutationManager'

const manager = getGlobalMutationManager()

manager.onEvent((event) => {
  console.group(`[Mutation] ${event.type}`)
  console.log('Key:', event.key)
  console.log('Timestamp:', new Date(event.timestamp))
  
  if (event.type === 'retrying') {
    console.log('Attempt:', event.attempt)
    console.log('Next retry in:', event.nextRetryDelayMs, 'ms')
  }
  
  if (event.type === 'succeeded') {
    console.log('Result:', event.result)
  }
  
  if (event.type === 'failed') {
    console.log('Error:', event.error)
    console.log('Is transient:', event.isTransient)
  }
  
  console.groupEnd()
})
```

### Monitor in Analytics

```typescript
manager.onEvent((event) => {
  if (event.type === 'succeeded') {
    analytics.track('mutation_success', {
      key: event.key,
      attempts: event.attempt || 1,
      isRetry: event.attempt > 1,
    })
  }
  
  if (event.type === 'failed') {
    analytics.track('mutation_failed', {
      key: event.key,
      error: event.error.message,
      category: event.error.category,
      isTransient: event.isTransient,
      attempts: event.attempt || 1,
    })
  }
})
```

## Troubleshooting

### "Cannot read properties of null (reading 'mutate')"

This occurs when the global mutation manager is not initialized. Usually indicates:
- Hook rendered in isolation without proper setup
- Test suite cleanup not working correctly

**Fix**: Call `resetGlobalMutationManager()` in test setup:

```typescript
import { resetGlobalMutationManager } from '@/lib/mutationManager'

beforeEach(() => {
  resetGlobalMutationManager()
})
```

### Mutation executes multiple times for same parameters

This could happen if:
- Idempotency key is not deterministic (includes random data)
- Different components using different keys for same request

**Fix**: Verify idempotency key generation:

```typescript
// ✓ Correct - deterministic
const key = createIdempotencyKey('/api/bonds', 'POST', { amount: 1000 })

// ✗ Wrong - includes random data
const key = createIdempotencyKey('/api/bonds', 'POST', {
  amount: 1000,
  requestId: Math.random(), // Don't include this!
})
```

### Retries happening too often

Check if error is being categorized as transient when it shouldn't be:

```typescript
// Debug: log error categorization
const { mutate } = useMutation<Bond>({
  onError: (error, category) => {
    console.log('Error categorized as:', category)
    console.log('Error message:', error.message)
  },
})
```

---

## Related Documentation

- [MUTATION_SYSTEM.md](MUTATION_SYSTEM.md) - Complete API reference
- [MUTATION_RACE_SAFETY.md](MUTATION_RACE_SAFETY.md) - Formal guarantees and proofs
- [src/lib/mutationManager.ts](../src/lib/mutationManager.ts) - Implementation
- [src/hooks/useMutation.ts](../src/hooks/useMutation.ts) - Hook implementation
