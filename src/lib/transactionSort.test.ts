import { describe, expect, it } from 'vitest'
import {
  ariaSortFor,
  compareTransactions,
  nextTransactionSort,
  sortTransactions,
  type SortableTransaction,
} from './transactionSort'

function tx(overrides: Partial<SortableTransaction> = {}): SortableTransaction {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    type: 'bond_create',
    status: 'confirmed',
    amountUsdc: 100,
    ...overrides,
  }
}

describe('compareTransactions', () => {
  it('orders dates oldest first', () => {
    const older = tx({ timestamp: '2026-01-01T00:00:00Z' })
    const newer = tx({ timestamp: '2026-02-01T00:00:00Z' })

    expect(compareTransactions(older, newer, 'date')).toBeLessThan(0)
    expect(compareTransactions(newer, older, 'date')).toBeGreaterThan(0)
    expect(compareTransactions(older, older, 'date')).toBe(0)
  })

  it('orders types and statuses alphabetically without locale dependence', () => {
    expect(compareTransactions(tx({ type: 'attest' }), tx({ type: 'withdraw' }), 'type')).toBe(-1)
    expect(
      compareTransactions(tx({ status: 'confirmed' }), tx({ status: 'pending' }), 'status')
    ).toBe(-1)
  })

  it('orders amounts numerically', () => {
    expect(
      compareTransactions(tx({ amountUsdc: 250 }), tx({ amountUsdc: 1000 }), 'amount')
    ).toBeLessThan(0)
  })

  it('places rows without an amount last in the ascending order', () => {
    const missing = tx({ amountUsdc: undefined })
    const present = tx({ amountUsdc: 5 })

    expect(compareTransactions(missing, present, 'amount')).toBe(1)
    expect(compareTransactions(present, missing, 'amount')).toBe(-1)
    expect(compareTransactions(missing, tx({ amountUsdc: undefined }), 'amount')).toBe(0)
  })

  it('keeps malformed timestamps comparable instead of returning NaN', () => {
    expect(compareTransactions(tx({ timestamp: 'not-a-date' }), tx(), 'date')).toBeLessThan(0)
  })
})

describe('nextTransactionSort', () => {
  it('cycles asc → desc → none for the active column', () => {
    const asc = nextTransactionSort(null, 'amount')
    expect(asc).toEqual({ key: 'amount', direction: 'asc' })

    const desc = nextTransactionSort(asc, 'amount')
    expect(desc).toEqual({ key: 'amount', direction: 'desc' })

    expect(nextTransactionSort(desc, 'amount')).toBeNull()
  })

  it('restarts at ascending when a different column is chosen', () => {
    expect(nextTransactionSort({ key: 'amount', direction: 'desc' }, 'status')).toEqual({
      key: 'status',
      direction: 'asc',
    })
  })
})

describe('ariaSortFor', () => {
  it('reports the aria-sort value for the active column only', () => {
    expect(ariaSortFor(null, 'date')).toBe('none')
    expect(ariaSortFor({ key: 'date', direction: 'asc' }, 'date')).toBe('ascending')
    expect(ariaSortFor({ key: 'date', direction: 'desc' }, 'date')).toBe('descending')
    expect(ariaSortFor({ key: 'date', direction: 'desc' }, 'amount')).toBe('none')
  })
})

describe('sortTransactions', () => {
  const rows = [
    tx({ timestamp: '2026-01-03T00:00:00Z', amountUsdc: 300, type: 'withdraw' }),
    tx({ timestamp: '2026-01-01T00:00:00Z', amountUsdc: 100, type: 'bond_create' }),
    tx({ timestamp: '2026-01-02T00:00:00Z', amountUsdc: 200, type: 'attest' }),
  ]

  it('returns the original order when no sort is active', () => {
    const result = sortTransactions(rows, null)

    expect(result).toEqual(rows)
    expect(result).not.toBe(rows)
  })

  it('sorts ascending and descending by date', () => {
    expect(
      sortTransactions(rows, { key: 'date', direction: 'asc' }).map((r) => r.amountUsdc)
    ).toEqual([100, 200, 300])
    expect(
      sortTransactions(rows, { key: 'date', direction: 'desc' }).map((r) => r.amountUsdc)
    ).toEqual([300, 200, 100])
  })

  it('is stable for equal keys, preserving server order', () => {
    const sameAmount = [
      tx({ amountUsdc: 100, type: 'attest' }),
      tx({ amountUsdc: 100, type: 'withdraw' }),
      tx({ amountUsdc: 100, type: 'bond_create' }),
    ]

    expect(
      sortTransactions(sameAmount, { key: 'amount', direction: 'asc' }).map((r) => r.type)
    ).toEqual(['attest', 'withdraw', 'bond_create'])
    expect(
      sortTransactions(sameAmount, { key: 'amount', direction: 'desc' }).map((r) => r.type)
    ).toEqual(['attest', 'withdraw', 'bond_create'])
  })

  it('keeps missing amounts last in both directions', () => {
    const withMissing = [
      tx({ amountUsdc: undefined, type: 'withdraw' }),
      tx({ amountUsdc: 10, type: 'attest' }),
      tx({ amountUsdc: 20, type: 'bond_create' }),
    ]

    expect(
      sortTransactions(withMissing, { key: 'amount', direction: 'asc' }).map((r) => r.type)
    ).toEqual(['attest', 'bond_create', 'withdraw'])
    expect(
      sortTransactions(withMissing, { key: 'amount', direction: 'desc' }).map((r) => r.type)
    ).toEqual(['bond_create', 'attest', 'withdraw'])
  })

  it('does not mutate the input array', () => {
    const copy = [...rows]

    sortTransactions(rows, { key: 'date', direction: 'desc' })

    expect(rows).toEqual(copy)
  })
})
