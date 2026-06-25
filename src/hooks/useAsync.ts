import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseAsyncState<T> {
  data: T | undefined
  error: Error | null
  isLoading: boolean
}

export interface UseAsyncOptions {
  immediate?: boolean
}

/**
 * A reusable hook for async operations with cancel-on-unmount safety.
 * Prevents React "setState on unmounted component" warnings.
 */
export default function useAsync<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncOptions = {},
): UseAsyncState<T> & { run: () => Promise<void> } {
  const { immediate = true } = options

  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(immediate)

  const mountedRef = useRef(true)
  const runIdRef = useRef(0)
  const fnRef = useRef(asyncFn)

  // Keep the function ref fresh without causing re-renders
  useEffect(() => {
    fnRef.current = asyncFn
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = useCallback(async () => {
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
    if (immediate) {
      run()
    }
  }, [immediate, run])

  return { data, error, isLoading, run }
}
