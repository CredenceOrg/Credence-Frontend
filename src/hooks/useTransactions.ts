import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import type { Transaction, ApiListResponse } from '../api/types'

export interface UseTransactionsResult {
  data: Transaction[]
  isLoading: boolean
  error: ApiError | null
  refetch: () => void
}

export function useTransactions(): UseTransactionsResult {
  const [data, setData] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)

  const fetchTransactions = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const fetchId = ++fetchIdRef.current

    setIsLoading(true)
    setError(null)

    try {
      const result = await apiFetch<ApiListResponse<Transaction>>('/transactions', {
        signal: controller.signal,
      })

      if (!mountedRef.current || fetchId !== fetchIdRef.current) return
      setData(result.items)
    } catch (err) {
      if (
        !mountedRef.current ||
        fetchId !== fetchIdRef.current ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return
      }

      setData([])
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(0, 'Unexpected error loading transactions'),
      )
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const refetch = useCallback(() => {
    void fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    mountedRef.current = true
    void fetchTransactions()
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [fetchTransactions])

  return { data, isLoading, error, refetch }
}
