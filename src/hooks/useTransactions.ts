import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import type { Transaction, ApiListResponse } from '../api/types'

const PENDING_TXS_KEY = 'credence:pendingTransactions'

function getPendingTransactions(): Transaction[] {
  try {
    const stored = localStorage.getItem(PENDING_TXS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setPendingTransactions(txs: Transaction[]): void {
  localStorage.setItem(PENDING_TXS_KEY, JSON.stringify(txs))
}

function addPendingTransaction(tx: Transaction): void {
  const pending = getPendingTransactions()
  setPendingTransactions([tx, ...pending])
}

function removePendingTransaction(hash: string): void {
  const pending = getPendingTransactions()
  setPendingTransactions(pending.filter((tx) => tx.hash !== hash))
}

export interface UseTransactionsResult {
  data: Transaction[]
  isLoading: boolean
  error: ApiError | null
  refetch: () => void
  addPendingTransaction: (tx: Transaction) => void
}

export function useTransactions(): UseTransactionsResult {
  const [serverData, setServerData] = useState<Transaction[]>([])
  const [pendingData, setPendingData] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)

  const data = [...pendingData, ...serverData]

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

      // Reconcile pending transactions with server data
      const pending = getPendingTransactions()
      const serverHashes = new Set(result.items.map((tx) => tx.hash))
      const remainingPending = pending.filter((tx) => !serverHashes.has(tx.hash))
      setPendingTransactions(remainingPending)

      setServerData(result.items)
      setPendingData(remainingPending)
    } catch (err) {
      if (
        !mountedRef.current ||
        fetchId !== fetchIdRef.current ||
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return
      }

      setServerData([])
      setError(
        err instanceof ApiError ? err : new ApiError(0, 'Unexpected error loading transactions')
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

  const addPending = useCallback((tx: Transaction) => {
    addPendingTransaction(tx)
    setPendingData((prev) => [tx, ...prev])
  }, [])

  useEffect(() => {
    mountedRef.current = true
    // Load pending transactions from storage on mount
    setPendingData(getPendingTransactions())
    void fetchTransactions()
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [fetchTransactions])

  return { data, isLoading, error, refetch, addPendingTransaction: addPending }
}
