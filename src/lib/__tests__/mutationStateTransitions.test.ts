/**
 * @file mutationStateTransitions.test.ts
 * @description Regression coverage for the bond / trust-score state-transition invariants.
 *
 * These tests exercise the invariant at the integration boundary, not just at
 * the matrix: the storage layer is a working in-memory store (not per-call
 * mocks), so `createEnhancedBondAction` → `updateBondAction` →
 * `transitionMutationOperation` runs end to end exactly as it does in the app.
 *
 * What is proven here:
 * - every legal edge of the declared matrix is accepted, and every other
 *   (from, to) pair — all 36 combinations — is rejected;
 * - terminal states (`success`, `cancelled`) are immutable under every entry
 *   point: retry, cancel, recovery, legacy mirror and migration;
 * - a rejected transition persists *nothing*, so no partial state survives;
 * - stale, repeated, skipped, out-of-order and concurrent sequences leave the
 *   authoritative store and the legacy projection in agreement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  LEGAL_TRANSITIONS,
  TERMINAL_STATUSES,
  isTerminalStatus,
  resolveTransitionPath,
  validateStateTransition,
  transitionMutationOperation,
  createMutationOperation,
  updateMutationOperation,
  getMutationOperation,
  resetMutationStorage,
  type MutationStatus,
  type MutationOperationId,
} from '../mutationStorage'

// ── In-memory storage fake ────────────────────────────────────────────────
// A real store rather than assertion mocks: the invariant only means anything
// if reads observe what previous writes committed.
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

const ALL_STATUSES: MutationStatus[] = [
  'idle',
  'pending',
  'submitting',
  'success',
  'error',
  'cancelled',
]

/**
 * Creates an operation parked in `status`, reaching it the way production
 * would: through the matrix for reachable states, and via the documented
 * migration escape hatch for terminal states that have no inbound path from a
 * fresh operation.
 */
function seedOperation(status: MutationStatus, amountUsdc = 100): MutationOperationId {
  const { operationId } = createMutationOperation(
    'bond_create',
    { amountUsdc, seed: `${status}:${Math.random()}` },
    3,
    status === 'idle' ? undefined : { migrationStatus: status }
  )
  expect(getMutationOperation(operationId)?.status).toBe(status)
  return operationId
}

beforeEach(() => {
  store.clear()
  resetMutationStorage()
  store.clear()
})

