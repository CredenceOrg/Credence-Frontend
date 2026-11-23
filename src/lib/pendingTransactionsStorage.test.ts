import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Transaction } from '../api/types'
import {
  PENDING_TXS_LEGACY_KEY,
  PENDING_TXS_V1_KEY,
  PENDING_TXS_V2_PREFIX,
  readPendingTransactions,
  writePendingTransactions,
  addPendingTransaction,
  removePendingTransaction,
  migrateToV2,
  scopedKey,
  type TransactionWithNetwork,
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

  describe('v1/v0 legacy (deprecated, migration only)', () => {
    it('migrates legacy array forward to v1 without deleting legacy', () => {
      localStorage.setItem(PENDING_TXS_LEGACY_KEY, JSON.stringify([tx()]))
      const items = readPendingTransactions('public', 'GA')
      expect(items).toHaveLength(0) // v1 not read anymore
      expect(JSON.parse(localStorage.getItem(PENDING_TXS_V1_KEY)!).schemaVersion).toBe(1)
      expect(JSON.parse(localStorage.getItem(PENDING_TXS_LEGACY_KEY)!)).toHaveLength(1)
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

      // After migration to v2, stale handling still works
      migrateToV2('public', 'GA…A')
      const items = readPendingTransactions('public', 'GA…A')
      expect(items[0].status).toBe('failed')
    })
  })

  describe('v2 scoped storage', () => {
    it('generates scoped keys for (network, address) pairs', () => {
      expect(scopedKey('public', 'GA…A')).toBe('credence:pendingTransactions:v2::public::GA…A')
      expect(scopedKey('test', 'GB…B')).toBe('credence:pendingTransactions:v2::test::GB…B')
      expect(scopedKey('public', '')).toBeNull()
      expect(scopedKey('public', '   ')).toBeNull()
    })

    it('reads and writes scoped pending transactions', () => {
      const network = 'public'
      const address = 'GA…A'

      const tx1 = tx({ id: 'tx-1', hash: 'hash-1' })
      const tx2 = tx({ id: 'tx-2', hash: 'hash-2' })

      writePendingTransactions(network, address, [
        { ...tx1, _network: network },
        { ...tx2, _network: network },
      ])

      const items = readPendingTransactions(network, address)
      expect(items).toHaveLength(2)
      expect(items[0].hash).toBe('hash-1')
      expect(items[1].hash).toBe('hash-2')
      expect(items[0]._network).toBe('public')
    })

    it('returns empty array for disconnected state (empty address)', () => {
      const items = readPendingTransactions('public', '')
      expect(items).toHaveLength(0)

      writePendingTransactions('public', '', [{ ...tx(), _network: 'public' }])
      const items2 = readPendingTransactions('public', '')
      expect(items2).toHaveLength(0)
    })

    it('isolates data between different addresses on the same network', () => {
      const network = 'public'

      writePendingTransactions(network, 'GA…A', [{ ...tx({ id: 'tx-a' }), _network: network }])
      writePendingTransactions(network, 'GB…B', [{ ...tx({ id: 'tx-b' }), _network: network }])

      const itemsA = readPendingTransactions(network, 'GA…A')
      const itemsB = readPendingTransactions(network, 'GB…B')

      expect(itemsA).toHaveLength(1)
      expect(itemsA[0].id).toBe('tx-a')
      expect(itemsB).toHaveLength(1)
      expect(itemsB[0].id).toBe('tx-b')
    })

    it('isolates data between different networks for the same address', () => {
      const address = 'GA…A'

      writePendingTransactions('public', address, [{ ...tx({ id: 'tx-public' }), _network: 'public' }])
      writePendingTransactions('test', address, [{ ...tx({ id: 'tx-test' }), _network: 'test' }])

      const itemsPublic = readPendingTransactions('public', address)
      const itemsTest = readPendingTransactions('test', address)

      expect(itemsPublic).toHaveLength(1)
      expect(itemsPublic[0].id).toBe('tx-public')
      expect(itemsTest).toHaveLength(1)
      expect(itemsTest[0].id).toBe('tx-test')
    })

    it('addPendingTransaction prepends and avoids duplicates', () => {
      const network = 'public'
      const address = 'GA…A'

      addPendingTransaction(network, address, tx({ hash: 'hash-1' }))
      addPendingTransaction(network, address, tx({ hash: 'hash-2' }))

      const items = readPendingTransactions(network, address)
      expect(items).toHaveLength(2)
      expect(items[0].hash).toBe('hash-2') // prepended
      expect(items[1].hash).toBe('hash-1')

      // Duplicate hash is ignored
      addPendingTransaction(network, address, tx({ hash: 'hash-2' }))
      const itemsAfterDup = readPendingTransactions(network, address)
      expect(itemsAfterDup).toHaveLength(2)
    })

    it('removePendingTransaction removes by hash', () => {
      const network = 'public'
      const address = 'GA…A'

      addPendingTransaction(network, address, tx({ hash: 'hash-1' }))
      addPendingTransaction(network, address, tx({ hash: 'hash-2' }))

      removePendingTransaction(network, address, 'hash-1')

      const items = readPendingTransactions(network, address)
      expect(items).toHaveLength(1)
      expect(items[0].hash).toBe('hash-2')
    })

    it('stores network field on each transaction', () => {
      const network = 'test'
      const address = 'GB…B'

      addPendingTransaction(network, address, tx({ hash: 'hash-1' }))

      const items = readPendingTransactions(network, address)
      expect(items[0]._network).toBe('test')
    })
  })

  describe('v1 to v2 migration', () => {
    it('migrates v1 data to v2 scoped key and clears legacy', () => {
      const v1Data = {
        schemaVersion: 1,
        items: [tx({ hash: 'hash-migrated' })],
      }
      localStorage.setItem(PENDING_TXS_V1_KEY, JSON.stringify(v1Data))

      migrateToV2('public', 'GA…A')

      // Legacy keys cleared
      expect(localStorage.getItem(PENDING_TXS_V1_KEY)).toBeNull()
      expect(localStorage.getItem(PENDING_TXS_LEGACY_KEY)).toBeNull()

      // Data migrated to scoped v2 key
      const v2Key = scopedKey('public', 'GA…A')
      const v2Data = JSON.parse(localStorage.getItem(v2Key!)!)
      expect(v2Data.schemaVersion).toBe(2)
      expect(v2Data.items).toHaveLength(1)
      expect(v2Data.items[0].hash).toBe('hash-migrated')
      expect(v2Data.items[0]._network).toBe('public')
    })

    it('discards v1 data when no network context is available', () => {
      const v1Data = {
        schemaVersion: 1,
        items: [tx({ hash: 'hash-discarded' })],
      }
      localStorage.setItem(PENDING_TXS_V1_KEY, JSON.stringify(v1Data))

      migrateToV2(null, 'GA…A')

      // Legacy keys cleared even without migration
      expect(localStorage.getItem(PENDING_TXS_V1_KEY)).toBeNull()
      expect(localStorage.getItem(PENDING_TXS_LEGACY_KEY)).toBeNull()

      // No v2 key created
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(PENDING_TXS_V2_PREFIX))
      expect(keys).toHaveLength(0)
    })

    it('discards v1 data when address is empty', () => {
      const v1Data = {
        schemaVersion: 1,
        items: [tx({ hash: 'hash-discarded' })],
      }
      localStorage.setItem(PENDING_TXS_V1_KEY, JSON.stringify(v1Data))

      migrateToV2('public', '')

      // Legacy keys cleared
      expect(localStorage.getItem(PENDING_TXS_V1_KEY)).toBeNull()
      expect(localStorage.getItem(PENDING_TXS_LEGACY_KEY)).toBeNull()

      // No v2 key created
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(PENDING_TXS_V2_PREFIX))
      expect(keys).toHaveLength(0)
    })

    it('handles missing v1 data gracefully (no-op)', () => {
      localStorage.clear()

      migrateToV2('public', 'GA…A')

      // No errors, no keys created
      const keys = Object.keys(localStorage)
      expect(keys).toHaveLength(0)
    })
  })
})
