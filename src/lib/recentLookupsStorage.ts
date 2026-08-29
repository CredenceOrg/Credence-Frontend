import { safeReadJson, safeWriteJson } from './storageJson'
import { logInfo, logWarn } from './log'
import { isValidStellarAddress } from '@/lib/stellar'

export interface RecentLookupItem {
  address: string
  timestamp: number
}

/**
 * Legacy format (v0):
 * - key: credence:recent-lookups
 * - value: RecentLookupItem[]
 *
 * Versioned format (v1):
 * - key: credence:recent-lookups:v1
 * - value: { schemaVersion: 1, items: RecentLookupItem[], migratedFrom?: 'v0' }
 *
 * Compatibility policy:
 * - Upgrade: reads both; if only v0 exists, migrate to v1 (without deleting v0).
 * - Rollback: writes are dual-written to keep v0 up to date so older builds keep working.
 * - Corrupt/unexpected: fall back to [].
 *
 * Migrations are resumable: v0 is never deleted, so a failed v1 write can be retried.
 */
export const RECENT_LOOKUPS_LEGACY_KEY = 'credence:recent-lookups'
export const RECENT_LOOKUPS_V1_KEY = 'credence:recent-lookups:v1'

type RecentLookupsV1 = {
  schemaVersion: 1
  items: RecentLookupItem[]
  migratedFrom?: 'v0'
  migratedAt?: string
}

function coerceItems(raw: unknown): RecentLookupItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is RecentLookupItem => {
    if (!item || typeof item !== 'object') return false
    const addr = (item as { address?: unknown }).address
    const ts = (item as { timestamp?: unknown }).timestamp
    return typeof addr === 'string' && typeof ts === 'number' && isValidStellarAddress(addr)
  })
}

function readV1(): RecentLookupItem[] | null {
  const res = safeReadJson<RecentLookupsV1>(RECENT_LOOKUPS_V1_KEY)
  if (!res.ok) return []
  if (!res.value) return null
  if (res.value.schemaVersion !== 1) return []
  return coerceItems(res.value.items)
}

function readLegacy(): RecentLookupItem[] | null {
  const res = safeReadJson<unknown>(RECENT_LOOKUPS_LEGACY_KEY)
  if (!res.ok) return []
  if (!res.value) return null
  return coerceItems(res.value)
}

function migrateFromLegacy(items: RecentLookupItem[]): void {
  const payload: RecentLookupsV1 = {
    schemaVersion: 1,
    items,
    migratedFrom: 'v0',
    migratedAt: new Date().toISOString(),
  }
  const write = safeWriteJson(RECENT_LOOKUPS_V1_KEY, payload)
  if (write.ok) {
    logInfo('recent_lookups_migrated', { from: 'v0', to: 'v1', count: items.length })
  } else {
    // Resumable: legacy remains untouched; next run will try again.
    logWarn('recent_lookups_migration_failed', { message: write.error.message })
  }
}

/**
 * Reads recent lookups with backward/forward compatibility.
 * - Prefers v1 if present and valid.
 * - Falls back to legacy and opportunistically migrates to v1.
 */
export function readRecentLookups(): RecentLookupItem[] {
  const v1 = readV1()
  if (v1 !== null) return v1

  const legacy = readLegacy()
  if (legacy === null) return []

  migrateFromLegacy(legacy)
  return legacy
}

/**
 * Dual-writes to v1 and legacy to support downgrade/rollback.
 * If v1 write fails, legacy is still attempted so user data is not lost.
 */
export function writeRecentLookups(items: RecentLookupItem[]): void {
  const sanitized = coerceItems(items)

  safeWriteJson<RecentLookupsV1>(RECENT_LOOKUPS_V1_KEY, {
    schemaVersion: 1,
    items: sanitized,
  })

  // Rollback compatibility: keep legacy format current.
  safeWriteJson(RECENT_LOOKUPS_LEGACY_KEY, sanitized)
}
