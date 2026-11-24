import { useCallback, useState } from 'react'
import type { RecentLookupItem } from '../lib/recentLookupsStorage'
import { readRecentLookups, removeRecentLookup, writeRecentLookups } from '../lib/recentLookupsStorage'

/**
 * React wrapper around the versioned recent-lookups storage.
 *
 * This replaces direct `useLocalStorage('credence:recent-lookups', ...)` usage so:
 * - legacy arrays are migrated forward deterministically
 * - writes are dual-written for rollback compatibility
 */
export function useRecentLookups(): [
  RecentLookupItem[],
  (next: RecentLookupItem[]) => void,
  (address: string) => void,
] {
  const [items, setItems] = useState<RecentLookupItem[]>(() => readRecentLookups())

  const setAndPersist = useCallback((next: RecentLookupItem[]) => {
    setItems(next)
    writeRecentLookups(next)
  }, [])

  const removeItem = useCallback(
    (address: string) => {
      const next = removeRecentLookup(items, address)
      setItems(next)
      writeRecentLookups(next)
    },
    [items]
  )

  return [items, setAndPersist, removeItem]
}
