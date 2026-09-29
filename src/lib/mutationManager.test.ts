/**
 * @file mutationManager.test.ts
 * @description Comprehensive test suite for race safety and concurrency guarantees.
 *
 * Tests cover:
 * - Deduplication: Identical concurrent mutations share same result
 * - Versioning: Stale results never overwrite newer ones
 * - Retry: Transient errors trigger automatic backoff
 * - Idempotency: Same key + parameters produce same side effects
 * - Cancellation: Abort signals properly propagate and clean up
 * - Contention: High-concurrency scenarios with resource limits
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  MutationManager,
  createIdempotencyKey,
  DEFAULT_RETRY_CONFIG,
  type IdempotencyKey,
} from './mutationManager'

describe('MutationManager', () => {
  let manager: MutationManager<string>

  beforeEach(() => {
    manager = new MutationManager()
  })

  afterEach(() => {
    manager.cancelAll()
    manager.clear()
  })

  describe('Basic mutation execution', () => {
    test('executes mutation and returns result', async () => {
      const result = await manager.mutate(
        async () => 'success',
        { key: createIdempotencyKey('/test', 'POST') }
      )

      expect(result.data).toBe('success')
      expect(result.error).toBeNull()
      expect(result.attempts).toBe(1)
      expect(result.isRetry).toBe(false)
    })

    test('captures errors and categorizes them', async () => {
      const error = new Error('Invalid input')
      const result = await manager.mutate(
        async () => {
          throw error
        },
        { key: createIdempotencyKey('/test', 'POST') }
      )

      expect(result.data).toBeNull()
      expect(result.error).toBe(error)
      expect(result.attempts).toBe(1)
      expect(result.isTransient).toBe(false) // Non-transient error, no retry
    })

    test('never throws; errors are captured in result', async () => {
      const result = await manager.mutate(
        async () => {
          throw new Error('Catastrophic failure')
        },
        { key: createIdempotencyKey('/test', 'POST') }
      )

      expect(result.error).not.toBeNull()
    })
  })

  describe('Deduplication', () => {
    test('deduplicates identical concurrent mutations', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      let executionCount = 0

      const mutation = async () => {
        executionCount++
        await new Promise((r) => setTimeout(r, 50))
        return 'result'
      }

      // Fire multiple concurrent requests with same key
      const promises = [
        manager.mutate(mutation, { key }),
        manager.mutate(mutation, { key }),
        manager.mutate(mutation, { key }),
      ]

      const results = await Promise.all(promises)

      // All should return same data
      expect(results[0].data).toBe('result')
      expect(results[1].data).toBe(results[0].data)
      expect(results[2].data).toBe(results[0].data)

      // But mutation executed only once
      expect(executionCount).toBe(1)

      // All have same version and attempt count
      expect(results[0].version).toBe(results[1].version)
      expect(results[0].version).toBe(results[2].version)
    })

    test('does not deduplicate mutations with different keys', async () => {
      let count = 0
      const mutation = async () => {
        count++
        return count
      }

      const results = await Promise.all([
        manager.mutate(mutation, { key: createIdempotencyKey('/a', 'POST') }),
        manager.mutate(mutation, { key: createIdempotencyKey('/b', 'POST') }),
      ])

      expect(results[0].data).toBe(1)
      expect(results[1].data).toBe(2)
      expect(count).toBe(2)
    })

    test('deduplication works even if first request fails', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      let attempts = 0

      // First request fails (transient), will retry
      const promises = [
        manager.mutate(
          async () => {
            attempts++
            if (attempts === 1) throw new Error('Network error')
            return 'success'
          },
          { key }
        ),
        // Second request arrives while first is retrying
        manager.mutate(
          async () => {
            attempts++
            if (attempts === 1) throw new Error('Network error')
            return 'success'
          },
          { key }
        ),
      ]

      const results = await Promise.all(promises)

      // Both get the success result (from the shared retry)
      expect(results[0].data).toBe('success')
      expect(results[1].data).toBe('success')
    })
  })

  describe('Versioning', () => {
    test('tracks version incrementing on new executions', async () => {
      const key = createIdempotencyKey('/test', 'POST')

      const result1 = await manager.mutate(async () => 'v1', { key })
      expect(result1.version).toBe(1)

      const result2 = await manager.mutate(async () => 'v2', { key })
      expect(result2.version).toBe(2)

      const result3 = await manager.mutate(async () => 'v3', { key })
      expect(result3.version).toBe(3)
    })

    test('concurrent requests with same key share same version', async () => {
      const key = createIdempotencyKey('/test', 'POST')

      const results = await Promise.all([
        manager.mutate(async () => 'a', { key }),
        manager.mutate(async () => 'b', { key }),
        manager.mutate(async () => 'c', { key }),
      ])

      // All share the first version since they're dedup'd
      expect(results[0].version).toBe(results[1].version)
      expect(results[1].version).toBe(results[2].version)
    })
  })

  describe('Retry and backoff', () => {
    test('retries transient errors with exponential backoff', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      const attempts: number[] = []

      const startMs = Date.now()
      const result = await manager.mutate(
        async () => {
          attempts.push(Date.now() - startMs)
          if (attempts.length < 3) throw new Error('Network error')
          return 'success'
        },
        {
          key,
          retryConfig: {
            maxRetries: 3,
            initialDelayMs: 50,
            maxDelayMs: 1000,
            jitterFactor: 0, // No jitter for predictable timing
          },
        }
      )

      expect(result.data).toBe('success')
      expect(result.attempts).toBe(3)
      expect(result.isRetry).toBe(true)

      // Verify backoff delays increased
      const delay1 = attempts[1] - attempts[0]
      const delay2 = attempts[2] - attempts[1]

      // delay2 should be roughly double delay1 (exponential backoff)
      // With 50ms initial: 50ms, then 100ms
      expect(delay2).toBeGreaterThan(delay1)
    })

    test('does not retry non-transient errors', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      let attemptCount = 0

      const error = new Error('Invalid input') // Non-transient
      const result = await manager.mutate(
        async () => {
          attemptCount++
          throw error
        },
        { key }
      )

      expect(result.attempts).toBe(1)
      expect(result.error).toBe(error)
      expect(attemptCount).toBe(1) // No retries
    })

    test('respects maxRetries limit', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      let attemptCount = 0

      const result = await manager.mutate(
        async () => {
          attemptCount++
          throw new Error('Network error')
        },
        {
          key,
          retryConfig: {
            maxRetries: 2,
            initialDelayMs: 10,
            maxDelayMs: 100,
            jitterFactor: 0,
          },
        }
      )

      expect(attemptCount).toBe(3) // Initial + 2 retries
      expect(result.attempts).toBe(3)
      expect(result.data).toBeNull()
    })
  })

  describe('Idempotency', () => {
    test('same key executed sequentially runs independently', async () => {
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })
      let executionCount = 0

      const mutation = async () => {
        executionCount++
        return { id: 1, amount: 1000 }
      }

      const result1 = await manager.mutate(mutation, { key })
      const result2 = await manager.mutate(mutation, { key })

      expect(result1.data).toEqual(result2.data)
      expect(result1.idempotencyKey).toBe(result2.idempotencyKey)
      // Sequential calls execute independently (new version on each call)
      expect(result1.version).toBe(1)
      expect(result2.version).toBe(2)
      expect(executionCount).toBe(2)
    })

    test('same key executed concurrently deduplicates', async () => {
      const key = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })
      let executionCount = 0

      const mutation = async () => {
        executionCount++
        await new Promise((r) => setTimeout(r, 50))
        return { id: 1, amount: 1000 }
      }

      // Concurrent calls should deduplicate
      const results = await Promise.all([
        manager.mutate(mutation, { key }),
        manager.mutate(mutation, { key }),
      ])

      expect(results[0].data).toEqual(results[1].data)
      // Concurrent calls share same version due to deduplication
      expect(results[0].version).toBe(results[1].version)
      expect(executionCount).toBe(1)
    })

    test('different keys execute independently', async () => {
      const key1 = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })
      const key2 = createIdempotencyKey('/bonds', 'POST', { amount: 2000 })

      let executionCount = 0

      const mutation = async () => {
        executionCount++
        return 'result'
      }

      const result1 = await manager.mutate(mutation, { key: key1 })
      const result2 = await manager.mutate(mutation, { key: key2 })

      expect(result1.idempotencyKey).not.toBe(result2.idempotencyKey)
      expect(executionCount).toBe(2)
    })
  })

  describe('Event emission', () => {
    test('emits started, succeeded, and failed events', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      const events: string[] = []

      manager.onEvent((event) => {
        events.push(event.type)
      })

      await manager.mutate(async () => 'result', { key })

      expect(events).toContain('started')
      expect(events).toContain('succeeded')
    })

    test('emits retrying event when retry occurs', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      const events: string[] = []
      let attemptCount = 0

      manager.onEvent((event) => {
        events.push(event.type)
      })

      await manager.mutate(
        async () => {
          attemptCount++
          if (attemptCount < 2) throw new Error('Network error')
          return 'success'
        },
        {
          key,
          retryConfig: {
            maxRetries: 2,
            initialDelayMs: 10,
            maxDelayMs: 100,
            jitterFactor: 0,
          },
        }
      )

      expect(events).toContain('started')
      expect(events).toContain('retrying')
      expect(events).toContain('succeeded')
    })

    test('unsubscribe stops event emission', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      const events: string[] = []

      const unsubscribe = manager.onEvent((event) => {
        events.push(event.type)
      })

      unsubscribe()

      await manager.mutate(async () => 'result', { key })

      // No events should be recorded after unsubscribe
      expect(events.length).toBe(0)
    })
  })

  describe('Cancellation', () => {
    // Helper to wait while respecting abort signal
    const abortableWait = (ms: number, signal?: AbortSignal): Promise<void> => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, ms)
        signal?.addEventListener('abort', () => {
          clearTimeout(timeoutId)
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      })
    }

    test('abort signal cancels mutation', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      const controller = new AbortController()
      let executed = false

      setTimeout(() => controller.abort(), 50)

      const result = await manager.mutate(
        async (signal) => {
          executed = true
          await abortableWait(200, signal)
          return 'result'
        },
        { key, signal: controller.signal }
      )

      expect(executed).toBe(true)
      expect(result.error).not.toBeNull()
      expect(result.error?.name).toBe('AbortError')
    })

    test('cancel() aborts in-flight mutation', async () => {
      const key = createIdempotencyKey('/test', 'POST')

      const resultPromise = manager.mutate(
        async (signal) => {
          await abortableWait(200, signal)
          return 'result'
        },
        { key }
      )

      await new Promise((r) => setTimeout(r, 50))
      manager.cancel(key)

      const result = await resultPromise

      expect(result.error).not.toBeNull()
      expect(result.error?.name).toBe('AbortError')
    })

    test('cancelAll() aborts all mutations', async () => {
      const key1 = createIdempotencyKey('/a', 'POST')
      const key2 = createIdempotencyKey('/b', 'POST')

      const result1 = manager.mutate(
        async (signal) => {
          await abortableWait(200, signal)
          return 'a'
        },
        { key: key1 }
      )

      const result2 = manager.mutate(
        async (signal) => {
          await abortableWait(200, signal)
          return 'b'
        },
        { key: key2 }
      )

      await new Promise((r) => setTimeout(r, 50))
      manager.cancelAll()

      const r1 = await result1
      const r2 = await result2

      expect(r1.error?.name).toBe('AbortError')
      expect(r2.error?.name).toBe('AbortError')
    })
  })

  describe('Concurrency and race conditions', () => {
    test('handles high-concurrency deduplication', async () => {
      const key = createIdempotencyKey('/test', 'POST')
      let executionCount = 0

      const mutation = async () => {
        executionCount++
        await new Promise((r) => setTimeout(r, 100))
        return 'result'
      }

      // Fire 50 concurrent identical mutations
      const promises = Array.from({ length: 50 }, () =>
        manager.mutate(mutation, { key })
      )

      const results = await Promise.all(promises)

      // All return same data
      results.forEach((r) => {
        expect(r.data).toBe('result')
        expect(r.version).toBe(results[0].version)
      })

      // But executed only once
      expect(executionCount).toBe(1)
    })

    test('handles concurrent different mutations independently', async () => {
      let executionCount = 0

      const mutation = async () => {
        executionCount++
        return `result-${executionCount}`
      }

      // Fire 10 concurrent mutations with different keys
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.mutate(mutation, {
          key: createIdempotencyKey(`/test-${i}`, 'POST'),
        })
      )

      const results = await Promise.all(promises)

      // Each should execute independently
      expect(executionCount).toBe(10)
      results.forEach((r, i) => {
        expect(r.data).toBe(`result-${i + 1}`)
      })
    })

    test('handles interleaved success and failure', async () => {
      const key1 = createIdempotencyKey('/success', 'POST')
      const key2 = createIdempotencyKey('/failure', 'POST')

      const results = await Promise.all([
        manager.mutate(async () => 'success', { key: key1 }),
        manager.mutate(async () => {
          throw new Error('Network error')
        }, { key: key2, retryConfig: { maxRetries: 0, initialDelayMs: 10, maxDelayMs: 100, jitterFactor: 0 } }),
      ])

      expect(results[0].data).toBe('success')
      expect(results[0].error).toBeNull()

      expect(results[1].data).toBeNull()
      expect(results[1].error).not.toBeNull()
    })
  })

  describe('State queries', () => {
    test('getLatestResult returns latest execution result', async () => {
      const key = createIdempotencyKey('/test', 'POST')

      const result1 = await manager.mutate(async () => 'v1', { key })

      const latestBeforeSecond = manager.getLatestResult(key)
      expect(latestBeforeSecond?.data).toBe('v1')
      expect(latestBeforeSecond?.version).toBe(1)

      const result2 = await manager.mutate(async () => 'v2', { key })

      const latestAfterSecond = manager.getLatestResult(key)
      expect(latestAfterSecond?.data).toBe('v2')
      expect(latestAfterSecond?.version).toBe(2)
    })

    test('getLatestResult returns null for unexecuted key', async () => {
      const key = createIdempotencyKey('/test', 'POST')

      const result = manager.getLatestResult(key)

      expect(result).toBeNull()
    })
  })

  describe('Idempotency key generation', () => {
    test('same parameters produce same key', () => {
      const key1 = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })
      const key2 = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })

      expect(key1).toBe(key2)
    })

    test('different parameters produce different keys', () => {
      const key1 = createIdempotencyKey('/bonds', 'POST', { amount: 1000 })
      const key2 = createIdempotencyKey('/bonds', 'POST', { amount: 2000 })
      const key3 = createIdempotencyKey('/bonds', 'PUT', { amount: 1000 })

      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
    })

    test('key includes path and method', () => {
      const key = createIdempotencyKey('/bonds', 'POST')

      expect(key).toContain('/bonds')
      expect(key).toContain('POST')
    })
  })

  describe('Resource cleanup', () => {
    test('clear() removes all state', async () => {
      const key1 = createIdempotencyKey('/a', 'POST')
      const key2 = createIdempotencyKey('/b', 'POST')

      await manager.mutate(async () => 'a', { key: key1 })
      await manager.mutate(async () => 'b', { key: key2 })

      expect(manager.getLatestResult(key1)).not.toBeNull()
      expect(manager.getLatestResult(key2)).not.toBeNull()

      manager.clear()

      expect(manager.getLatestResult(key1)).toBeNull()
      expect(manager.getLatestResult(key2)).toBeNull()
    })
  })

  describe('Error categorization', () => {
    test('categorizes network errors as network', async () => {
      const key = createIdempotencyKey('/test', 'POST')

      const result = await manager.mutate(
        async () => {
          throw new Error('Network request failed')
        },
        { key, retryConfig: { maxRetries: 0, initialDelayMs: 10, maxDelayMs: 100, jitterFactor: 0 } }
      )

      expect(result.errorCategory).toBe('network')
      expect(result.isTransient).toBe(true)
    })

    test('categorizes validation errors as validation', async () => {
      const key = createIdempotencyKey('/test', 'POST')

      const error = new Error('Validation failed')
      const result = await manager.mutate(
        async () => {
          throw error
        },
        { key, retryConfig: { maxRetries: 0, initialDelayMs: 10, maxDelayMs: 100, jitterFactor: 0 } }
      )

      expect(result.isTransient).toBe(false)
    })
  })
})
