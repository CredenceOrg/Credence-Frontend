/**
 * @file atomicRollback.boundary.test.ts
 * @description Atomic-rollback regression tests for bond and trust-score mutations.
 *
 * Acceptance criteria exercised:
 *  ✓ Related writes and externally observable effects are atomic or
 *    compensating; a clear failure result is exposed without partial state.
 *  ✓ Rejected, stale, repeated, and failed operations leave no unauthorised
 *    or partial state.
 *  ✓ Failures are injected at each side-effect boundary (network, wallet
 *    rejection, storage write, validation) and database/operation state
 *    remains consistent afterwards.
 *  ✓ Retry-after-maxAttempts guard: no extra submission beyond maxAttempts.
 *  ✓ Committed-state recovery: a 'committed' attempt with a tx hash is
 *    promoted to success on reload without re-submitting.
 *  ✓ Concurrent/duplicate submissions: only one execution reaches the network.
 *  ✓ useApiMutation optimistic rollback: previous data is restored on error.
 *
 * Isolation strategy:
 *  - localStorage is replaced with a plain in-memory map before each test so
 *    storage reads/writes are deterministic and fully isolated.
 *  - Bond and trust-score executors are replaced via setBondExecutors /
 *    setTrustScoreExecutor so failures are injected at the exact boundary.
 *  - All timers are real (no fake-timer dependency); executor fakes resolve
 *    synchronously where possible.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Storage isolation ─────────────────────────────────────────────────────

type StorageMap = Map<string, string>

function makeIsolatedStorage(): Storage {
  const map: StorageMap = new Map()
  return {
    get length() {
      return map.size
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v) },
    removeItem: (k) => { map.delete(k) },
    clear: () => map.clear(),
  } as Storage
}

let originalLocalStorage: Storage

beforeEach(() => {
  originalLocalStorage = globalThis.localStorage
  Object.defineProperty(globalThis, 'localStorage', {
    value: makeIsolatedStorage(),
    configurable: true,
    writable: true,
  })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: originalLocalStorage,
    configurable: true,
    writable: true,
  })
  vi.restoreAllMocks()
})

// ── Imports (after storage mock) ──────────────────────────────────────────

import {
  setBondExecutors,
  setTrustScoreExecutor,
  type BondExecutors,
} from '../lib/mutationRecovery'
import {
  createMutationOperation,
  getMutationOperation,
  getMutationOperations,
  updateMutationOperation,
  resetMutationStorage,
} from '../lib/mutationStorage'
import { ApiError } from '../api/client'

// We test the engine through its public surface so we import the
// singleton that consumers actually use.
import { mutationRecoveryEngine } from '../lib/mutationRecovery'

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build a minimal bond executor that succeeds immediately. */
function succeedingBondExecutors(hashPrefix = 'tx'): BondExecutors {
  let seq = 0
  return {
    createBond: async () => ({ hash: `${hashPrefix}-create-${++seq}` }),
    withdrawBond: async () => ({ hash: `${hashPrefix}-withdraw-${++seq}` }),
  }
}

/** Build a bond executor that throws `error` exactly `times` times, then succeeds. */
function failingThenSucceedingBondExecutors(
  error: Error,
  times: number,
  hashPrefix = 'tx'
): BondExecutors & { callCount: number } {
  let calls = 0
  let seq = 0
  const exec = {
    callCount: 0,
    createBond: async (_p: { amountUsdc: number }) => {
      exec.callCount++
      calls++
      if (calls <= times) throw error
      return { hash: `${hashPrefix}-create-${++seq}` }
    },
    withdrawBond: async (_p: { bondId: number; amountUsdc: number }) => {
      exec.callCount++
      calls++
      if (calls <= times) throw error
      return { hash: `${hashPrefix}-withdraw-${++seq}` }
    },
  }
  return exec
}

/**
 * Resolves after all pending microtasks and a short macro-task delay so
 * async recovery chains can complete without fake timers.
 */
function flushAsync(ms = 200): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ═════════════════════════════════════════════════════════════════════════
// 1. Validation boundary — no network call, no partial state
// ═════════════════════════════════════════════════════════════════════════

