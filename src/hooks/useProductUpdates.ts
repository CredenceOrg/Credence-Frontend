import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { PRODUCT_UPDATES, LATEST_UPDATE_ID, type ProductUpdate } from '../data/productUpdates'

export const PRODUCT_UPDATES_STORAGE_KEY = 'credence:last-seen-update-id'

export interface UseProductUpdatesResult {
  updates: readonly ProductUpdate[]
  /** Number of updates the user has not yet seen. */
  unreadCount: number
  /** Marks all current updates as seen and persists the state to localStorage. */
  markAllRead: () => void
}

/**
 * Tracks which product updates the user has already seen.
 *
 * The ID of the newest seen update is persisted in localStorage under
 * `PRODUCT_UPDATES_STORAGE_KEY`. Updates are ordered newest-first in
 * `PRODUCT_UPDATES`, so the unread count equals the index of the last-seen
 * entry (or the full list length for first-time visitors).
 *
 * SSR-safe: delegates storage access to `useLocalStorage`.
 * Cleanup: none — no listeners are registered.
 */
export function useProductUpdates(): UseProductUpdatesResult {
  const [lastSeenId, setLastSeenId] = useLocalStorage<string | null>(
    PRODUCT_UPDATES_STORAGE_KEY,
    null
  )

  const lastSeenIndex =
    lastSeenId !== null ? PRODUCT_UPDATES.findIndex((u) => u.id === lastSeenId) : -1

  // If lastSeenId is null (new visitor) or stale (unknown ID), all updates are unread.
  // If lastSeenId matches PRODUCT_UPDATES[0], unreadCount is 0.
  const unreadCount = lastSeenIndex === -1 ? PRODUCT_UPDATES.length : lastSeenIndex

  const markAllRead = useCallback(() => {
    setLastSeenId(LATEST_UPDATE_ID)
  }, [setLastSeenId])

  return {
    updates: PRODUCT_UPDATES,
    unreadCount,
    markAllRead,
  }
}
