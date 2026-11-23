import type { Transaction } from '../api/types'
import type { CredenceNetwork } from './networkLabels'
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
 * Scoped format (v2):
 * - key: credence:pendingTransactions:v2::<network>::<address>
 * - value: { schemaVersion: 2, items: TransactionWithNetwork[] }
 * - Each entry is scoped to a specific (network, address) pair
 *
 * Compatibility policy mirrors `recentLookupsStorage.ts`.
 */
export const PENDING_TXS_LEGACY_KEY = 'credence:pendingTransactions'
export const PENDING_TXS_V1_KEY = 'credence:pendingTransactions:v1'
export const PENDING_TXS_V2_PREFIX = 'credence:pendingTransactions:v2'

type PendingTxsV1 = {
  schemaVersion: 1
  items: Transaction[]
  migratedFrom?: 'v0'
  migratedAt?: string
}

/**
 * Local extension of Transaction to capture the network it was recorded on.
 * This is stored in localStorage but not sent to the API.
 */
export interface TransactionWithNetwork extends Transaction {
  _network: CredenceNetwork
}

type PendingTxsV2 = {
  schemaVersion: 2
  items: TransactionWithNetwork[]
}

// A pending entry that remains pending "forever" is misleading. If the API never
// confirms it (offline, wallet crash, etc.), we surface it as failed after a
// generous time window so the user sees a resolvable state.
const STALE_PENDING_MS = 24 * 60 * 60 * 1000

/**
 * Generates a scoped storage key for a given (network, address) pair.
 * Returns null if address is empty (disconnected state).
 */
export function scopedKey(network: CredenceNetwork, address: string): string | null {
  if (!address.trim()) return null
  return `${PENDING_TXS_V2_PREFIX}::${network}::${address}`
}

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

function isTransactionWithNetwork(value: unknown): value is TransactionWithNetwork {
  if (!isTransaction(value)) return false
  const v = value as Partial<TransactionWithNetwork>
  return typeof v._network === 'string' && (v._network === 'public' || v._network === 'test')
}

function coerceTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isTransaction)
}

function coerceTransactionsWithNetwork(raw: unknown): TransactionWithNetwork[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isTransactionWithNetwork)
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

/**
 * One-time migration from v1/v0 to v2 (scoped by network and address).
 * This reads the global v1 key, clears it, and attempts to infer a network
 * from the current settings context. If no network is available, the data
 * is discarded rather than migrated under an unknown key.
 */
export function migrateToV2(network: CredenceNetwork | null, address: string): void {
  if (!address.trim()) {
    // No address - cannot migrate, just clear legacy
    clearLegacy()
    return
  }

  const v1 = readV1()
  if (v1 === null) {
    // No v1 data, just clear legacy
    clearLegacy()
    return
  }

  if (!network) {
    // No network context - discard v1 data rather than migrating under unknown network
    logWarn('pending_txs_migration_v2_skipped', { reason: 'no_network_context' })
    clearLegacy()
    return
  }

  const key = scopedKey(network, address)
  if (!key) return

  // Add network field to each transaction
  const itemsWithNetwork: TransactionWithNetwork[] = v1.map((tx) => ({
    ...tx,
    _network: network,
  }))

  const payload: PendingTxsV2 = {
    schemaVersion: 2,
    items: itemsWithNetwork,
  }

  const write = safeWriteJson(key, payload)
  if (write.ok) {
    logInfo('pending_txs_migrated', { from: 'v1', to: 'v2', count: itemsWithNetwork.length })
  } else {
    logWarn('pending_txs_migration_failed', { message: write.error.message })
  }

  clearLegacy()
}

function clearLegacy(): void {
  try {
    localStorage.removeItem(PENDING_TXS_V1_KEY)
    localStorage.removeItem(PENDING_TXS_LEGACY_KEY)
  } catch {
    // Ignore storage errors during cleanup
  }
}

/**
 * Read pending transactions for a specific (network, address) pair.
 * Returns an empty array if disconnected (address is empty).
 */
export function readPendingTransactions(network: CredenceNetwork, address: string): TransactionWithNetwork[] {
  const key = scopedKey(network, address)
  if (!key) return []

  const res = safeReadJson<PendingTxsV2>(key)
  if (!res.ok) return []
  if (!res.value) return []
  if (res.value.schemaVersion !== 2) return []

  return normalizeStalePending(coerceTransactionsWithNetwork(res.value.items))
}

/**
 * Write pending transactions for a specific (network, address) pair.
 * Does nothing if disconnected (address is empty).
 */
export function writePendingTransactions(
  network: CredenceNetwork,
  address: string,
  items: TransactionWithNetwork[]
): void {
  const key = scopedKey(network, address)
  if (!key) return

  const sanitized = coerceTransactionsWithNetwork(items)

  safeWriteJson<PendingTxsV2>(key, {
    schemaVersion: 2,
    items: sanitized,
  })
}

function normalizeStalePending(items: TransactionWithNetwork[]): TransactionWithNetwork[] {
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
    // Note: we can't write here without network/address context, so this normalization
    // is transient. The next read will re-normalize.
  }

  return next
}

export function addPendingTransaction(
  network: CredenceNetwork,
  address: string,
  tx: Transaction
): void {
  const key = scopedKey(network, address)
  if (!key) return

  const pending = readPendingTransactions(network, address)
  // Avoid duplicates by hash.
  if (pending.some((existing) => existing.hash === tx.hash)) return

  const txWithNetwork: TransactionWithNetwork = { ...tx, _network: network }
  writePendingTransactions(network, address, [txWithNetwork, ...pending])
}

export function removePendingTransaction(network: CredenceNetwork, address: string, hash: string): void {
  const key = scopedKey(network, address)
  if (!key) return

  const pending = readPendingTransactions(network, address)
  writePendingTransactions(network, address, pending.filter((tx) => tx.hash !== hash))
}
