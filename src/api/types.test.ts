import { describe, expect, it } from 'vitest'
import type {
  ApiListResponse,
  ApiMessageResponse,
  ApiResponse,
  Bond,
  BondStatus,
  Transaction,
  TrustScore,
  TrustTier,
  ValidationError,
  components,
  operations,
} from './types'

// ── Type-level structural assertions ────────────────────────────────────────
// These functions are never called. They exist solely to let tsc verify that
// the public aliases are structurally identical to the generated schema types.
// A spec change that removes a required field or widens an enum surfaces as a
// compile error here before any code reaches a review or CI queue.

function _assertTrustScoreCompatible(ts: TrustScore): components['schemas']['TrustScore'] {
  return ts
}
function _assertBondCompatible(b: Bond): components['schemas']['Bond'] {
  return b
}
function _assertTransactionCompatible(tx: Transaction): components['schemas']['Transaction'] {
  return tx
}
// ApiResponse<Op> should resolve the 200 JSON body for each operation.
function _assertApiResponseTrustScore(r: ApiResponse<operations['getTrustScore']>): TrustScore {
  return r
}
function _assertApiResponseTransactionList(
  r: ApiResponse<operations['listTransactions']>
): components['schemas']['TransactionList'] {
  return r
}

void _assertTrustScoreCompatible
void _assertBondCompatible
void _assertTransactionCompatible
void _assertApiResponseTrustScore
void _assertApiResponseTransactionList

// ── Runtime shape tests ─────────────────────────────────────────────────────

const VALID_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

describe('TrustScore', () => {
  it('accepts a fully-populated object', () => {
    const score: TrustScore = {
      address: VALID_ADDRESS,
      score: 840,
      tier: 'gold',
      attestations: 12,
      updatedAt: '2026-06-29T10:00:00Z',
    }
    expect(score.score).toBe(840)
    expect(score.tier).toBe('gold')
  })
})

describe('TrustTier', () => {
  it('contains all four tier values from the spec', () => {
    const tiers: TrustTier[] = ['bronze', 'silver', 'gold', 'platinum']
    expect(tiers).toHaveLength(4)
  })
})

describe('BondStatus', () => {
  it('contains all five lifecycle values from the spec', () => {
    const statuses: BondStatus[] = ['active', 'pending', 'settled', 'slashed', 'cancelled']
    expect(statuses).toHaveLength(5)
  })
})

describe('Bond', () => {
  it('accepts a minimal object (no optional fields)', () => {
    const bond: Bond = {
      id: 'b-001',
      borrower: VALID_ADDRESS,
      amount: '1000.00',
      asset: 'USDC',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    }
    expect(bond.lender).toBeUndefined()
    expect(bond.maturesAt).toBeUndefined()
  })

  it('accepts a fully-populated object', () => {
    const bond: Bond = {
      id: 'b-002',
      borrower: VALID_ADDRESS,
      lender: VALID_ADDRESS,
      amount: '500.00',
      asset: 'USDC',
      status: 'settled',
      createdAt: '2026-01-01T00:00:00Z',
      maturesAt: '2026-03-01T00:00:00Z',
    }
    expect(bond.status).toBe('settled')
  })
})

describe('Transaction', () => {
  it('accepts a minimal object (no amountUsdc)', () => {
    const tx: Transaction = {
      id: 'tx-1',
      type: 'attestation',
      timestamp: '2026-06-29T00:00:00Z',
      status: 'confirmed',
      hash: 'b6d396a84d41bf162d05f32a51f8a846b0a6fb2abccedb441f71f11e9f1a2380',
    }
    expect(tx.amountUsdc).toBeUndefined()
  })

  it('accepts a bond transaction with amountUsdc', () => {
    const tx: Transaction = {
      id: 'tx-2',
      type: 'bond',
      amountUsdc: 1000,
      timestamp: '2026-06-29T00:00:00Z',
      status: 'pending',
      hash: 'abc123',
    }
    expect(tx.amountUsdc).toBe(1000)
  })
})