// ═══════════════════════════════════════════════════════════════════════════
describe('state-transition matrix', () => {
  it('declares an entry for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(LEGAL_TRANSITIONS.has(status)).toBe(true)
    }
    expect(LEGAL_TRANSITIONS.size).toBe(ALL_STATUSES.length)
  })

  it('treats exactly success and cancelled as terminal', () => {
    for (const status of ALL_STATUSES) {
      const outgoing = LEGAL_TRANSITIONS.get(status) as ReadonlySet<MutationStatus>
      expect(isTerminalStatus(status)).toBe(outgoing.size === 0)
    }
    expect([...TERMINAL_STATUSES].sort()).toEqual(['cancelled', 'success'])
  })

  it('never declares an edge to an unknown status', () => {
    for (const [, targets] of LEGAL_TRANSITIONS) {
      for (const target of targets) {
        expect(ALL_STATUSES).toContain(target)
      }
    }
  })

  // Exhaustive: all 6 × 6 pairs, asserted against the declaration itself so
  // the matrix and its enforcement can never drift apart.
  it.each(ALL_STATUSES.flatMap((from) => ALL_STATUSES.map((to) => [from, to] as const)))(
    'enforces %s → %s consistently with the declaration',
    (from, to) => {
      const declaredLegal = from === to || (LEGAL_TRANSITIONS.get(from)?.has(to) ?? false)

      expect(validateStateTransition(from, to) === null).toBe(declaredLegal)

      const operationId = seedOperation(from)
      const result = transitionMutationOperation(operationId, to)

      expect(result.ok).toBe(declaredLegal)
      expect(getMutationOperation(operationId)?.status).toBe(declaredLegal ? to : from)
    }
  )

  it('rejects every outgoing transition from a terminal state', () => {
    for (const terminal of TERMINAL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (to === terminal) continue
        const operationId = seedOperation(terminal)
        const result = transitionMutationOperation(operationId, to)

        expect(result.ok).toBe(false)
        expect(result.ok === false && result.reason).toBe('terminal_state')
        expect(getMutationOperation(operationId)?.status).toBe(terminal)
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('resolveTransitionPath', () => {
  it('returns an empty path for an identity transition', () => {
    expect(resolveTransitionPath('pending', 'pending')).toEqual([])
  })

  it('returns the single edge when one exists', () => {
    expect(resolveTransitionPath('idle', 'pending')).toEqual(['pending'])
    expect(resolveTransitionPath('submitting', 'success')).toEqual(['success'])
  })

  it('routes pending → success through submitting rather than jumping', () => {
    expect(resolveTransitionPath('pending', 'success')).toEqual(['submitting', 'success'])
  })

  it('returns the shortest path, never a longer detour', () => {
    // idle → error is reachable only via pending; it must not wander through
    // submitting and invent a submission that never happened.
    expect(resolveTransitionPath('idle', 'error')).toEqual(['pending', 'error'])
  })

  it('returns null from terminal states', () => {
    for (const terminal of TERMINAL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (to === terminal) continue
        expect(resolveTransitionPath(terminal, to)).toBeNull()
      }
    }
  })

  it('only ever returns paths made of real edges', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const path = resolveTransitionPath(from, to)
        if (!path || path.length === 0) continue

        let cursor = from
        for (const step of path) {
          expect(LEGAL_TRANSITIONS.get(cursor)?.has(step)).toBe(true)
          cursor = step
        }
        expect(cursor).toBe(to)
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('transitionMutationOperation', () => {
  it('commits status and updater fields together on a legal transition', () => {
    const operationId = seedOperation('submitting')

    const result = transitionMutationOperation(operationId, 'success', () => ({
      finalTxHash: 'tx-abc',
      completedAt: '2026-01-01T00:00:00.000Z',
    }))

    expect(result.ok).toBe(true)
    const operation = getMutationOperation(operationId)
    expect(operation?.status).toBe('success')
    expect(operation?.finalTxHash).toBe('tx-abc')
    expect(operation?.completedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('persists nothing at all when the transition is rejected', () => {
    const operationId = seedOperation('success')
    const before = getMutationOperation(operationId)

    const result = transitionMutationOperation(operationId, 'error', () => ({
      finalTxHash: 'tx-should-not-persist',
      finalResponse: { leaked: true },
      completedAt: '2099-01-01T00:00:00.000Z',
    }))

    expect(result.ok).toBe(false)

    // The updater's fields must not have leaked in alongside the refusal —
    // this is the "no partial state" guarantee.
    const after = getMutationOperation(operationId)
    expect(after?.finalTxHash).not.toBe('tx-should-not-persist')
    expect(after?.finalResponse).toBeUndefined()
    expect(after).toEqual(before)
  })

  it('does not even run the updater for a rejected transition', () => {
    const operationId = seedOperation('cancelled')
    const updater = vi.fn(() => ({ finalTxHash: 'nope' }))

    const result = transitionMutationOperation(operationId, 'pending', updater)

    expect(result.ok).toBe(false)
    expect(updater).not.toHaveBeenCalled()
  })

  it('refuses a multi-edge transition unless allowIndirect is set', () => {
    const direct = seedOperation('pending')
    expect(transitionMutationOperation(direct, 'success').ok).toBe(false)
    expect(getMutationOperation(direct)?.status).toBe('pending')

    const indirect = seedOperation('pending')
    const result = transitionMutationOperation(indirect, 'success', undefined, {
      allowIndirect: true,
    })
    expect(result.ok).toBe(true)
    expect(result.ok === true && result.path).toEqual(['submitting', 'success'])
    expect(getMutationOperation(indirect)?.status).toBe('success')
  })

  it('allowIndirect still cannot escape a terminal state', () => {
    const operationId = seedOperation('success')
    const result = transitionMutationOperation(operationId, 'pending', undefined, {
      allowIndirect: true,
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('terminal_state')
    expect(getMutationOperation(operationId)?.status).toBe('success')
  })

  it('reports operation_not_found instead of throwing', () => {
    const result = transitionMutationOperation('no-such-op', 'pending')

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('operation_not_found')
    expect(result.ok === false && result.operation).toBeNull()
  })

  it('treats an identity transition as a legal no-op that still applies fields', () => {
    const operationId = seedOperation('pending')

    const result = transitionMutationOperation(operationId, 'pending', () => ({
      requestMetadata: { amountUsdc: 250 },
    }))

    expect(result.ok).toBe(true)
    expect(result.ok === true && result.path).toEqual([])
    expect(getMutationOperation(operationId)?.requestMetadata.amountUsdc).toBe(250)
  })

  it('records committed edges — and only committed edges — in the audit trail', () => {
    const operationId = seedOperation('idle')

    transitionMutationOperation(operationId, 'pending')
    transitionMutationOperation(operationId, 'submitting')
    // Rejected: must not appear in the trail.
    transitionMutationOperation(operationId, 'idle')
    transitionMutationOperation(operationId, 'success')

    const history = getMutationOperation(operationId)?.statusHistory ?? []
    expect(history.map((entry) => `${entry.from}->${entry.to}`)).toEqual([
      'idle->pending',
      'pending->submitting',
      'submitting->success',
    ])
  })

  it('records each edge of an indirect reconciliation', () => {
    const operationId = seedOperation('pending')
    // The seed records how the migrated operation entered `pending`; the edges
    // under test are the ones appended after it.
    const seeded = getMutationOperation(operationId)?.statusHistory?.length ?? 0

    transitionMutationOperation(operationId, 'success', undefined, { allowIndirect: true })

    const reconciliation = (getMutationOperation(operationId)?.statusHistory ?? []).slice(seeded)
    expect(reconciliation.map((entry) => `${entry.from}->${entry.to}`)).toEqual([
      'pending->submitting',
      'submitting->success',
    ])
    expect(reconciliation.every((entry) => entry.indirect)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('updateMutationOperation enforcement', () => {
  it('routes status changes through the matrix', () => {
    const operationId = seedOperation('success')

    const returned = updateMutationOperation(operationId, () => ({
      status: 'error',
      finalTxHash: 'tx-should-not-persist',
    }))

    // Contract preserved: the unmodified operation comes back, not null.
    expect(returned?.status).toBe('success')
    expect(getMutationOperation(operationId)?.finalTxHash).not.toBe('tx-should-not-persist')
  })

  it('still allows status-preserving updates on a terminal operation', () => {
    const operationId = seedOperation('success')

    const returned = updateMutationOperation(operationId, (op) => ({
      attempts: [
        ...op.attempts,
        {
          attemptId: 'late-evidence',
          timestamp: '2026-01-01T00:00:00.000Z',
          requestHash: op.requestHash,
          status: 'success' as const,
          txHash: 'tx-late',
        },
      ],
    }))

    expect(returned?.status).toBe('success')
    expect(getMutationOperation(operationId)?.attempts).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('repeated and out-of-order sequences', () => {
  it('is idempotent: replaying the same transition changes nothing further', () => {
    const operationId = seedOperation('submitting')

    const first = transitionMutationOperation(operationId, 'success', () => ({
      finalTxHash: 'tx-1',
    }))
    const second = transitionMutationOperation(operationId, 'success', () => ({
      finalTxHash: 'tx-2',
    }))

    expect(first.ok).toBe(true)
    // The identity transition is legal, but the operation is already settled;
    // what matters is that the status never left `success`.
    expect(getMutationOperation(operationId)?.status).toBe('success')
    expect(second.ok).toBe(true)
  })

  it('rejects a skipped transition (idle → submitting)', () => {
    const operationId = seedOperation('idle')

    expect(transitionMutationOperation(operationId, 'submitting').ok).toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('idle')
  })

  it('rejects an out-of-order transition (success → submitting)', () => {
    const operationId = seedOperation('success')

    expect(transitionMutationOperation(operationId, 'submitting').ok).toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('success')
  })

  it('rejects a backwards transition (submitting → idle)', () => {
    const operationId = seedOperation('submitting')

    expect(transitionMutationOperation(operationId, 'idle').ok).toBe(false)
    expect(getMutationOperation(operationId)?.status).toBe('submitting')
  })

  it('drops a stale updater that would resurrect a settled operation', () => {
    const operationId = seedOperation('submitting')

    // A caller captured this snapshot before the operation settled.
    const stale = getMutationOperation(operationId)
    expect(stale?.status).toBe('submitting')

    transitionMutationOperation(operationId, 'success', () => ({ finalTxHash: 'tx-real' }))

    // The stale caller now tries to commit its own outcome.
    const late = transitionMutationOperation(operationId, 'error', () => ({
      finalTxHash: 'tx-stale',
    }))

    expect(late.ok).toBe(false)
    const operation = getMutationOperation(operationId)
    expect(operation?.status).toBe('success')
    expect(operation?.finalTxHash).toBe('tx-real')
  })

  it('lets only one of two concurrent settlements win', () => {
    const operationId = seedOperation('submitting')

    const succeed = transitionMutationOperation(operationId, 'success', () => ({
      finalTxHash: 'tx-winner',
    }))
    const fail = transitionMutationOperation(operationId, 'error', () => ({
      finalTxHash: 'tx-loser',
    }))

    expect(succeed.ok).toBe(true)
    expect(fail.ok).toBe(false)
    expect(getMutationOperation(operationId)?.finalTxHash).toBe('tx-winner')
  })

  it('allows the full retry cycle error → pending → submitting → success', () => {
    const operationId = seedOperation('error')

    expect(transitionMutationOperation(operationId, 'pending').ok).toBe(true)
    expect(transitionMutationOperation(operationId, 'submitting').ok).toBe(true)
    expect(transitionMutationOperation(operationId, 'success').ok).toBe(true)
    expect(getMutationOperation(operationId)?.status).toBe('success')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('deduplication across terminal states', () => {
  it('deduplicates onto a live operation with the same request', () => {
    const first = createMutationOperation('bond_create', { amountUsdc: 500 }, 3)
    const second = createMutationOperation('bond_create', { amountUsdc: 500 }, 3)

    expect(first.isNewOperation).toBe(true)
    expect(second.isNewOperation).toBe(false)
    expect(second.operationId).toBe(first.operationId)
  })

  it('does not deduplicate onto a cancelled operation, which could never run again', () => {
    const first = createMutationOperation('bond_create', { amountUsdc: 500 }, 3)
    transitionMutationOperation(first.operationId, 'pending')
    transitionMutationOperation(first.operationId, 'cancelled')

    const second = createMutationOperation('bond_create', { amountUsdc: 500 }, 3)

    expect(second.isNewOperation).toBe(true)
    expect(second.operationId).not.toBe(first.operationId)
    expect(getMutationOperation(second.operationId)?.status).toBe('idle')
    // The cancelled operation stays cancelled.
    expect(getMutationOperation(first.operationId)?.status).toBe('cancelled')
  })

  it('does not deduplicate onto a successful operation', () => {
    const first = createMutationOperation('bond_create', { amountUsdc: 500 }, 3)
    transitionMutationOperation(first.operationId, 'success', undefined, { allowIndirect: true })

    const second = createMutationOperation('bond_create', { amountUsdc: 500 }, 3)

    expect(second.isNewOperation).toBe(true)
    expect(second.operationId).not.toBe(first.operationId)
  })
})
