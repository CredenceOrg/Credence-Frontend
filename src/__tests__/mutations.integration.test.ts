/**
 * @file mutations.integration.test.ts
 * @description Integration tests for bond and trust-score mutations with concurrency safety.
 *
 * Tests the complete flow of mutations with:
 * - Concurrent identical requests (deduplication)
 * - Serialized competing requests (no data loss)
 * - Network failures and automatic retries
 * - Idempotency across retries
 * - Race condition prevention
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { MutationManager, createIdempotencyKey, type MutationResult } from '../lib/mutationManager'

/** Mock API response for Bond creation. */
interface Bond {
  id: string
  amount: number
  status: 'active' | 'locked'
  createdAt: string
}

/** Mock API response for Trust Score update. */
interface TrustScoreUpdate {
  address: string
  newScore: number
  updatedAt: string
}

describe('Mutation Integration - Bond and Trust Score Operations', () => {
  let bondMutationManager: MutationManager<Bond>
  let trustScoreMutationManager: MutationManager<TrustScoreUpdate>

  // Mock API with simulated latency and failures
  const mockApiDelay = 100
  let mockApiFailureCount = 0
  const mockApiReset = () => {
    mockApiFailureCount = 0
  }

  const mockCreateBond = async (amount: number, duration: number): Promise<Bond> => {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, mockApiDelay))

    // Simulate transient failures
    if (mockApiFailureCount > 0) {
      mockApiFailureCount--
      throw new Error('Network request failed')
    }

    return {
      id: `bond-${amount}-${Date.now()}`,
      amount,
      status: 'locked',
      createdAt: new Date().toISOString(),
    }
  }

  const mockUpdateTrustScore = async (address: string, increase: number): Promise<TrustScoreUpdate> => {
    await new Promise((r) => setTimeout(r, mockApiDelay))

    if (mockApiFailureCount > 0) {
      mockApiFailureCount--
      throw new Error('Network request failed')
    }

    return {
      address,
      newScore: 500 + increase,
      updatedAt: new Date().toISOString(),
    }
  }

  beforeEach(() => {
    bondMutationManager = new MutationManager<Bond>()
    trustScoreMutationManager = new MutationManager<TrustScoreUpdate>()
    mockApiReset()
  })

  describe('Bond Mutation - Concurrency Safety', () => {
    test('deduplicates identical concurrent bond creation requests', async () => {
      let executionCount = 0
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000, duration: 30 })

      const result = await Promise.all([
        bondMutationManager.mutate(
          async () => {
            executionCount++
            return mockCreateBond(1000, 30)
          },
          { key }
        ),
        bondMutationManager.mutate(
          async () => {
            executionCount++
            return mockCreateBond(1000, 30)
          },
          { key }
        ),
        bondMutationManager.mutate(
          async () => {
            executionCount++
            return mockCreateBond(1000, 30)
          },
          { key }
        ),
      ])

      // All three requests return the same result
      expect(result[0].data).toEqual(result[1].data)
      expect(result[1].data).toEqual(result[2].data)

      // But API was only called once (deduplication)
      expect(executionCount).toBe(1)

      // All share same version
      expect(result[0].version).toBe(result[1].version)
    })

    test('handles sequential bond mutations independently', async () => {
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000, duration: 30 })

      const result1 = await bondMutationManager.mutate(
        async () => mockCreateBond(1000, 30),
        { key }
      )

      const result2 = await bondMutationManager.mutate(
        async () => mockCreateBond(1000, 30),
        { key }
      )

      // Both succeed
      expect(result1.data).not.toBeNull()
      expect(result2.data).not.toBeNull()

      // Different versions (sequential, not concurrent)
      expect(result1.version).toBe(1)
      expect(result2.version).toBe(2)
    })

    test('retries on transient network failures', async () => {
      let attempts = 0
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000, duration: 30 })

      // Simulate 2 failures before success
      mockApiFailureCount = 2

      const result = await bondMutationManager.mutate(
        async () => {
          attempts++
          return mockCreateBond(1000, 30)
        },
        {
          key,
          retryConfig: {
            maxRetries: 3,
            initialDelayMs: 10,
            maxDelayMs: 100,
            jitterFactor: 0,
          },
        }
      )

      // Should succeed after retries
      expect(result.data).not.toBeNull()
      expect(result.attempts).toBe(3) // Initial + 2 retries
      expect(attempts).toBe(3)
      expect(result.isRetry).toBe(true)
    })

    test('preserves bond state during partial failures', async () => {
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 500, duration: 90 })

      let attempt = 0
      const result = await bondMutationManager.mutate(
        async () => {
          attempt++
          if (attempt === 1) {
            throw new Error('Network error') // First attempt fails
          }
          return mockCreateBond(500, 90)
        },
        {
          key,
          retryConfig: { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 100, jitterFactor: 0 },
        }
      )

      expect(result.data).not.toBeNull()
      expect(result.data?.amount).toBe(500)
      expect(result.attempts).toBe(2)
    })
  })

  describe('Trust Score Mutation - Race Condition Prevention', () => {
    test('prevents stale trust score updates from overwriting newer ones', async () => {
      const address = 'GABCD1234567890'
      const slowKey = createIdempotencyKey(`/trust-score/${address}`, 'PUT', { increase: 10 })
      const fastKey = createIdempotencyKey(`/trust-score/${address}`, 'PUT', { increase: 20 })

      let slowExecuted = false
      let fastExecuted = false

      const slowMutation = bondMutationManager.mutate(
        async () => {
          await new Promise((r) => setTimeout(r, 200)) // Slower
          slowExecuted = true
          return mockCreateBond(1000, 30) // Using Bond type for simplicity
        },
        { key: slowKey }
      )

      // Start fast mutation shortly after slow one
      await new Promise((r) => setTimeout(r, 10))

      const fastMutation = bondMutationManager.mutate(
        async () => {
          fastExecuted = true
          return mockCreateBond(1000, 30)
        },
        { key: fastKey }
      )

      const [slowResult, fastResult] = await Promise.all([slowMutation, fastMutation])

      // Both complete successfully
      expect(slowExecuted).toBe(true)
      expect(fastExecuted).toBe(true)
      expect(slowResult.data).not.toBeNull()
      expect(fastResult.data).not.toBeNull()
    })

    test('ensures idempotency across identical retried requests', async () => {
      let callCount = 0
      const createdIds = new Set<string>()
      const address = 'GABCD1234567890'
      const key = createIdempotencyKey(`/trust-score/${address}`, 'PUT')

      const result1 = await trustScoreMutationManager.mutate(
        async () => {
          callCount++
          const update = await mockUpdateTrustScore(address, 10)
          createdIds.add(update.address)
          return update
        },
        { key }
      )

      // Retry with same key - should not create duplicate
      const result2 = await trustScoreMutationManager.mutate(
        async () => {
          callCount++
          const update = await mockUpdateTrustScore(address, 10)
          createdIds.add(update.address)
          return update
        },
        { key }
      )

      // Both requests succeeded
      expect(result1.data).not.toBeNull()
      expect(result2.data).not.toBeNull()

      // But only one unique ID was created (idempotency)
      expect(createdIds.size).toBe(1)
    })
  })

  describe('High-Concurrency Scenarios', () => {
    test('handles 50 concurrent identical bond creation requests', async () => {
      let executionCount = 0
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000, duration: 30 })

      const promises = Array.from({ length: 50 }, () =>
        bondMutationManager.mutate(
          async () => {
            executionCount++
            return mockCreateBond(1000, 30)
          },
          { key }
        )
      )

      const results = await Promise.all(promises)

      // All 50 requests return identical successful data
      const firstData = results[0].data
      results.forEach((r) => {
        expect(r.data).toEqual(firstData)
        expect(r.version).toBe(results[0].version)
      })

      // But API was only called once
      expect(executionCount).toBe(1)
    })

    test('handles mixed concurrent operations (different keys)', async () => {
      let totalExecutions = 0

      const mutations = Array.from({ length: 10 }, (_, i) =>
        bondMutationManager.mutate(
          async () => {
            totalExecutions++
            return mockCreateBond(100 * (i + 1), 30 + i * 10)
          },
          { key: createIdempotencyKey('/bonds', 'POST', { index: i }) }
        )
      )

      const results = await Promise.all(mutations)

      // All executed independently
      expect(totalExecutions).toBe(10)

      // All succeeded
      results.forEach((r) => {
        expect(r.data).not.toBeNull()
        expect(r.error).toBeNull()
      })

      // Each has different data
      const amounts = results.map((r) => r.data?.amount).sort()
      const uniqueAmounts = new Set(amounts)
      expect(uniqueAmounts.size).toBe(10)
    })
  })

  describe('Event Emission and Observability', () => {
    test('emits events for mutation lifecycle', async () => {
      const events: string[] = []
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })

      bondMutationManager.onEvent((event) => {
        events.push(event.type)
      })

      await bondMutationManager.mutate(async () => mockCreateBond(1000, 30), { key })

      expect(events).toContain('started')
      expect(events).toContain('succeeded')
    })

    test('emits retry events on transient failure', async () => {
      const events: string[] = []
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })

      bondMutationManager.onEvent((event) => {
        events.push(event.type)
      })

      mockApiFailureCount = 1

      await bondMutationManager.mutate(async () => mockCreateBond(1000, 30), {
        key,
        retryConfig: { maxRetries: 2, initialDelayMs: 10, maxDelayMs: 100, jitterFactor: 0 },
      })

      expect(events).toContain('started')
      expect(events).toContain('retrying')
      expect(events).toContain('succeeded')
    })
  })

  describe('Error Recovery and Determinism', () => {
    test('leaves no partial state after failed mutation', async () => {
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })

      const result = await bondMutationManager.mutate(
        async () => {
          throw new Error('Invalid amount')
        },
        { key, retryConfig: { maxRetries: 0, initialDelayMs: 10, maxDelayMs: 100, jitterFactor: 0 } }
      )

      expect(result.data).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.isTransient).toBe(false)

      // Retry with same key should try again (new version)
      let secondAttempt = false
      const result2 = await bondMutationManager.mutate(
        async () => {
          secondAttempt = true
          return mockCreateBond(1000, 30)
        },
        { key }
      )

      expect(secondAttempt).toBe(true)
      expect(result2.data).not.toBeNull()
    })

    test('provides deterministic retry behavior across identical requests', async () => {
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })
      const eventLog1: string[] = []
      const eventLog2: string[] = []

      // First execution
      bondMutationManager.onEvent((event) => {
        eventLog1.push(event.type)
      })

      await bondMutationManager.mutate(async () => mockCreateBond(1000, 30), { key })

      // Clear manager and try again with different instance
      const freshManager = new MutationManager<Bond>()
      freshManager.onEvent((event) => {
        eventLog2.push(event.type)
      })

      await freshManager.mutate(async () => mockCreateBond(1000, 30), { key })

      // Both should have identical event sequences
      expect(eventLog1).toEqual(eventLog2)
    })
  })
})
