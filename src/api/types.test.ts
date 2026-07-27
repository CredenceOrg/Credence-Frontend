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
function _assertApiResponseTrustScore(
  r: ApiResponse<operations['getTrustScore']>
): TrustScore {
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
