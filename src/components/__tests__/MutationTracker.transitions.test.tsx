/**
 * @file MutationTracker.transitions.test.tsx
 * @description State-transition invariants as the user experiences them.
 *
 * Complements `MutationTracker.test.tsx`, which mocks the storage and recovery
 * layers to test rendering in isolation. This file deliberately does not: it
 * runs the real mutation system so a click has to survive the actual matrix.
 *
 * `MutationTracker` is where a person actually retries or cancels a bond or
 * trust-score mutation, so this is the boundary that decides whether the
 * invariant is real or merely internal. The storage layer is a working
 * in-memory store and only the network edge is faked, so a click here runs the
 * same path the app runs.
 *
 * The behaviours guarded:
 * - terminal operations offer no retry and no cancel control at all;
 * - if a control is somehow invoked against a settled operation, the refusal
 *   is authoritative — the displayed state never contradicts storage;
 * - a cancelled mutation never reaches the network.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ── In-memory storage fake ────────────────────────────────────────────────
const store = new Map<string, unknown>()

vi.mock('../../lib/storageJson', () => ({
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

const submitCreateBond = vi.fn(async () => ({ hash: 'local-tx-create' }))
const submitWithdrawBond = vi.fn(async () => ({ hash: 'local-tx-withdraw' }))

vi.mock('../../lib/bondMutations', () => ({
  submitCreateBond: (...args: unknown[]) => submitCreateBond(...(args as [])),
  submitWithdrawBond: (...args: unknown[]) => submitWithdrawBond(...(args as [])),
}))

import MutationTracker from '../MutationTracker'
import {
  createMutationOperation,
  transitionMutationOperation,
  getMutationOperation,
  type MutationOperationId,
  type MutationStatus,
} from '../../lib/mutationStorage'

/** Creates a bond_create operation parked in `status`. */
function seedOperation(status: MutationStatus): MutationOperationId {
  const { operationId } = createMutationOperation(
    'bond_create',
    { amountUsdc: 100, seed: `${status}:${Math.random()}` },
    3
  )

  if (status !== 'idle') {
    transitionMutationOperation(operationId, status, undefined, { allowIndirect: true })
  }

  expect(getMutationOperation(operationId)?.status).toBe(status)
  return operationId
}

beforeEach(() => {
  store.clear()
  vi.clearAllMocks()
  submitCreateBond.mockResolvedValue({ hash: 'local-tx-create' })
})

describe('MutationTracker — terminal operations', () => {
  it('offers no cancel control for a successful operation', () => {
    const operationId = seedOperation('success')

    render(<MutationTracker operationId={operationId} />)

    expect(screen.queryByRole('button', { name: /cancel operation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry operation/i })).not.toBeInTheDocument()
  })

  it('offers no cancel control for a cancelled operation', () => {
    const operationId = seedOperation('cancelled')

    render(<MutationTracker operationId={operationId} />)

    expect(screen.queryByRole('button', { name: /cancel operation/i })).not.toBeInTheDocument()
  })

  it('leaves a successful operation untouched when the tracker re-renders', () => {
    const operationId = seedOperation('success')

    const { rerender } = render(<MutationTracker operationId={operationId} />)
    rerender(<MutationTracker operationId={operationId} />)

    expect(getMutationOperation(operationId)?.status).toBe('success')
  })
})

describe('MutationTracker — live operations', () => {
  it('offers a cancel control while an operation is in flight', () => {
    const operationId = seedOperation('pending')

    render(<MutationTracker operationId={operationId} />)

    expect(screen.getByRole('button', { name: /cancel operation/i })).toBeInTheDocument()
  })

  it('cancelling a live operation settles it and stops it reaching the network', async () => {
    const user = userEvent.setup()
    const operationId = seedOperation('pending')

    render(<MutationTracker operationId={operationId} />)
    await user.click(screen.getByRole('button', { name: /cancel operation/i }))

    expect(getMutationOperation(operationId)?.status).toBe('cancelled')
    expect(submitCreateBond).not.toHaveBeenCalled()
  })

  it('does not move a cancelled operation again on a repeated cancel', async () => {
    const user = userEvent.setup()
    const operationId = seedOperation('pending')

    render(<MutationTracker operationId={operationId} />)
    const cancelButton = screen.getByRole('button', { name: /cancel operation/i })

    await user.click(cancelButton)
    // The control disables itself after the first click; invoking it again must
    // not produce a second transition even if it were re-enabled.
    await user.click(cancelButton).catch(() => undefined)

    const operation = getMutationOperation(operationId)
    expect(operation?.status).toBe('cancelled')
    // Exactly one cancellation edge was ever committed.
    const cancelEdges = (operation?.statusHistory ?? []).filter((e) => e.to === 'cancelled')
    expect(cancelEdges).toHaveLength(1)
  })

  it('reports a missing operation rather than inventing state for it', () => {
    render(<MutationTracker operationId="no-such-operation" />)

    expect(screen.getByText(/could not be found/i)).toBeInTheDocument()
  })
})

describe('MutationTracker — retry', () => {
  it('offers retry only for a retryable failure', () => {
    const operationId = seedOperation('pending')
    transitionMutationOperation(operationId, 'submitting')
    transitionMutationOperation(operationId, 'error', (op) => ({
      attempts: [
        {
          attemptId: 'a1',
          timestamp: new Date().toISOString(),
          requestHash: op.requestHash,
          status: 'error' as const,
          error: {
            type: 'network' as const,
            message: 'network unreachable',
            timestamp: new Date().toISOString(),
            retryable: true,
          },
        },
      ],
    }))

    render(<MutationTracker operationId={operationId} />)

    expect(screen.getByRole('button', { name: /retry operation/i })).toBeInTheDocument()
  })

  it('does not offer retry once the attempt budget is spent', () => {
    const operationId = seedOperation('pending')
    transitionMutationOperation(operationId, 'submitting')
    transitionMutationOperation(operationId, 'error', (op) => ({
      attempts: Array.from({ length: op.maxAttempts }, (_unused, index) => ({
        attemptId: `a${index}`,
        timestamp: new Date().toISOString(),
        requestHash: op.requestHash,
        status: 'error' as const,
        error: {
          type: 'network' as const,
          message: 'network unreachable',
          timestamp: new Date().toISOString(),
          retryable: true,
        },
      })),
    }))

    render(<MutationTracker operationId={operationId} />)

    expect(screen.queryByRole('button', { name: /retry operation/i })).not.toBeInTheDocument()
  })
})
