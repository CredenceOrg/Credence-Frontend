/**
 * @file mutationRecoveryRateLimit.test.ts
 * @description Focused regression suite for the resource/rate-limit guarantees
 * added to bond and trust-score mutations:
 *
 * - A 429 (ApiRateLimitError, or a 429 ApiError carrying retryAfterMs) surfaces
 *   as an actionable `rate_limit` MutationError with `retryAfterMs`, is not
 *   auto-hammered by the backoff loop, and leaves the operation recoverable.
 * - Out-of-bounds / adversarial inputs are rejected before any expensive work,
 *   so the downstream submit/lookup path is never called with invalid input.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MutationRecoveryEngine } from '../mutationRecovery'
import * as mutationStorage from '../mutationStorage'
import * as bondMutations from '../bondMutations'
import * as apiClient from '../../api/client'
import type { MutationOperation } from '../mutationStorage'

vi.mock('../mutationStorage')
vi.mock('../bondMutations')
// Partial mock: keep the real ApiError / ApiRateLimitError classes (they carry
// real `status` / `retryAfterMs`) while stubbing only `apiFetch`.
vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client')
  return { ...actual, apiFetch: vi.fn() }
})
vi.mock('../log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

const mockStorage = mutationStorage as unknown as {
  getMutationOperation: ReturnType<typeof vi.fn>
  getMutationOperations: ReturnType<typeof vi.fn>
  updateMutationOperation: ReturnType<typeof vi.fn>
  createMutationOperation: ReturnType<typeof vi.fn>
}
const mockBondMutations = bondMutations as unknown as {
  submitCreateBond: ReturnType<typeof vi.fn>
  submitWithdrawBond: ReturnType<typeof vi.fn>
}
const mockApiClient = apiClient as unknown as { apiFetch: ReturnType<typeof vi.fn> }

// Zero-delay retry policy so tests stay fast; the rate-limit/validation paths
// being tested are non-retryable, but resumeOperation still computes a delay.
const ZERO_DELAY_POLICY = {
  maxAttempts: 3,
  baseDelayMs: 0,
  maxDelayMs: 0,
  backoffMultiplier: 2,
  retryableErrors: ['network', 'timeout', 'generic'] as ('network' | 'timeout' | 'generic')[],
}

function makeOperation(overrides: Partial<MutationOperation>): MutationOperation {
  return {
    operationId: 'test-op',
    type: 'bond_create',
    status: 'pending',
    attempts: [],
    maxAttempts: 3,
    requestHash: 'test-hash',
    requestMetadata: { amountUsdc: 1000 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    isRecovered: false,
    ...overrides,
  } as MutationOperation
}

let engine: MutationRecoveryEngine
let store: MutationOperation

beforeEach(() => {
  vi.clearAllMocks()

  // In-memory store so updaters persist and can be asserted after recovery.
  store = makeOperation({})
  mockStorage.getMutationOperation.mockImplementation((id: string) =>
    store.operationId === id ? store : null
  )
  mockStorage.getMutationOperations.mockReturnValue([])
  mockStorage.updateMutationOperation.mockImplementation(
    (_id: string, updater: (op: MutationOperation) => Partial<MutationOperation>) => {
      store = { ...store, ...updater(store) }
      return store
    }
  )
  mockBondMutations.submitCreateBond.mockResolvedValue({ hash: 'test-hash-123' })
  mockBondMutations.submitWithdrawBond.mockResolvedValue({ hash: 'test-hash-456' })
  mockApiClient.apiFetch.mockResolvedValue({ score: 850, tier: 'gold' })

  engine = new MutationRecoveryEngine(ZERO_DELAY_POLICY)
})

describe('rate limit (429) handling for bond and trust-score mutations', () => {
  it('surfaces an ApiRateLimitError as an actionable rate_limit error, not a validation error', async () => {
    store = makeOperation({ type: 'bond_create', requestMetadata: { amountUsdc: 1000 } })
    mockBondMutations.submitCreateBond.mockRejectedValue(new apiClient.ApiRateLimitError(2500))

    const recovered = await engine.recoverOperation('test-op')

    expect(recovered).toBe(false)
    expect(store.status).toBe('error')
    const attemptError = store.attempts[0]?.error
    expect(attemptError?.type).toBe('rate_limit')
    expect(attemptError?.retryAfterMs).toBe(2500)
    // Not auto-retried: a rate-limit rejection must not be hammered.
    expect(mockBondMutations.submitCreateBond).toHaveBeenCalledTimes(1)
  })

  it('maps a 429 payload retryAfterMs onto the mutation error', async () => {
    store = makeOperation({
      type: 'trust_score_lookup',
      requestMetadata: { address: 'GTEST123...' },
    })
    mockApiClient.apiFetch.mockRejectedValue(
      new apiClient.ApiError(429, 'Too many requests', { retryAfterMs: 3000 })
    )

    const recovered = await engine.recoverOperation('test-op')

    expect(recovered).toBe(false)
    expect(store.attempts[0]?.error?.type).toBe('rate_limit')
    expect(store.attempts[0]?.error?.retryAfterMs).toBe(3000)
  })

  it('leaves no partial success and stays recoverable after throttling', async () => {
    store = makeOperation({ type: 'bond_create', requestMetadata: { amountUsdc: 1000 } })
    mockBondMutations.submitCreateBond.mockRejectedValue(new apiClient.ApiRateLimitError(1000))

    await engine.recoverOperation('test-op')

    // No success hash recorded, status error not success, attempts carry the error.
    expect(store.finalTxHash).toBeUndefined()
    expect(store.status).not.toBe('success')
    expect(store.attempts[0]?.error?.type).toBe('rate_limit')

    // Recovery after the window passes: a later attempt with a healthy submit
    // succeeds with the same operation id.
    store = { ...store, status: 'pending', attempts: [] }
    mockBondMutations.submitCreateBond.mockResolvedValue({ hash: 'recovered-hash' })
    const recovered = await engine.recoverOperation('test-op')
    expect(recovered).toBe(true)
    expect(store.status).toBe('success')
    expect(store.finalTxHash).toBe('recovered-hash')
  })
})

describe('bounded input before expensive work', () => {
  it('rejects an under-minimum bond amount without calling the submit path', async () => {
    store = makeOperation({ type: 'bond_create', requestMetadata: { amountUsdc: 5 } })
    mockBondMutations.submitCreateBond.mockResolvedValue({ hash: 'should-not-run' })

    const recovered = await engine.recoverOperation('test-op')

    expect(recovered).toBe(false)
    expect(mockBondMutations.submitCreateBond).not.toHaveBeenCalled()
    expect(store.attempts[0]?.error?.type).toBe('validation')
    expect(store.attempts[0]?.error?.message).toMatch(/at least/)
    expect(store.status).toBe('error')
  })

  it('rejects an adversarial over-maximum bond amount without work', async () => {
    store = makeOperation({ type: 'bond_create', requestMetadata: { amountUsdc: 1e30 } })
    mockBondMutations.submitCreateBond.mockResolvedValue({ hash: 'should-not-run' })

    await engine.recoverOperation('test-op')

    expect(mockBondMutations.submitCreateBond).not.toHaveBeenCalled()
    expect(store.attempts[0]?.error?.type).toBe('validation')
    expect(store.attempts[0]?.error?.message).toMatch(/must not exceed/)
  })

  it('rejects a void bond with id of zero/negative without work', async () => {
    store = makeOperation({
      type: 'bond_withdraw',
      requestMetadata: { bondId: 0, amountUsdc: 500 },
    })
    mockBondMutations.submitWithdrawBond.mockResolvedValue({ hash: 'should-not-run' })

    await engine.recoverOperation('test-op')

    expect(mockBondMutations.submitWithdrawBond).not.toHaveBeenCalled()
    expect(store.attempts[0]?.error?.type).toBe('validation')
  })

  it('rejects an empty trust-score address without calling the lookup', async () => {
    store = makeOperation({ type: 'trust_score_lookup', requestMetadata: { address: '   ' } })
    mockApiClient.apiFetch.mockResolvedValue({ score: 1 })

    await engine.recoverOperation('test-op')

    expect(mockApiClient.apiFetch).not.toHaveBeenCalled()
    expect(store.attempts[0]?.error?.type).toBe('validation')
  })
})
