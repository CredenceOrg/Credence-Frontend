import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  RECENT_LOOKUPS_LEGACY_KEY,
  RECENT_LOOKUPS_V1_KEY,
  readRecentLookups,
  writeRecentLookups,
} from './recentLookupsStorage'

const ADDR1 = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const ADDR2 = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

describe('recentLookupsStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('reads legacy array and migrates forward to v1 without deleting legacy (upgrade + rollback compatible)', () => {
    localStorage.setItem(
      RECENT_LOOKUPS_LEGACY_KEY,
      JSON.stringify([
        { address: ADDR1, timestamp: 1 },
        { address: ADDR2, timestamp: 2 },
      ])
    )

    const items = readRecentLookups()
    expect(items).toHaveLength(2)

    // v1 created
    const v1 = JSON.parse(localStorage.getItem(RECENT_LOOKUPS_V1_KEY)!)
    expect(v1.schemaVersion).toBe(1)
    expect(v1.items).toHaveLength(2)

    // legacy preserved
    expect(JSON.parse(localStorage.getItem(RECENT_LOOKUPS_LEGACY_KEY)!)).toHaveLength(2)
  })

  it('prefers v1 when present', () => {
    localStorage.setItem(
      RECENT_LOOKUPS_V1_KEY,
      JSON.stringify({ schemaVersion: 1, items: [{ address: ADDR1, timestamp: 123 }] })
    )
    localStorage.setItem(
      RECENT_LOOKUPS_LEGACY_KEY,
      JSON.stringify([{ address: ADDR2, timestamp: 456 }])
    )

    const items = readRecentLookups()
    expect(items).toEqual([{ address: ADDR1, timestamp: 123 }])
  })

  it('dual-writes to v1 and legacy on update (rollback safe)', () => {
    writeRecentLookups([{ address: ADDR1, timestamp: 10 }])

    const v1 = JSON.parse(localStorage.getItem(RECENT_LOOKUPS_V1_KEY)!)
    expect(v1).toMatchObject({ schemaVersion: 1, items: [{ address: ADDR1, timestamp: 10 }] })

    const legacy = JSON.parse(localStorage.getItem(RECENT_LOOKUPS_LEGACY_KEY)!)
    expect(legacy).toEqual([{ address: ADDR1, timestamp: 10 }])
  })

  it('is resumable when the v1 write fails (no partial migration, rerun succeeds)', () => {
    localStorage.setItem(
      RECENT_LOOKUPS_LEGACY_KEY,
      JSON.stringify([{ address: ADDR1, timestamp: 1 }])
    )

    const originalSetItem = localStorage.setItem.bind(localStorage)
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === RECENT_LOOKUPS_V1_KEY) {
        throw new Error('quota exceeded')
      }
      return originalSetItem(key, value)
    })

    // Should not throw; should still return legacy items.
    expect(readRecentLookups()).toEqual([{ address: ADDR1, timestamp: 1 }])
    expect(localStorage.getItem(RECENT_LOOKUPS_V1_KEY)).toBeNull()

    // Rerun with normal storage succeeds.
    vi.restoreAllMocks()
    expect(readRecentLookups()).toEqual([{ address: ADDR1, timestamp: 1 }])
    expect(localStorage.getItem(RECENT_LOOKUPS_V1_KEY)).not.toBeNull()
  })
})
