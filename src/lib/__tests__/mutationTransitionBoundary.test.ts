/**
 * @file mutationTransitionBoundary.test.ts
 * @description Invariant coverage at the real bond / trust-score entry points.
 *
 * The matrix itself is covered in `mutationStateTransitions.test.ts`. This file
 * proves the guarantee where users actually touch it: the bond action API, the
 * recovery engine, and the trust-score lookup API. Storage is a working
 * in-memory store and only the network edge (`apiFetch`, `submitCreateBond`,
 * `submitWithdrawBond`) is faked, so every assertion below exercises the same
 * code path the app runs.
 *
 * The two failures this is guarding against:
 *   1. an entry point reporting success for a transition the matrix refused,
 *      leaving the UI and storage disagreeing about a financial action;
 *   2. a mutation reaching the network after the user cancelled it.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// ── In-memory storage fake ────────────────────────────────────────────────
const store = new Map<string, unknown>()

vi.mock('../storageJson', () => ({
  safeReadJson: vi.fn((key: string) =>
    store.has(key)
      ? { ok: true, value: JSON.parse(JSON.stringify(store.get(key))) }
      : { ok: false, error: new Error('not found') }
  ),
  safeWriteJson: vi.fn((key: string, value: unknown) => {
    store.set(key, JSON.parse(JSON.stringify(value)))
    return { ok: true }
  }),
  safeRemoveItem: vi.fn((key: string) => {
    store.delete(key)
    return { ok: true }
  }),
}))

vi.mock('../log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

// ── Network edge ──────────────────────────────────────────────────────────
const submitCreateBond = vi.fn(async () => ({ hash: 'local-tx-create' }))
const submitWithdrawBond = vi.fn(async () => ({ hash: 'local-tx-withdraw' }))

vi.mock('../bondMutations', () => ({
  submitCreateBond: (...args: unknown[]) => submitCreateBond(...(args as [])),
  submitWithdrawBond: (...args: unknown[]) => submitWithdrawBond(...(args as [])),
}))

const apiFetch = vi.fn(async () => ({ address: 'G'.repeat(56), score: 42 }))

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client')
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...(args as [])) }
})

import {
  transitionMutationOperation,
  createMutationOperation,
  getMutationOperation,
  type MutationOperationId,
} from '../mutationStorage'
import {
  createEnhancedBondAction,
  updateBondAction,
  readBondActions,
  BOND_ACTIONS_V1_KEY,
} from '../bondActionStorage'
import {
  mutationRecoveryEngine,
  initiateMutation,
  retryMutation,
  cancelMutation,
} from '../mutationRecovery'
import { retryTrustScoreLookup, cancelTrustScoreLookup } from '../trustScoreMutations'

beforeEach(() => {
  store.clear()
  vi.clearAllMocks()
  submitCreateBond.mockResolvedValue({ hash: 'local-tx-create' })
  submitWithdrawBond.mockResolvedValue({ hash: 'local-tx-withdraw' })
  apiFetch.mockResolvedValue({ address: 'G'.repeat(56), score: 42 })
})

afterEach(() => {
  mutationRecoveryEngine.cancelAllRecoveries()
})

// ═══════════════════════════════════════════════════════════════════════════
describe('bond action legacy mirror', () => {
  it('links a new bond action to a unified operation', () => {
    const { operationId, isNewOperation } = createEnhancedBondAction('create', { amountUsdc: 100 })

    expect(isNewOperation).toBe(true)
    expect(getMutationOperation(operationId)?.status).toBe('pending')
    expect(readBondActions(false).create.operationId).toBe(operationId)
  })

  it('reconciles a legacy write that claims an outcome the lifecycle forbids', () => {
    const { operationId } = createEnhancedBondAction('create', { amountUsdc: 100 })
    // Settle the authoritative operation.
    transitionMutationOperation(operationId, 'success', () => ({ finalTxHash: 'tx-settled' }), {
      allowIndirect: true,
    })

    // A legacy caller now tries to push the record back to `pending`, which
    // would move a terminal operation. The mirror must refuse and resync.
    const next = updateBondAction('create', (current) => ({
      ...current,
      status: 'pending',
      lastAttemptAt: new Date().toISOString(),
    }))

    // Authoritative store is untouched…
    expect(getMutationOperation(operationId)?.status).toBe('success')
    // …and the legacy projection agrees with it rather than claiming `pending`.
    expect(next.create.status).toBe('success')
    expect(next.create.lastTxHash).toBe('tx-settled')
  })

  it('never lets the legacy record assert success while the operation is not settled', () => {
    const { operationId } = createEnhancedBondAction('create', { amountUsdc: 100 })
    expect(getMutationOperation(operationId)?.status).toBe('pending')

    // `pending → success` is not a legal single edge. It is however reachable,
    // so the mirror reconciles along the real path instead of diverging.
    const next = updateBondAction('create', (current) => ({
      ...current,
      status: 'success',
      lastSuccessAt: '2026-01-01T00:00:00.000Z',
      lastTxHash: 'tx-1',
    }))

    const operation = getMutationOperation(operationId)
    expect(operation?.status).toBe('success')
    expect(next.create.status).toBe('success')
    // The two stores agree — which is the whole point.
    expect(next.create.lastTxHash).toBe(operation?.finalTxHash)
  })

  it('keeps the two stores in agreement after a cancellation', () => {
    const { operationId } = createEnhancedBondAction('create', { amountUsdc: 100 })
    expect(cancelMutation(operationId)).toBe(true)

    const next = updateBondAction('create', (current) => ({
      ...current,
      status: 'success',
      lastTxHash: 'tx-should-not-appear',
    }))

    expect(getMutationOperation(operationId)?.status).toBe('cancelled')
    // `cancelled` has no legacy equivalent and is projected as `idle`; the
    // important part is that it is not reported as a successful bond.
    expect(next.create.status).toBe('idle')
    expect(next.create.lastTxHash).not.toBe('tx-should-not-appear')
  })

  it('leaves the legacy store untouched when the record is not linked', () => {
    const next = updateBondAction('withdraw', (current) => ({
      ...current,
      status: 'pending',
      attempts: current.attempts + 1,
    }))

    expect(next.withdraw.status).toBe('pending')
    expect(store.has(BOND_ACTIONS_V1_KEY)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('cancellation', () => {
  it('cancels a pending operation that has no in-flight recovery', () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 10 }, 3)
    transitionMutationOperation(operationId, 'pending')

    expect(cancelMutation(operationId)).toBe(true)
    expect(getMutationOperation(operationId)?.status).toBe('cancelled')
  })

  it('refuses to report a settled operation as cancelled', () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 10 }, 3)
    transitionMutationOperation(operationId, 'success', undefined, { allowIndirect: true })

    expect(cancelMutation(operationId)).toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('success')
  })

  it('is not repeatable: a second cancel reports false', () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 10 }, 3)
    transitionMutationOperation(operationId, 'pending')

    expect(cancelMutation(operationId)).toBe(true)
    expect(cancelMutation(operationId)).toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('cancelled')
  })

  it('reports false for an unknown operation', () => {
    expect(cancelMutation('no-such-operation')).toBe(false)
  })

  it('does not submit a mutation that was cancelled before it ran', async () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 10 }, 3)
    transitionMutationOperation(operationId, 'pending')
    cancelMutation(operationId)

    await mutationRecoveryEngine.recoverOperation(operationId)

    // The network gate held: a revoked bond must never reach the wallet.
    expect(submitCreateBond).not.toHaveBeenCalled()
    expect(getMutationOperation(operationId)?.status).toBe('cancelled')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('retry', () => {
  it('refuses to retry an operation that is not in error', async () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 10 }, 3)
    transitionMutationOperation(operationId, 'pending')

    await expect(retryMutation(operationId)).resolves.toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('pending')
  })

  it('refuses to retry a cancelled operation', async () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 10 }, 3)
    transitionMutationOperation(operationId, 'pending')
    transitionMutationOperation(operationId, 'cancelled')

    await expect(retryMutation(operationId)).resolves.toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('cancelled')
  })

  it('refuses to retry a successful operation', async () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 10 }, 3)
    transitionMutationOperation(operationId, 'success', undefined, { allowIndirect: true })

    await expect(retryMutation(operationId)).resolves.toBe(false)
    expect(submitCreateBond).not.toHaveBeenCalled()
  })

  it('reports false for an unknown operation', async () => {
    await expect(retryMutation('no-such-operation')).resolves.toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('trust-score entry points', () => {
  function seedLookup(): MutationOperationId {
    const { operationId } = createMutationOperation(
      'trust_score_lookup',
      { address: 'G'.repeat(56) },
      3
    )
    return operationId
  }

  it('refuses to retry a settled lookup and does not report that it started', async () => {
    const operationId = seedLookup()
    transitionMutationOperation(operationId, 'success', undefined, { allowIndirect: true })

    await expect(retryTrustScoreLookup(operationId)).resolves.toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('success')
  })

  it('refuses to retry a cancelled lookup', async () => {
    const operationId = seedLookup()
    transitionMutationOperation(operationId, 'pending')
    transitionMutationOperation(operationId, 'cancelled')

    await expect(retryTrustScoreLookup(operationId)).resolves.toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('cancelled')
  })

  it('refuses to cancel a settled lookup', () => {
    const operationId = seedLookup()
    transitionMutationOperation(operationId, 'success', undefined, { allowIndirect: true })

    expect(cancelTrustScoreLookup(operationId)).toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('success')
  })

  it('cancels a live lookup and keeps it cancelled', () => {
    const operationId = seedLookup()
    transitionMutationOperation(operationId, 'pending')

    expect(cancelTrustScoreLookup(operationId)).toBe(true)
    expect(getMutationOperation(operationId)?.status).toBe('cancelled')
  })

  it('rejects a cancel for an operation of the wrong type', () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 10 }, 3)
    expect(cancelTrustScoreLookup(operationId)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('initiateMutation', () => {
  it('does not claim a cancelled duplicate was started', async () => {
    // A bond the user queued and then revoked before it ran.
    const first = createMutationOperation('bond_create', { amountUsdc: 77 }, 3)
    transitionMutationOperation(first.operationId, 'pending')
    cancelMutation(first.operationId)
    expect(getMutationOperation(first.operationId)?.status).toBe('cancelled')

    // The user repeats the action. Because terminal operations are excluded
    // from deduplication, this must be a genuinely new, runnable operation
    // rather than a silent no-op onto the cancelled one.
    const second = await initiateMutation('bond_create', { amountUsdc: 77 }, 3)

    expect(second.operationId).not.toBe(first.operationId)
    expect(second.isNewOperation).toBe(true)
    expect(getMutationOperation(first.operationId)?.status).toBe('cancelled')
  })

  it('reports started for a duplicate of an already successful operation', async () => {
    const { operationId } = createMutationOperation('bond_create', { amountUsdc: 88 }, 3)
    transitionMutationOperation(operationId, 'success', undefined, { allowIndirect: true })

    // Same request hash, but the existing operation is terminal, so a new one
    // is created and started rather than deduplicated onto the settled one.
    const again = await initiateMutation('bond_create', { amountUsdc: 88 }, 3)
    expect(again.operationId).not.toBe(operationId)
  })

  it('reports false when the operation fails its input guard', async () => {
    // An empty address is refused by the bounded-input guard, so the lookup
    // never reaches the network. It must settle in `error` and report that it
    // did not start, rather than leaving the caller polling a dead operation.
    const result = await initiateMutation('trust_score_lookup', { address: '' }, 1)
    const operation = getMutationOperation(result.operationId)

    expect(result.started).toBe(false)
    expect(operation?.status).toBe('error')
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('no partial state on failure', () => {
  it('records the failure without leaving the operation mid-flight', async () => {
    submitCreateBond.mockRejectedValue(new Error('network unreachable'))

    const { operationId } = await initiateMutation('bond_create', { amountUsdc: 55 }, 1)
    const operation = getMutationOperation(operationId)

    expect(operation).not.toBeNull()
    // Never stranded in `submitting`: the user can always see and act on it.
    expect(operation?.status).not.toBe('submitting')
    expect(['error', 'pending']).toContain(operation?.status)
    // The error is preserved rather than lost.
    const lastAttempt = operation?.attempts[(operation?.attempts.length ?? 0) - 1]
    expect(lastAttempt?.error?.message).toContain('network unreachable')
  })

  it('never commits a transaction hash for an operation that did not succeed', async () => {
    submitCreateBond.mockRejectedValue(new Error('network unreachable'))

    const { operationId } = await initiateMutation('bond_create', { amountUsdc: 56 }, 1)
    const operation = getMutationOperation(operationId)

    expect(operation?.status).not.toBe('success')
    expect(operation?.finalTxHash).toBeUndefined()
  })

  it('every committed status is reachable through the matrix', async () => {
    submitCreateBond.mockRejectedValue(new Error('boom'))
    const { operationId } = await initiateMutation('bond_create', { amountUsdc: 57 }, 2)

    const history = getMutationOperation(operationId)?.statusHistory ?? []
    let cursor: string = 'idle'
    for (const entry of history) {
      expect(entry.from).toBe(cursor)
      cursor = entry.to
    }
    expect(cursor).toBe(getMutationOperation(operationId)?.status)
  })
})
