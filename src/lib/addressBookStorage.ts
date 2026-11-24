import { safeReadJson, safeWriteJson } from './storageJson'
import { logInfo, logWarn } from './log'
import { isValidStellarAddress, sanitizeAddressInput } from './stellar'

export const ADDRESS_BOOK_SCHEMA_VERSION = 1
export const ADDRESS_BOOK_MAX_ENTRIES = 50
export const ADDRESS_BOOK_MAX_LABEL_LENGTH = 64

export interface AddressBookEntry {
  id: string
  label: string
  address: string
  createdAt: string
  updatedAt: string
}

export type AddressBookValidationResult =
  | { ok: true; label: string; address: string }
  | { ok: false; error: string }

type AddressBookV1 = {
  schemaVersion: 1
  entries: AddressBookEntry[]
  migratedFrom?: 'v0'
  migratedAt?: string
}

function normalizeWalletScope(walletAddress: string | null | undefined): string {
  const trimmed = walletAddress?.trim()
  return trimmed ? trimmed : 'anonymous'
}

function normalizeNetworkScope(network: string | null | undefined): string {
  const trimmed = network?.trim()
  return trimmed ? trimmed : 'public'
}

export function getAddressBookStorageKey(
  walletAddress: string | null | undefined,
  network: string | null | undefined
): string {
  return `credence:address-book:v1:${normalizeNetworkScope(network)}:${normalizeWalletScope(walletAddress)}`
}

export function getAddressBookLegacyKey(
  walletAddress: string | null | undefined,
  network: string | null | undefined
): string {
  return `credence:address-book:${normalizeNetworkScope(network)}:${normalizeWalletScope(walletAddress)}`
}

function generateEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `ab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Coerces unknown input into valid, deduplicated, capped AddressBookEntry[].
 */
export function coerceAddressBookEntries(raw: unknown): AddressBookEntry[] {
  if (!Array.isArray(raw)) return []

  const seenAddresses = new Set<string>()
  const result: AddressBookEntry[] = []
  const now = new Date().toISOString()

  for (const item of raw) {
    if (result.length >= ADDRESS_BOOK_MAX_ENTRIES) break
    if (!item || typeof item !== 'object') continue

    const record = item as Record<string, unknown>
    const rawLabel = typeof record.label === 'string' ? record.label.trim() : ''
    const rawAddress = typeof record.address === 'string' ? record.address : ''
    if (!rawLabel) continue

    const sanitized = sanitizeAddressInput(rawAddress)
    if (!sanitized.ok) continue

    const address = sanitized.value
    if (!isValidStellarAddress(address)) continue
    if (seenAddresses.has(address)) continue

    seenAddresses.add(address)
    const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : generateEntryId()
    const createdAt =
      typeof record.createdAt === 'string' && record.createdAt.trim() ? record.createdAt : now
    const updatedAt =
      typeof record.updatedAt === 'string' && record.updatedAt.trim() ? record.updatedAt : createdAt

    result.push({
      id,
      label: rawLabel.slice(0, ADDRESS_BOOK_MAX_LABEL_LENGTH),
      address,
      createdAt,
      updatedAt,
    })
  }

  return result
}

/**
 * Validates a candidate address book entry against format, duplicate, and cap rules.
 */
export function validateAddressBookEntry(
  rawLabel: string,
  rawAddress: string,
  existing: AddressBookEntry[],
  editingId?: string
): AddressBookValidationResult {
  const label = rawLabel.trim()
  if (!label) {
    return { ok: false, error: 'Label is required.' }
  }
  if (label.length > ADDRESS_BOOK_MAX_LABEL_LENGTH) {
    return {
      ok: false,
      error: `Label must be ${ADDRESS_BOOK_MAX_LABEL_LENGTH} characters or fewer.`,
    }
  }

  const sanitized = sanitizeAddressInput(rawAddress)
  if (!sanitized.ok) {
    return { ok: false, error: sanitized.error.message }
  }

  const address = sanitized.value
  if (!isValidStellarAddress(address)) {
    return {
      ok: false,
      error: 'Invalid Stellar address. Must be a valid 56-character public key starting with G.',
    }
  }

  const isDuplicate = existing.some(
    (entry) => entry.address === address && entry.id !== editingId
  )
  if (isDuplicate) {
    return { ok: false, error: 'This address is already in your address book.' }
  }

  if (!editingId && existing.length >= ADDRESS_BOOK_MAX_ENTRIES) {
    return {
      ok: false,
      error: `Address book is full (maximum ${ADDRESS_BOOK_MAX_ENTRIES} entries).`,
    }
  }

  return { ok: true, label, address }
}

function readV1(key: string): AddressBookEntry[] | null {
  const res = safeReadJson<AddressBookV1>(key)
  if (!res.ok) return []
  if (!res.value) return null
  if (res.value.schemaVersion !== ADDRESS_BOOK_SCHEMA_VERSION) return []
  return coerceAddressBookEntries(res.value.entries)
}

function readLegacy(key: string): AddressBookEntry[] | null {
  const res = safeReadJson<unknown>(key)
  if (!res.ok) return []
  if (!res.value) return null
  return coerceAddressBookEntries(res.value)
}

function migrateFromLegacy(v1Key: string, entries: AddressBookEntry[]): void {
  const payload: AddressBookV1 = {
    schemaVersion: ADDRESS_BOOK_SCHEMA_VERSION,
    entries,
    migratedFrom: 'v0',
    migratedAt: new Date().toISOString(),
  }
  const write = safeWriteJson(v1Key, payload)
  if (write.ok) {
    logInfo('address_book_migrated', { from: 'v0', to: 'v1', count: entries.length })
  } else {
    logWarn('address_book_migration_failed', { message: write.error.message })
  }
}

/**
 * Reads address book entries scoped to a wallet and network.
 * - Prefers v1 if present and valid.
 * - Falls back to legacy v0 and opportunistically migrates to v1.
 */
export function readAddressBook(
  walletAddress: string | null | undefined,
  network: string | null | undefined
): AddressBookEntry[] {
  const v1Key = getAddressBookStorageKey(walletAddress, network)
  const v1 = readV1(v1Key)
  if (v1 !== null) return v1

  const legacyKey = getAddressBookLegacyKey(walletAddress, network)
  const legacy = readLegacy(legacyKey)
  if (legacy === null) return []

  migrateFromLegacy(v1Key, legacy)
  return legacy
}

/**
 * Writes sanitized, deduplicated, capped address book entries to v1 storage.
 */
export function writeAddressBook(
  walletAddress: string | null | undefined,
  network: string | null | undefined,
  entries: AddressBookEntry[]
): boolean {
  const v1Key = getAddressBookStorageKey(walletAddress, network)
  const sanitized = coerceAddressBookEntries(entries)
  const result = safeWriteJson<AddressBookV1>(v1Key, {
    schemaVersion: ADDRESS_BOOK_SCHEMA_VERSION,
    entries: sanitized,
  })
  return result.ok
}
