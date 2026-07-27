import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseQueryOptions {
  enabled?: boolean
}

export interface UseQueryResult<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * A custom hook that wraps an asynchronous query function.
 * Automatically handles loading, error, and data states.
 * Safely prevents state updates on unmounted components.
 * Query execution (both initial and refetch) is disabled when offline.
 */
export function useQuery<T>(
  queryFn: () => Promise<T>,
  options: UseQueryOptions = {},
): UseQueryResult<T> {
  const { enabled = true } = options

  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(enabled)

  const mountedRef = useRef(true)
  const runIdRef = useRef(0)
  const fnRef = useRef(queryFn)

  // Keep the function ref fresh without causing re-renders
  useEffect(() => {
    fnRef.current = queryFn
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refetch = useCallback(async () => {
    // Disable when offline
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      return
    }

    const currentRunId = ++runIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const result = await fnRef.current()
      if (mountedRef.current && currentRunId === runIdRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current && currentRunId === runIdRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    } finally {
      if (mountedRef.current && currentRunId === runIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      // Check offline status before initial fetch
      if (typeof window !== 'undefined' && !window.navigator.onLine) {
        setIsLoading(false)
        return
      }
      void refetch()
    } else {
      setIsLoading(false)
    }
  }, [enabled, refetch])

  return { data, error, isLoading, refetch }
}
