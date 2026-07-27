import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { PRODUCT_UPDATES, type ProductUpdate } from '../data/productUpdates'
import { CHANGELOG_FEED_URL, CHANGELOG_STORAGE_KEY } from '../config/changelog'

export { CHANGELOG_STORAGE_KEY as PRODUCT_UPDATES_STORAGE_KEY, CHANGELOG_FEED_URL }

export interface UseProductUpdatesResult {
  updates: readonly ProductUpdate[]
  /** Number of updates the user has not yet seen. */
  unreadCount: number
  /** Whether the JSON feed is currently loading. */
  isLoading: boolean
  /** Error message if fetching the JSON feed failed, or null. */
  error: string | null
  /** Marks all current updates as seen and persists the state to localStorage. */
  markAllRead: () => void
  /** Refetches the JSON feed from CHANGELOG_FEED_URL. */
  refetch: () => Promise<void>
}

/**
 * Tracks which product updates the user has already seen, sourcing updates from
 * a JSON feed (`CHANGELOG_FEED_URL`) with fallback to static `PRODUCT_UPDATES`.
 *
 * The ID of the newest seen update is persisted in localStorage under
 * `CHANGELOG_STORAGE_KEY`. Updates are ordered newest-first, so the unread
 * count equals the index of the last-seen entry (or full list length for new visitors).
 */
export function useProductUpdates(): UseProductUpdatesResult {
  const [lastSeenId, setLastSeenId] = useLocalStorage<string | null>(
    CHANGELOG_STORAGE_KEY,
    null
  )
  const [updates, setUpdates] = useState<readonly ProductUpdate[]>(PRODUCT_UPDATES)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUpdates = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(CHANGELOG_FEED_URL)
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
      }
      const data = await response.json()
      const list: ProductUpdate[] = Array.isArray(data) ? data : data.updates ?? []
      if (Array.isArray(list) && list.length > 0) {
        setUpdates(list)
      } else {
        setUpdates(PRODUCT_UPDATES)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch changelog feed'
      setError(message)
      setUpdates(PRODUCT_UPDATES)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUpdates()
  }, [fetchUpdates])

  const lastSeenIndex =
    lastSeenId !== null ? updates.findIndex((u) => u.id === lastSeenId) : -1

  const unreadCount = lastSeenIndex === -1 ? updates.length : lastSeenIndex

  const markAllRead = useCallback(() => {
    if (updates.length > 0) {
      setLastSeenId(updates[0].id)
    }
  }, [updates, setLastSeenId])

  return {
    updates,
    unreadCount,
    isLoading,
    error,
    markAllRead,
    refetch: fetchUpdates,
  }
}
