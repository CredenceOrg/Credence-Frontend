import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import type { ApiResponse, Bond, operations } from '../api/types'

type BondResponse = ApiResponse<operations['getBond']>

export interface UseBondResult {
  /** Bond payload from `GET /bonds/:id`, or null before/after a failed fetch. */
  data: Bond | null
  /** True while a bond lookup request is in flight. */
  isLoading: boolean
  /** Last fetch failure, excluding intentional AbortError cancellations. */
  error: ApiError | null
  /** Re-runs the lookup for the current bond ID. */
  refetch: () => void
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

/**
 * Loads a single bond by ID via `GET /bonds/:id`.
 *
 * Automatically fetches when `id` is provided and aborts any in-flight request
 * when `id` changes, `refetch` is called, or the component unmounts.
 */
export function useBond(id: string | undefined): UseBondResult {
  const trimmedId = id?.trim() ?? ''
  const [data, setData] = useState<Bond | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(trimmedId))
  const [error, setError] = useState<ApiError | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)

  const fetchBond = useCallback(async (targetId: string) => {
    abortRef.current?.abort()

    if (!targetId) {
      setData(null)
      setError(null)
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    const fetchId = ++fetchIdRef.current

    setIsLoading(true)
    setError(null)
    setData((current) => (current?.id !== targetId ? null : current))

    try {
      const result = await apiFetch<BondResponse>(
        `/bonds/${encodeURIComponent(targetId)}`,
        { signal: controller.signal }
      )

      if (!mountedRef.current || fetchId !== fetchIdRef.current) {
        return
      }

      setData(result)
    } catch (err) {
      if (!mountedRef.current || fetchId !== fetchIdRef.current || isAbortError(err)) {
        return
      }

      setData(null)
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(
              0,
              err instanceof Error ? err.message : 'Unexpected error while fetching bond'
            )
      )
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void fetchBond(trimmedId)

    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [trimmedId, fetchBond])

  const refetch = useCallback(() => {
    void fetchBond(trimmedId)
  }, [trimmedId, fetchBond])

  return {
    data,
    isLoading,
    error,
    refetch,
  }
}