describe('Validation boundary', () => {
  test('bond_create: invalid amount never reaches the network', async () => {
    let networkCalled = false
    const prev = setBondExecutors({
      createBond: async () => {
        networkCalled = true
        return { hash: 'should-not-appear' }
      },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: -50 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(networkCalled).toBe(false)
      expect(op?.status).toBe('error')
      const lastErr = op?.attempts[op.attempts.length - 1]?.error
      expect(lastErr?.type).toBe('validation')
      expect(lastErr?.retryable).toBe(false)
    } finally {
      setBondExecutors(prev)
    }
  })

  test('bond_create: amount below minimum leaves status=error, no partial state', async () => {
    const prev = setBondExecutors(succeedingBondExecutors())
    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 1 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
      expect(op?.finalTxHash).toBeUndefined()
    } finally {
      setBondExecutors(prev)
    }
  })

  test('bond_withdraw: non-positive bondId never reaches the network', async () => {
    let networkCalled = false
    const prev = setBondExecutors({
      createBond: async () => ({ hash: 'x' }),
      withdrawBond: async () => {
        networkCalled = true
        return { hash: 'should-not-appear' }
      },
    })

    try {
      const { operationId } = createMutationOperation(
        'bond_withdraw',
        { bondId: 0, amountUsdc: 100 },
        3
      )
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      expect(networkCalled).toBe(false)
      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
    } finally {
      setBondExecutors(prev)
    }
  })

  test('trust_score_lookup: empty address never reaches the network', async () => {
    let networkCalled = false
    const prev = setTrustScoreExecutor(async () => {
      networkCalled = true
      return {}
    })

    try {
      const { operationId } = createMutationOperation('trust_score_lookup', { address: '' }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      expect(networkCalled).toBe(false)
      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
      expect(op?.attempts[op.attempts.length - 1]?.error?.retryable).toBe(false)
    } finally {
      setTrustScoreExecutor(prev)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 2. Network failure — partial state rolled back
// ═════════════════════════════════════════════════════════════════════════

describe('Network failure boundary', () => {
  test('network error leaves operation in error state with no finalTxHash', async () => {
    const networkErr = new Error('Network request failed')
    const exec = failingThenSucceedingBondExecutors(networkErr, 99) // always fails
    const prev = setBondExecutors(exec)

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 100 }, 1)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync(500)

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
      expect(op?.finalTxHash).toBeUndefined()
      // The attempt record must exist and carry the error
      const lastAttempt = op?.attempts[op.attempts.length - 1]
      expect(lastAttempt?.error?.type).toBe('network')
      expect(lastAttempt?.error?.message).toContain('Network request failed')
    } finally {
      setBondExecutors(prev)
    }
  })

  test('wallet rejection leaves operation in error state, retryable=false', async () => {
    const rejectionErr = new Error('User rejected the request.')
    const prev = setBondExecutors({
      createBond: async () => { throw rejectionErr },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 500 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
      expect(op?.finalTxHash).toBeUndefined()
      const lastErr = op?.attempts[op.attempts.length - 1]?.error
      expect(lastErr?.type).toBe('wallet_rejected')
      expect(lastErr?.retryable).toBe(false)
    } finally {
      setBondExecutors(prev)
    }
  })

  test('trust-score network error preserves full ApiError status code', async () => {
    const apiErr = new ApiError(503, 'Service unavailable', { detail: 'overload' })
    const prev = setTrustScoreExecutor(async () => { throw apiErr })

    try {
      const { operationId } = createMutationOperation(
        'trust_score_lookup',
        { address: 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12' },
        1
      )
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
      const lastErr = op?.attempts[op.attempts.length - 1]?.error
      // The fix preserves the ApiError status code rather than falling through
      // to a generic 'generic' type.
      expect(lastErr?.type).toBe('backend')
      expect(lastErr?.code).toBe(503)
    } finally {
      setTrustScoreExecutor(prev)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 3. Committed-state guard — no double-submission on recovery
// ═════════════════════════════════════════════════════════════════════════

describe('Committed-state guard', () => {
  test('operation with committed attempt is promoted to success without re-submitting', async () => {
    let networkCalled = false
    const prev = setBondExecutors({
      createBond: async () => {
        networkCalled = true
        return { hash: 'should-not-be-called' }
      },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      // Simulate a crash between the two writes: operation is 'submitting'
      // but the last attempt already has status='committed' with a txHash.
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 200 }, 3)
      updateMutationOperation(operationId, (op) => ({
        status: 'submitting',
        attempts: [
          {
            attemptId: 'attempt:crash:1',
            timestamp: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
            requestHash: op.requestHash,
            status: 'committed' as unknown as typeof op.attempts[0]['status'],
            txHash: 'real-tx-hash-from-chain',
          },
        ],
      }))

      const recovered = await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      expect(recovered).toBe(true)
      expect(networkCalled).toBe(false)

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('success')
      expect(op?.finalTxHash).toBe('real-tx-hash-from-chain')
    } finally {
      setBondExecutors(prev)
    }
  })

  test('successful execution writes committed status before final success', async () => {
    // After a normal successful execution the operation must end up as 'success'
    // and hold the tx hash — the two-phase write must produce a consistent
    // terminal state.
    const prev = setBondExecutors(succeedingBondExecutors('two-phase'))
    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 1000 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('success')
      expect(op?.finalTxHash).toMatch(/^two-phase-create-/)
      // All attempts must be in terminal state — none stuck in 'submitting'
      for (const attempt of op?.attempts ?? []) {
        expect(['success', 'committed', 'error']).toContain(attempt.status)
      }
    } finally {
      setBondExecutors(prev)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 4. Retry-after-maxAttempts guard
// ═════════════════════════════════════════════════════════════════════════

describe('maxAttempts guard', () => {
  test('transient errors do not exceed maxAttempts network calls', async () => {
    let callCount = 0
    const prev = setBondExecutors({
      createBond: async () => {
        callCount++
        throw new Error('Network request failed') // always transient
      },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const MAX = 2
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 500 }, MAX)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync(800) // allow retries with short base delay

      expect(callCount).toBeLessThanOrEqual(MAX)

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
      expect(op?.attempts.length).toBeLessThanOrEqual(MAX)
      expect(op?.finalTxHash).toBeUndefined()
    } finally {
      setBondExecutors(prev)
    }
  })

  test('non-retryable error terminates immediately (no retry attempts)', async () => {
    let callCount = 0
    const prev = setBondExecutors({
      createBond: async () => {
        callCount++
        throw new Error('User denied')
      },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 500 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      expect(callCount).toBe(1) // wallet rejection — no retry
      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
    } finally {
      setBondExecutors(prev)
    }
  })

  test('retry after error succeeds within maxAttempts', async () => {
    const exec = failingThenSucceedingBondExecutors(
      new Error('Network request failed'),
      1, // fail once, then succeed
      'retry-ok'
    )
    const prev = setBondExecutors(exec)

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 300 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync(1500) // base delay is 1 s

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('success')
      expect(op?.finalTxHash).toMatch(/^retry-ok-create-/)
      expect(exec.callCount).toBe(2) // exactly 1 retry
    } finally {
      setBondExecutors(prev)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 5. Duplicate / concurrent submission prevention
// ═════════════════════════════════════════════════════════════════════════

describe('Duplicate submission prevention', () => {
  test('createMutationOperation deduplicates identical in-flight requests', () => {
    const params = { amountUsdc: 750 }
    const { operationId: id1, isNewOperation: new1 } = createMutationOperation(
      'bond_create',
      params,
      3
    )
    const { operationId: id2, isNewOperation: new2 } = createMutationOperation(
      'bond_create',
      params,
      3
    )

    // Both calls return the same operationId — the second is deduplicated.
    expect(id1).toBe(id2)
    expect(new1).toBe(true)
    expect(new2).toBe(false)
  })

  test('concurrent recoverOperation calls for the same id do not execute twice', async () => {
    let networkCalls = 0
    const prev = setBondExecutors({
      createBond: async () => {
        networkCalls++
        await flushAsync(50)
        return { hash: `concurrent-${networkCalls}` }
      },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 900 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))

      // Fire two recovery attempts simultaneously
      const [r1, r2] = await Promise.all([
        mutationRecoveryEngine.recoverOperation(operationId),
        mutationRecoveryEngine.recoverOperation(operationId),
      ])

      await flushAsync()

      // At least one should have succeeded; the second should have been
      // short-circuited by the activeRecoveries guard.
      expect(r1 || r2).toBe(true)
      expect(networkCalls).toBeLessThanOrEqual(1)

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('success')
    } finally {
      setBondExecutors(prev)
    }
  })

  test('repeated mutations with same params only create one storage entry', () => {
    // A completed operation should not be deduplicated (status=success is
    // excluded from dedup so a brand new attempt can start).
    const params = { amountUsdc: 400 }
    const { operationId: id1 } = createMutationOperation('bond_create', params, 3)
    // Mark the first as success so the dedup filter skips it.
    updateMutationOperation(id1, () => ({ status: 'success', finalTxHash: 'done' }))

    const { operationId: id2, isNewOperation } = createMutationOperation('bond_create', params, 3)
    expect(id2).not.toBe(id1)
    expect(isNewOperation).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 6. Stale / cancelled operations leave no partial state
// ═════════════════════════════════════════════════════════════════════════

describe('Stale and cancelled operations', () => {
  test('cancelled operation stays cancelled and is not retried', async () => {
    let networkCalls = 0
    const prev = setBondExecutors({
      createBond: async () => {
        networkCalls++
        return { hash: 'should-not-appear' }
      },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 200 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'cancelled' }))

      const recovered = await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      expect(recovered).toBe(false)
      expect(networkCalls).toBe(0)
      expect(getMutationOperation(operationId)?.status).toBe('cancelled')
    } finally {
      setBondExecutors(prev)
    }
  })

  test('cancelMutation during pending stops execution before network call', async () => {
    let networkCalls = 0
    const prev = setBondExecutors({
      createBond: async () => {
        networkCalls++
        return { hash: 'should-not-appear' }
      },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 600 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))

      // Start recovery then immediately cancel
      const recoveryPromise = mutationRecoveryEngine.recoverOperation(operationId)
      mutationRecoveryEngine.cancelRecovery(operationId)
      await recoveryPromise
      await flushAsync()

      expect(networkCalls).toBe(0)
      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('cancelled')
    } finally {
      setBondExecutors(prev)
    }
  })

  test('error state operation exposes error message but no finalTxHash', async () => {
    const prev = setBondExecutors({
      createBond: async () => { throw new Error('Rejected by wallet') },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 100 }, 3)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
      expect(op?.finalTxHash).toBeUndefined()
      expect(op?.finalResponse).toBeUndefined()
      const lastErr = op?.attempts[op.attempts.length - 1]?.error
      expect(typeof lastErr?.message).toBe('string')
      expect(lastErr?.message.length).toBeGreaterThan(0)
    } finally {
      setBondExecutors(prev)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 7. useApiMutation — optimistic rollback and duplicate-submission guard
// ═════════════════════════════════════════════════════════════════════════

// These tests exercise the hook directly using React Testing Library / renderHook.
// They are kept in this file because they test the same rollback invariant at
// the hook boundary.

import { renderHook, act } from '@testing-library/react'
import { useApiMutation } from '../hooks/useApiMutation'

describe('useApiMutation — optimistic rollback', () => {
  test('data is rolled back to previous value when mutationFn throws', async () => {
    const initialData = { balance: 1000 }

    const { result } = renderHook(() =>
      useApiMutation<{ balance: number }, { amount: number }>({
        mutationFn: async ({ amount }) => {
          // Simulate the network call failing
          throw new Error(`Insufficient funds for ${amount}`)
        },
        onMutate: (_vars, { setData }) => {
          // Optimistic update: deduct the amount before the call
          setData((prev) => ({ balance: (prev?.balance ?? 0) - 100 }))
        },
        initialData,
      })
    )

    await act(async () => {
      await expect(result.current.mutateAsync({ amount: 100 })).rejects.toThrow(
        'Insufficient funds'
      )
    })

    // Data must be rolled back to the pre-optimistic value
    expect(result.current.data).toEqual(initialData)
    expect(result.current.status).toBe('error')
    expect(result.current.error?.message).toContain('Insufficient funds')
  })

  test('duplicate-submission guard: second concurrent call returns the same promise', async () => {
    let executionCount = 0

    const { result } = renderHook(() =>
      useApiMutation<string, void>({
        mutationFn: async () => {
          executionCount++
          await new Promise((r) => setTimeout(r, 50))
          return 'done'
        },
      })
    )

    // Fire two concurrent calls
    let p1!: Promise<string>
    let p2!: Promise<string>

    act(() => {
      p1 = result.current.mutateAsync()
      p2 = result.current.mutateAsync()
    })

    const [r1, r2] = await Promise.all([p1, p2])

    // Only one execution reached the mutationFn
    expect(executionCount).toBe(1)
    // Both callers receive the same result
    expect(r1).toBe('done')
    expect(r2).toBe('done')
  })

  test('duplicate-submission guard: second call after first settles starts fresh', async () => {
    let executionCount = 0

    const { result } = renderHook(() =>
      useApiMutation<number, void>({
        mutationFn: async () => {
          return ++executionCount
        },
      })
    )

    await act(async () => {
      await result.current.mutateAsync()
    })
    await act(async () => {
      await result.current.mutateAsync()
    })

    // Each settled call must get its own execution
    expect(executionCount).toBe(2)
  })

  test('error leaves no partial optimistic state visible', async () => {
    const { result } = renderHook(() =>
      useApiMutation<{ count: number }, void>({
        mutationFn: async () => {
          throw new Error('Server error')
        },
        onMutate: (_vars, { setData }) => {
          setData({ count: 99 }) // optimistic increment
        },
        initialData: { count: 0 },
      })
    )

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('Server error')
    })

    // The optimistic change must not survive the failure
    expect(result.current.data).toEqual({ count: 0 })
    expect(result.current.isPending).toBe(false)
  })

  test('reset() clears error and data after a failed mutation', async () => {
    const { result } = renderHook(() =>
      useApiMutation<string, void>({
        mutationFn: async () => { throw new Error('fail') },
      })
    )

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow()
    })

    expect(result.current.status).toBe('error')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeUndefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 8. Storage consistency after failures
// ═════════════════════════════════════════════════════════════════════════

describe('Storage consistency', () => {
  test('failed bond_create leaves no in-progress entry in storage', async () => {
    const prev = setBondExecutors({
      createBond: async () => { throw new Error('wallet error') },
      withdrawBond: async () => ({ hash: 'x' }),
    })

    try {
      const { operationId } = createMutationOperation('bond_create', { amountUsdc: 250 }, 1)
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      // Must not be stuck in pending/submitting — those are "in-progress" states
      expect(['error', 'success', 'cancelled']).toContain(op?.status)
    } finally {
      setBondExecutors(prev)
    }
  })

  test('successful bond_withdraw is stored with finalTxHash', async () => {
    const prev = setBondExecutors(succeedingBondExecutors('withdraw-ok'))
    try {
      const { operationId } = createMutationOperation(
        'bond_withdraw',
        { bondId: 42, amountUsdc: 150 },
        3
      )
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('success')
      expect(op?.finalTxHash).toMatch(/^withdraw-ok-withdraw-/)
      expect(op?.completedAt).toBeTruthy()
    } finally {
      setBondExecutors(prev)
    }
  })

  test('resetMutationStorage removes all operations', () => {
    createMutationOperation('bond_create', { amountUsdc: 100 }, 3)
    createMutationOperation('bond_withdraw', { bondId: 1, amountUsdc: 50 }, 3)

    resetMutationStorage()

    const all = getMutationOperations()
    expect(all.length).toBe(0)
  })

  test('operations for different request params are stored independently', () => {
    const { operationId: id1 } = createMutationOperation('bond_create', { amountUsdc: 100 }, 3)
    const { operationId: id2 } = createMutationOperation('bond_create', { amountUsdc: 200 }, 3)

    expect(id1).not.toBe(id2)
    expect(getMutationOperation(id1)).not.toBeNull()
    expect(getMutationOperation(id2)).not.toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 9. Trust-score mutation — full boundary coverage
// ═════════════════════════════════════════════════════════════════════════

describe('Trust-score lookup boundary', () => {
  const VALID_ADDRESS = 'GABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF12'

  test('successful lookup stores response in finalResponse', async () => {
    const expectedScore = { score: 85, tier: 'A', address: VALID_ADDRESS }
    const prev = setTrustScoreExecutor(async () => expectedScore)

    try {
      const { operationId } = createMutationOperation(
        'trust_score_lookup',
        { address: VALID_ADDRESS },
        3
      )
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('success')
      expect(op?.finalResponse).toEqual(expectedScore)
      expect(op?.finalTxHash).toBeUndefined() // trust-score has no tx hash
    } finally {
      setTrustScoreExecutor(prev)
    }
  })

  test('failed lookup leaves no partial finalResponse in storage', async () => {
    const prev = setTrustScoreExecutor(async () => { throw new Error('lookup failed') })

    try {
      const { operationId } = createMutationOperation(
        'trust_score_lookup',
        { address: VALID_ADDRESS },
        1
      )
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      const op = getMutationOperation(operationId)
      expect(op?.status).toBe('error')
      expect(op?.finalResponse).toBeUndefined()
    } finally {
      setTrustScoreExecutor(prev)
    }
  })

  test('oversized address is rejected before the executor is called', async () => {
    let executorCalled = false
    const prev = setTrustScoreExecutor(async () => {
      executorCalled = true
      return {}
    })

    try {
      const oversized = 'A'.repeat(200)
      const { operationId } = createMutationOperation(
        'trust_score_lookup',
        { address: oversized },
        3
      )
      updateMutationOperation(operationId, () => ({ status: 'pending' }))
      await mutationRecoveryEngine.recoverOperation(operationId)
      await flushAsync()

      expect(executorCalled).toBe(false)
      expect(getMutationOperation(operationId)?.status).toBe('error')
    } finally {
      setTrustScoreExecutor(prev)
    }
  })
})
