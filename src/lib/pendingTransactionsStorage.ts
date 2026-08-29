import type { Transaction } from '../api/types'
import { safeReadJson, safeWriteJson } from './storageJson'
import { logInfo, logWarn } from './log'

/**
 * Legacy format (v0):
 * - key: credence:pendingTransactions
 * - value: Transaction[]
 *
 * Versioned format (v1):
 * - key: credence:pendingTransactions:v1
 * - value: { schemaVersion: 1, items: Transaction[], migratedFrom?: 'v0' }
 *
 * Compatibility policy mirrors `recentLookupsStorage.ts`.
 */
export const PENDING_TXS_LEGACY_KEY = 'credence:pendingTransactions'
export const PENDING_TXS_V1_KEY = 'credence:pendingTransactions:v1'

type PendingTxsV1 = {
  schemaVersion: 1
  items: Transaction[]
  migratedFrom?: 'v0'
  migratedAt?: string
}

// A pending entry that remains pending "forever" is misleading. If the API never
// confirms it (offline, wallet crash, etc.), we surface it as failed after a
// generous time window so the user sees a resolvable state.
const STALE_PENDING_MS = 24 * 60 * 60 * 1000

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<Transaction>
  return (
    typeof v.id === 'string' &&
    typeof v.type === 'string' &&
    typeof v.timestamp === 'string' &&
    typeof v.status === 'string' &&
    typeof v.hash === 'string'
  )
}

function coerceTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isTransaction)
}

function readV1(): Transaction[] | null {
  const res = safeReadJson<PendingTxsV1>(PENDING_TXS_V1_KEY)
  if (!res.ok) return []
  if (!res.value) return null
  if (res.value.schemaVersion !== 1) return []
  return coerceTransactions(res.value.items)
}

function readLegacy(): Transaction[] | null {
  const res = safeReadJson<unknown>(PENDING_TXS_LEGACY_KEY)
  if (!res.ok) return []
  if (!res.value) return null
  return coerceTransactions(res.value)
}

function migrateFromLegacy(items: Transaction[]): void {
  const payload: PendingTxsV1 = {
    schemaVersion: 1,
    items,
    migratedFrom: 'v0',
    migratedAt: new Date().toISOString(),
  }
  const write = safeWriteJson(PENDING_TXS_V1_KEY, payload)
  if (write.ok) {
    logInfo('pending_txs_migrated', { from: 'v0', to: 'v1', count: items.length })
  } else {
    logWarn('pending_txs_migration_failed', { message: write.error.message })
  }
}

export function readPendingTransactions(): Transaction[] {
  const v1 = readV1()
  if (v1 !== null) {
    return normalizeStalePending(v1)
  }

  const legacy = readLegacy()
  if (legacy === null) return []

  migrateFromLegacy(legacy)
  return normalizeStalePending(legacy)
}

export function writePendingTransactions(items: Transaction[]): void {
  const sanitized = coerceTransactions(items)

  safeWriteJson<PendingTxsV1>(PENDING_TXS_V1_KEY, {
    schemaVersion: 1,
    items: sanitized,
  })
  // Rollback compatibility
  safeWriteJson(PENDING_TXS_LEGACY_KEY, sanitized)
}

function normalizeStalePending(items: Transaction[]): Transaction[] {
  const now = Date.now()
  let changed = false
  const next = items.map((tx) => {
    if (tx.status !== 'pending') return tx
    const ts = Date.parse(tx.timestamp)
    if (Number.isNaN(ts)) return tx
    if (now - ts <= STALE_PENDING_MS) return tx
    changed = true
    return { ...tx, status: 'failed' as const }
  })

  if (changed) {
    logWarn('pending_txs_marked_stale', { count: next.filter((t) => t.status === 'failed').length })
    // Best-effort: persist the normalized view so subsequent reads are deterministic.
    writePendingTransactions(next)
  }

  return next
}

export function addPendingTransaction(tx: Transaction): void {
  const pending = readPendingTransactions()
  // Avoid duplicates by hash.
  if (pending.some((existing) => existing.hash === tx.hash)) return
  writePendingTransactions([tx, ...pending])
}

export function removePendingTransaction(hash: string): void {
  const pending = readPendingTransactions()
  writePendingTransactions(pending.filter((tx) => tx.hash !== hash))
}