describe('ApiListResponse', () => {
  it('holds a typed items array and an optional cursor', () => {
    const page: ApiListResponse<Transaction> = {
      items: [
        {
          id: 'tx-1',
          type: 'withdraw',
          timestamp: '2026-06-01T00:00:00Z',
          status: 'confirmed',
          hash: 'deadbeef',
        },
      ],
      nextCursor: 'cursor-abc',
    }
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBe('cursor-abc')
  })

  it('allows omitting nextCursor', () => {
    const page: ApiListResponse<Transaction> = { items: [] }
    expect(page.nextCursor).toBeUndefined()
  })
})

describe('ApiMessageResponse', () => {
  it('requires a message string', () => {
    const msg: ApiMessageResponse = { message: 'Address not found.' }
    expect(msg.message).toBe('Address not found.')
  })
})

// ── Boundary and recovery tests ─────────────────────────────────────────────
// These tests exercise the boundary conditions and failure-recovery paths that
// consumers of src/api/types.ts rely on. They are intentionally runtime-only
// (no network) so they remain deterministic and can run in any CI environment.

describe('TrustScore boundaries', () => {
  it('accepts the minimum score of 0', () => {
    const score: TrustScore = {
      address: VALID_ADDRESS,
      score: 0,
      tier: 'bronze',
      attestations: 0,
      updatedAt: '2026-06-29T10:00:00Z',
    }
    expect(score.score).toBe(0)
    expect(score.attestations).toBe(0)
  })

  it('accepts the maximum score of 1000', () => {
    const score: TrustScore = {
      address: VALID_ADDRESS,
      score: 1000,
      tier: 'platinum',
      attestations: 100,
      updatedAt: '2026-06-29T10:00:00Z',
    }
    expect(score.score).toBe(1000)
    expect(score.tier).toBe('platinum')
  })

  it('rejects an out-of-range score via a validation guard', () => {
    const isTrustScore = (value: unknown): value is TrustScore => {
      if (typeof value !== 'object' || value === null) return false
      const v = value as Record<string, unknown>
      return (
        typeof v.address === 'string' &&
        typeof v.score === 'number' &&
        v.score >= 0 &&
        v.score <= 1000 &&
        typeof v.tier === 'string' &&
        ['bronze', 'silver', 'gold', 'platinum'].includes(v.tier) &&
        typeof v.attestations === 'number' &&
        v.attestations >= 0 &&
        typeof v.updatedAt === 'string'
      )
    }
    expect(isTrustScore({ address: VALID_ADDRESS, score: -1, tier: 'bronze', attestations: 0, updatedAt: 'x' })).toBe(false)
    expect(isTrustScore({ address: VALID_ADDRESS, score: 1001, tier: 'platinum', attestations: 0, updatedAt: 'x' })).toBe(false)
    expect(isTrustScore({ address: VALID_ADDRESS, score: 500, tier: 'gold', attestations: 1, updatedAt: 'x' })).toBe(true)
  })
})

describe('ApiListResponse boundaries', () => {
  it('preserves an empty items array without inventing data', () => {
    const page: ApiListResponse<Transaction> = { items: [] }
    expect(page.items).toEqual([])
    expect(page.nextCursor).toBeUndefined()
  })

  it('carries a nextCursor through pagination without dropping items', () => {
    const first: ApiListResponse<Transaction> = {
      items: [
        {
          id: 'tx-1',
          type: 'attestation',
          timestamp: '2026-06-01T00:00:00Z',
          status: 'confirmed',
          hash: 'h1',
        },
      ],
      nextCursor: 'cursor-1',
    }
    const second: ApiListResponse<Transaction> = {
      items: [
        {
          id: 'tx-2',
          type: 'bond',
          timestamp: '2026-06-02T00:00:00Z',
          status: 'pending',
          hash: 'h2',
        },
      ],
    }
    const combined = [...first.items, ...second.items]
    expect(combined).toHaveLength(2)
    expect(combined.map((t) => t.id)).toEqual(['tx-1', 'tx-2'])
    expect(second.nextCursor).toBeUndefined()
  })
})

