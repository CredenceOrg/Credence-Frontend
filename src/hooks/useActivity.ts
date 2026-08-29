import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import type { ActivityItem } from '../components/ActivityTimeline'

/**
 * Concurrency contract for `useActivity` (and all race-safe data hooks):
 *
 * ## Serialization
 * Every in-flight request carries a monotonic `fetchId`. When a new fetch starts,
 * its id is incremented. On resolution (success or failure), the hook checks whether
 * the id still matches. If it does not, the result is silently discarded — this
 * guarantees **last-writer-wins** serialization without mutexes.
 *
 * ## Abort
 * A new fetch aborts the previous in-flight request via `AbortController`. Aborted
 * promises throw `AbortError`, which is filtered out so it never surfaces as user-
 * visible error state.
 *
 * ## Stale / Rejected / Failed state
 * - A stale (superseded) response is discarded; it cannot overwrite fresh state.
 * - A rejected response clears data to the empty default and surfaces the error.
 * - A failed (network) response clears data to the empty default and surfaces the error.
 * - No partial or unauthorized state can leak: `setData` and `setError` are only
 *   called when the fetch id is current and the component is mounted.
 *
 * ## Retry contract
 * Call `refetch()` to re-trigger the fetch for the same address. The previous
 * in-flight request (if any) is aborted. After an error, `refetch()` clears the
 * error before starting the new request.
 *
 * ## Unmount safety
 * `mountedRef` is set to `false` on unmount; all state updates check it first.
 */

export interface UseActivityResult {
  data: ActivityItem[]
  isLoading: boolean
  error: ApiError | null
  refetch: () => void
}

/**
 * Fetches activity timeline items for a given Stellar address.
 *
 * Does **not** fetch automatically on mount — call `refetch()` after the
 * user submits a lookup. An empty or invalid address is a no-op.
 *
 * Follows the serialization contract documented above.
 */
export function useActivity(address: string): UseActivityResult {
  const [data, setData] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)
  const addressRef = useRef(address)

  addressRef.current = address

  const fetchActivity = useCallback(async () => {
    const targetAddress = addressRef.current.trim()

    if (!targetAddress) {
      return
    }

    // Abort any in-flight request before starting a new one.
    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller
    const fetchId = ++fetchIdRef.current

    setIsLoading(true)
    setError(null)

    try {
      const result = await apiFetch<{ items: ActivityItem[] }>(
        `/activity/${encodeURIComponent(targetAddress)}`,
        { signal: controller.signal }
      )

      // Stale / superseded response — discard silently.
      if (!mountedRef.current || fetchId !== fetchIdRef.current) {
        return
      }

      setData(result.items)
      setError(null)
    } catch (err) {
      // AbortError means this request was intentionally cancelled — not a user error.
      if (
        !mountedRef.current ||
        fetchId !== fetchIdRef.current ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return
      }

      // Failed request clears data to default; no partial state leaks.
      setData([])
      setError(err instanceof ApiError ? err : new ApiError(0, 'Unexpected error loading activity'))
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const refetch = useCallback(() => {
    void fetchActivity()
  }, [fetchActivity])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  return { data, isLoading, error, refetch }
}
