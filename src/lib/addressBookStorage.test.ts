import { describe, it, expect, beforeEach } from 'vitest'
import {
  ADDRESS_BOOK_MAX_ENTRIES,
  ADDRESS_BOOK_SCHEMA_VERSION,
  coerceAddressBookEntries,
  getAddressBookLegacyKey,
  getAddressBookStorageKey,
  readAddressBook,
  validateAddressBookEntry,
  writeAddressBook,
  type AddressBookEntry,
} from './addressBookStorage'

const VALID_ADDR_1 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const INVALID_CHECKSUM_ADDR = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

// Helper to deterministically generate valid 56-char Stellar G-addresses for cap tests
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function encodeBase32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0x0000
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc
}

function makeValidStellarAddress(seed: number): string {
  const payload = new Uint8Array(33)
  payload[0] = 6 << 3 // Version byte for Ed25519 public key ('G')
  for (let i = 1; i < 33; i++) {
    payload[i] = (seed * 31 + i * 17) & 0xff
  }
  const crc = crc16xmodem(payload)
  const full = new Uint8Array(35)
  full.set(payload)
  full[33] = crc & 0xff
  full[34] = (crc >>> 8) & 0xff
  return encodeBase32(full)
}

function makeEntry(overrides: Partial<AddressBookEntry> = {}): AddressBookEntry {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    id: overrides.id ?? 'entry-1',
    label: overrides.label ?? 'Alice',
    address: overrides.address ?? VALID_ADDR_1,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

describe('addressBookStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persists entries scoped per wallet and network', () => {
    const addrA = makeValidStellarAddress(1)
    const addrB = makeValidStellarAddress(2)
    const addrC = makeValidStellarAddress(3)

    writeAddressBook('GWALLET1', 'public', [makeEntry({ id: '1', label: 'Mainnet W1', address: addrA })])
    writeAddressBook('GWALLET1', 'test', [makeEntry({ id: '2', label: 'Testnet W1', address: addrB })])
    writeAddressBook('GWALLET2', 'public', [makeEntry({ id: '3', label: 'Mainnet W2', address: addrC })])

    expect(readAddressBook('GWALLET1', 'public').map((e) => e.label)).toEqual(['Mainnet W1'])
    expect(readAddressBook('GWALLET1', 'test').map((e) => e.label)).toEqual(['Testnet W1'])
    expect(readAddressBook('GWALLET2', 'public').map((e) => e.label)).toEqual(['Mainnet W2'])
    expect(readAddressBook('GWALLET2', 'test')).toEqual([])
  })

  it('writes versioned v1 schema payload', () => {
    const entry = makeEntry()
    expect(writeAddressBook('GWALLET1', 'public', [entry])).toBe(true)

    const raw = window.localStorage.getItem(getAddressBookStorageKey('GWALLET1', 'public'))
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.schemaVersion).toBe(ADDRESS_BOOK_SCHEMA_VERSION)
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0].address).toBe(VALID_ADDR_1)
  })

  it('migrates legacy v0 array to v1 without deleting legacy data', () => {
    const legacyKey = getAddressBookLegacyKey('GWALLET1', 'public')
    const v1Key = getAddressBookStorageKey('GWALLET1', 'public')

    window.localStorage.setItem(
      legacyKey,
      JSON.stringify([
        { label: 'Alice', address: VALID_ADDR_1 },
        { label: 'Duplicate Alice', address: VALID_ADDR_1 },
        { label: 'Invalid', address: 'not-a-key' },
      ])
    )

    const migrated = readAddressBook('GWALLET1', 'public')
    expect(migrated).toHaveLength(1)
    expect(migrated[0].label).toBe('Alice')
    expect(migrated[0].address).toBe(VALID_ADDR_1)

    const v1Raw = window.localStorage.getItem(v1Key)
    expect(v1Raw).not.toBeNull()
    const v1Parsed = JSON.parse(v1Raw!)
    expect(v1Parsed.schemaVersion).toBe(1)
    expect(v1Parsed.migratedFrom).toBe('v0')
    expect(v1Parsed.entries).toHaveLength(1)

    // Legacy key remains intact for resumable migration
    expect(window.localStorage.getItem(legacyKey)).not.toBeNull()
  })

  it('falls back to empty array on corrupt JSON or unknown schemaVersion', () => {
    const v1Key = getAddressBookStorageKey('GWALLET1', 'public')
    window.localStorage.setItem(v1Key, '{not valid json')
    expect(readAddressBook('GWALLET1', 'public')).toEqual([])

    window.localStorage.setItem(v1Key, JSON.stringify({ schemaVersion: 99, entries: [makeEntry()] }))
    expect(readAddressBook('GWALLET1', 'public')).toEqual([])
  })

  it('caps coerced entries at ADDRESS_BOOK_MAX_ENTRIES (50) and deduplicates', () => {
    const many = Array.from({ length: ADDRESS_BOOK_MAX_ENTRIES + 10 }, (_, i) => ({
      id: `id-${i}`,
      label: `Contact ${i}`,
      address: makeValidStellarAddress(i + 1),
    }))
    // Add a duplicate of the first entry
    many.unshift({ id: 'dup', label: 'Dup', address: many[0].address })

    const coerced = coerceAddressBookEntries(many)
    expect(coerced).toHaveLength(ADDRESS_BOOK_MAX_ENTRIES)
    expect(new Set(coerced.map((e) => e.address)).size).toBe(ADDRESS_BOOK_MAX_ENTRIES)
  })

  describe('validateAddressBookEntry', () => {
    it('rejects empty label', () => {
      const res = validateAddressBookEntry('   ', VALID_ADDR_1, [])
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/label is required/i)
    })

    it('rejects invalid Stellar address and bad checksum', () => {
      const badFormat = validateAddressBookEntry('Bob', 'GBAD', [])
      expect(badFormat.ok).toBe(false)
      if (!badFormat.ok) expect(badFormat.error).toMatch(/invalid stellar address/i)

      const badChecksum = validateAddressBookEntry('Bob', INVALID_CHECKSUM_ADDR, [])
      expect(badChecksum.ok).toBe(false)
      if (!badChecksum.ok) expect(badChecksum.error).toMatch(/invalid stellar address/i)
    })

    it('rejects suspicious characters and strips stellar: prefix', () => {
      const suspicious = validateAddressBookEntry('Bob', `${VALID_ADDR_1}\u200B`, [])
      expect(suspicious.ok).toBe(false)
      if (!suspicious.ok) expect(suspicious.error).toMatch(/suspicious characters/i)

      const prefixed = validateAddressBookEntry('Alice', `stellar:${VALID_ADDR_1}`, [])
      expect(prefixed).toEqual({ ok: true, label: 'Alice', address: VALID_ADDR_1 })
    })

    it('rejects duplicate addresses but allows editing the same entry', () => {
      const existing = [makeEntry({ id: 'e1', label: 'Alice', address: VALID_ADDR_1 })]

      const dup = validateAddressBookEntry('Alice 2', VALID_ADDR_1, existing)
      expect(dup.ok).toBe(false)
      if (!dup.ok) expect(dup.error).toMatch(/already in your address book/i)

      const editSame = validateAddressBookEntry('Alice Updated', VALID_ADDR_1, existing, 'e1')
      expect(editSame).toEqual({ ok: true, label: 'Alice Updated', address: VALID_ADDR_1 })
    })

    it('rejects adding when cap of 50 entries is reached', () => {
      const fullList = Array.from({ length: ADDRESS_BOOK_MAX_ENTRIES }, (_, i) =>
        makeEntry({ id: `id-${i}`, label: `Contact ${i}`, address: makeValidStellarAddress(i + 1) })
      )

      const res = validateAddressBookEntry('Overflow', makeValidStellarAddress(999), fullList)
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error).toMatch(/maximum 50/i)
    })
  })
})
