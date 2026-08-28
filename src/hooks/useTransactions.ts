import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import type { ApiResponse, operations, Transaction } from '../api/types'

const PENDING_TXS_KEY = 'credence:pendingTransactions'
const PAGE_SIZE = 20

type TransactionsResponse = ApiResponse<operations['listTransactions']>

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
  removePendingTransaction: (hash: string) => void
  /** Current page number (1-indexed). */
  page: number
  /** Total number of pages available (0 when no data). */
  totalPages: number
  /** Navigate to a specific page. No-op if the page is already loaded or out of range. */
  goToPage: (page: number) => void
  /** Prefetch a page in the background (fires-and-forgets). */
  prefetchPage: (page: number) => Promise<void>
}

export function useTransactions(): UseTransactionsResult {
  const [serverData, setServerData] = useState<Transaction[]>([])
  const [pendingData, setPendingData] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)

  const data = [...pendingData, ...serverData]

  const abortRef = useRef<AbortController | null>(null)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)

  // Cursor map: page number → cursor string (or null/undefined for the
  // first page). Updated after each successful fetch.
  const cursorMapRef = useRef<Map<number, string | undefined>>(new Map())

  // Cache of fetched pages: page number → Transaction[]
  const pageCacheRef = useRef<Map<number, Transaction[]>>(new Map())

  const fetchPage = useCallback(async (pageNum: number, signal?: AbortSignal) => {
    const cursor = pageNum === 1 ? undefined : cursorMapRef.current.get(pageNum - 1)
    // If we don't have a cursor for the previous page and this isn't page 1,
    // we can't fetch this page yet.
    if (pageNum > 1 && cursor === undefined) {
      return null
    }

    const params = new URLSearchParams()
    params.set('limit', String(PAGE_SIZE))
    if (cursor) {
      params.set('cursor', cursor)
    }

    const result = await apiFetch<TransactionsResponse>(
      `/transactions?${params.toString()}`,
      { signal }
    )

    // Store cursor for this page so the next page can use it
    cursorMapRef.current.set(pageNum, result.nextCursor)
    // Cache the page data
    pageCacheRef.current.set(pageNum, result.items)

    return result
  }, [])

  const fetchTransactions = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const fetchId = ++fetchIdRef.current

    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchPage(1, controller.signal)

      if (!mountedRef.current || fetchId !== fetchIdRef.current) return

      if (result) {
        // Reconcile pending transactions with server data
        const pending = getPendingTransactions()
        const serverHashes = new Set(result.items.map((tx) => tx.hash))
        const remainingPending = pending.filter((tx) => !serverHashes.has(tx.hash))
        setPendingTransactions(remainingPending)

        setServerData(result.items)
        setPendingData(remainingPending)
        setTotalPages(result.nextCursor ? 2 : 1) // At least 1 more page if nextCursor exists
      }
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
  }, [fetchPage])

  const goToPage = useCallback(
    async (pageNum: number) => {
      if (pageNum < 1 || pageNum === page) return

      // If we already have this page cached, use it immediately
      const cached = pageCacheRef.current.get(pageNum)
      if (cached) {
        setServerData(cached)
        setPage(pageNum)
        return
      }

      // Need to fetch this page
      setIsLoading(true)
      setError(null)

      const controller = new AbortController()
      abortRef.current?.abort()
      abortRef.current = controller
      const fetchId = ++fetchIdRef.current

      try {
        const result = await fetchPage(pageNum, controller.signal)
        if (!mountedRef.current || fetchId !== fetchIdRef.current) return

        if (result) {
          const pending = getPendingTransactions()
          setServerData(result.items)
          setPendingData(pending)
          setPage(pageNum)

          // Update totalPages: if we got a nextCursor, there's at least
          // one more page beyond this one.
          setTotalPages((prev) => Math.max(prev, result.nextCursor ? pageNum + 1 : pageNum))
        }
      } catch (err) {
        if (
          !mountedRef.current ||
          fetchId !== fetchIdRef.current ||
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError')
        ) {
          return
        }
        setError(
          err instanceof ApiError ? err : new ApiError(0, 'Unexpected error loading page')
        )
      } finally {
        if (mountedRef.current && fetchId === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [fetchPage, page]
  )

  const prefetchPage = useCallback(
    async (pageNum: number) => {
      if (pageNum < 1) return
      // Skip if already cached or already being fetched
      if (pageCacheRef.current.has(pageNum)) return
      if (pageNum > 1 && cursorMapRef.current.get(pageNum - 1) === undefined) return

      try {
        const result = await fetchPage(pageNum)
        if (result) {
          setTotalPages((prev) => Math.max(prev, result.nextCursor ? pageNum + 1 : pageNum))
        }
      } catch {
        // Prefetch failures are silent — the user can still click to fetch normally
      }
    },
    [fetchPage]
  )

  const refetch = useCallback(() => {
    pageCacheRef.current.clear()
    cursorMapRef.current.clear()
    setPage(1)
    setTotalPages(0)
    void fetchTransactions()
  }, [fetchTransactions])

  const addPending = useCallback((tx: Transaction) => {
    addPendingTransaction(tx)
    setPendingData((prev) => [tx, ...prev])
  }, [])

  const removePendingByHash = useCallback((hash: string) => {
    removePendingTransaction(hash)
    setPendingData((prev) => prev.filter((tx) => tx.hash !== hash))
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

  return {
    data,
    isLoading,
    error,
    refetch,
    addPendingTransaction: addPending,
    removePendingTransaction: removePendingByHash,
    page,
    totalPages,
    goToPage,
    prefetchPage,
  }
}
