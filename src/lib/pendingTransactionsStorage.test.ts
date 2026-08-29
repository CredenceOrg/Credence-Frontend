import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Transaction } from '../api/types'
import {
  PENDING_TXS_LEGACY_KEY,
  PENDING_TXS_V1_KEY,
  readPendingTransactions,
  writePendingTransactions,
} from './pendingTransactionsStorage'

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id ?? 'id-1',
    type: overrides.type ?? 'bond',
    timestamp: overrides.timestamp ?? new Date('2026-01-01T00:00:00Z').toISOString(),
    status: overrides.status ?? 'pending',
    hash: overrides.hash ?? 'hash-1',
    amountUsdc: overrides.amountUsdc,
  }
}

describe('pendingTransactionsStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('migrates legacy array forward to v1 without deleting legacy', () => {
    localStorage.setItem(PENDING_TXS_LEGACY_KEY, JSON.stringify([tx()]))
    const items = readPendingTransactions()
    expect(items).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(PENDING_TXS_V1_KEY)!).schemaVersion).toBe(1)
    expect(JSON.parse(localStorage.getItem(PENDING_TXS_LEGACY_KEY)!)).toHaveLength(1)
  })

  it('dual-writes to v1 and legacy', () => {
    writePendingTransactions([tx({ hash: 'hash-x' })])
    const v1 = JSON.parse(localStorage.getItem(PENDING_TXS_V1_KEY)!)
    const legacy = JSON.parse(localStorage.getItem(PENDING_TXS_LEGACY_KEY)!)
    expect(v1.items[0].hash).toBe('hash-x')
    expect(legacy[0].hash).toBe('hash-x')
  })

  it('marks very old pending entries as failed for determinism (stale handling)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'))

    const oldPending = tx({
      timestamp: new Date('2026-01-01T00:00:00Z').toISOString(),
      status: 'pending',
      hash: 'hash-old',
    })
    localStorage.setItem(
      PENDING_TXS_V1_KEY,
      JSON.stringify({ schemaVersion: 1, items: [oldPending] })
    )

    const items = readPendingTransactions()
    expect(items[0].status).toBe('failed')

    // Persisted normalization is also visible.
    const v1 = JSON.parse(localStorage.getItem(PENDING_TXS_V1_KEY)!)
    expect(v1.items[0].status).toBe('failed')
  })
})
