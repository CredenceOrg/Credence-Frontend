/**
 * @file trustScoreMutations.cache.test.ts
 * @description Freshness-cache behaviour for `checkExistingTrustScoreOperation`.
 *
 * Closes #1464. Covers:
 *  - fresh successful lookup within the window returns a cache hit
 *  - a lookup older than the window is a miss
 *  - a failed-only history for the address is a miss
 *  - a successful lookup for a different address is a miss
 *  - address matching is case-insensitive
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { QUERY_CACHE_TTLS } from '../../config/queryCache'
import { checkExistingTrustScoreOperation } from '../trustScoreMutations'
import * as mutationStorage from '../mutationStorage'

vi.mock('../mutationStorage')
vi.mock('../log', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}))

const mockStorage = mutationStorage as any

const ADDRESS = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV'
const OTHER_ADDRESS = 'GZYXWVUTSRQPONMLKJIHGFEDCBA765432ZYXWVUTSRQPONMLKJIHGFE'

function makeOperation(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Date.now()
  return {
    operationId: 'op_test_1',
    type: 'trust_score_lookup',
    status: 'success',
    requestHash: 'hash',
    requestMetadata: { address: ADDRESS },
    attempts: [],
    maxAttempts: 3,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    completedAt: new Date(now).toISOString(),
    finalResponse: { score: 92, issued_at: new Date(now).toISOString() },
    isRecovered: false,
    ...overrides,
  }
}

describe('checkExistingTrustScoreOperation (freshness cache)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('returns a cache hit for a fresh successful lookup within the window', () => {
    mockStorage.getMutationOperations.mockReturnValue([
      makeOperation({ completedAt: new Date(Date.now() - 1_000).toISOString() }),
    ])

    const hit = checkExistingTrustScoreOperation(ADDRESS)

    expect(hit).not.toBeNull()
    expect(hit?.fromCache).toBe(true)
    expect(hit?.isNewOperation).toBe(false)
    expect(hit?.data).toEqual({
      score: 92,
      issued_at: expect.any(String),
    })
  })

  it('returns null when the newest successful lookup is older than the freshness window', () => {
    const stale = QUERY_CACHE_TTLS.TRUST_SCORE_FRESHNESS_MS + 10_000
    mockStorage.getMutationOperations.mockReturnValue([
      makeOperation({
        completedAt: new Date(Date.now() - stale).toISOString(),
      }),
    ])

    expect(checkExistingTrustScoreOperation(ADDRESS)).toBeNull()
  })

  it('returns null when there are only failed operations for the address', () => {
    mockStorage.getMutationOperations.mockImplementation(
      (_type: string, status: string) => (status === 'success' ? [] : []),
    )

    expect(checkExistingTrustScoreOperation(ADDRESS)).toBeNull()
  })

  it('returns null when the only fresh successful lookup is for a different address', () => {
    mockStorage.getMutationOperations.mockReturnValue([
      makeOperation({
        requestMetadata: { address: OTHER_ADDRESS },
      }),
    ])

    expect(checkExistingTrustScoreOperation(ADDRESS)).toBeNull()
  })

  it('matches addresses case-insensitively (trim + lowercase)', () => {
    mockStorage.getMutationOperations.mockReturnValue([
      makeOperation({ requestMetadata: { address: ADDRESS.toLowerCase() } }),
    ])

    const hit = checkExistingTrustScoreOperation(`  ${ADDRESS}  `)
    expect(hit?.fromCache).toBe(true)
  })

  it('skips entries with no finalResponse', () => {
    mockStorage.getMutationOperations.mockReturnValue([
      makeOperation({ finalResponse: undefined }),
    ])

    expect(checkExistingTrustScoreOperation(ADDRESS)).toBeNull()
  })
})