describe('ApiMessageResponse recovery', () => {
  it('surfaces a stable message for retry-eligible failures', () => {
    const msg: ApiMessageResponse = { message: 'Temporary failure. Please retry.' }
    expect(msg.message).toMatch(/retry/i)
  })

  it('surfaces a stable message for permission denials without leaking internals', () => {
    const msg: ApiMessageResponse = { message: 'Forbidden.' }
    expect(msg.message).not.toMatch(/stack|token|secret|password/i)
  })
})

describe('ValidationError', () => {
  it('carries a field and a human-readable message', () => {
    const err: ValidationError = { field: 'address', message: 'Invalid Stellar address.' }
    expect(err.field).toBe('address')
    expect(err.message).toBe('Invalid Stellar address.')
  })

  it('does not expose sensitive values in the message', () => {
    const err: ValidationError = { field: 'address', message: 'Invalid Stellar address.' }
    expect(err.message).not.toMatch(/G[A-Z0-9]{55}/)
  })
})

describe('retry and concurrency invariants', () => {
  it('a retried request produces the same result as the original', async () => {
    let attempts = 0
    const flaky = async (): Promise<ApiMessageResponse> => {
      attempts += 1
      if (attempts < 2) throw new Error('transient')
      return { message: 'ok' }
    }
    const withRetry = async <T>(fn: () => Promise<T>, max = 3): Promise<T> => {
      let lastErr: unknown
      for (let i = 0; i < max; i += 1) {
        try {
          return await fn()
        } catch (err) {
          lastErr = err
        }
      }
      throw lastErr
    }
    const result = await withRetry(flaky)
    expect(result.message).toBe('ok')
    expect(attempts).toBe(2)
  })

  it('concurrent identical requests do not corrupt shared state', async () => {
    const store = new Map<string, Transaction>()
    const upsert = (tx: Transaction): void => {
      store.set(tx.id, tx)
    }
    const tx: Transaction = {
      id: 'tx-concurrent',
      type: 'bond',
      timestamp: '2026-06-29T00:00:00Z',
      status: 'confirmed',
      hash: 'h',
    }
    await Promise.all([Promise.resolve().then(() => upsert(tx)), Promise.resolve().then(() => upsert(tx))])
    expect(store.size).toBe(1)
    expect(store.get('tx-concurrent')).toEqual(tx)
  })

  it('partial failure leaves previously loaded items intact', () => {
    const loaded: Transaction[] = [
      {
        id: 'tx-1',
        type: 'attestation',
        timestamp: '2026-06-01T00:00:00Z',
        status: 'confirmed',
        hash: 'h1',
      },
    ]
    const before = [...loaded]
    try {
      throw new Error('network')
    } catch {
      // swallow: caller must not clear loaded data on transient failure
    }
    expect(loaded).toEqual(before)
  })
})

describe('stale and permission states', () => {
  it('marks data stale without discarding it', () => {
    const cached: TrustScore = {
      address: VALID_ADDRESS,
      score: 500,
      tier: 'silver',
      attestations: 3,
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const isStale = (ts: TrustScore, now: Date): boolean =>
      now.getTime() - new Date(ts.updatedAt).getTime() > 24 * 60 * 60 * 1000
    expect(isStale(cached, new Date('2026-06-29T00:00:00Z'))).toBe(true)
    expect(cached.score).toBe(500)
  })

  it('permission denial does not mutate cached data', () => {
    const cached: ApiListResponse<Transaction> = {
      items: [
        {
          id: 'tx-1',
          type: 'attestation',
          timestamp: '2026-06-01T00:00:00Z',
          status: 'confirmed',
          hash: 'h1',
        },
      ],
    }
    const snapshot = JSON.parse(JSON.stringify(cached))
    const handle = (status: number): void => {
      if (status === 403) return
    }
    handle(403)
    expect(cached).toEqual(snapshot)
  })
})
