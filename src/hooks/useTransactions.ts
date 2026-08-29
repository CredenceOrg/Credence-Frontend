import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import type { ApiResponse, operations, Transaction } from '../api/types'

const PENDING_TXS_KEY = 'credence:pendingTransactions'
/**
 * Fixed page size for every request. Falls inside the contractually valid
 * range (1–100) documented in `openapi.yaml` (`LimitParam`), so the client
 * never requests unbounded data. Changing this value changes the page the
 * server returns, so it must remain stable across cursor requests.
 */
const PAGE_SIZE = 20

type TransactionsResponse = ApiResponse<operations['listTransactions']>

/**
 * Server data for a single page plus the opaque cursor that a later request
 * must echo back verbatim to fetch the next page. `nextCursor` is `undefined`
 * when the page is the last one available (end-of-stream).
 */
interface FetchedPage {
  items: Transaction[]
  nextCursor?: string
}

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
  /**
   * Total number of pages *discovered so far*. Because the list API uses an
   * opaque cursor and exposes no separate count, the true total is unknowable
   * without walking every page. This value is therefore the highest page the
   * client has confirmed (it grows toward the true total and equals it once
   * the last page is reached). It is only meaningful for display.
   */
  totalPages: number
  /**
   * True when the most recently loaded page carried a `nextCursor`. This is
   * the authoritative end-of-stream signal: when false there is no page after
   * the current one.
   */
  hasNextPage: boolean
  /**
   * Opaque cursor for the most recently loaded page, echoed back verbatim to
   * fetch the following page. `undefined` at end-of-stream.
   */
  nextCursor?: string
  /** Navigate to a specific page. No-op if the page is already loaded or out of range. */
  goToPage: (page: number) => Promise<void>
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
  const [hasNextPage, setHasNextPage] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)

  const data = [...pendingData, ...serverData]

  const abortRef = useRef<AbortController | null>(null)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)

  // Cursor map: page number → cursor string (or undefined for the first
  // page). Updated after each successful fetch. This is the forward chain:
  // page N+1 can only be requested with the cursor returned by page N.
  const cursorMapRef = useRef<Map<number, string | undefined>>(new Map())

  // Cache of fetched pages: page number → Transaction[]. Enables backward
  // (Previous) navigation without re-requesting the network.
  const pageCacheRef = useRef<Map<number, Transaction[]>>(new Map())

  const fetchPage = useCallback(
    async (pageNum: number, signal?: AbortSignal): Promise<FetchedPage | null> => {
      // The first page has no preceding cursor; every later page requires the
      // cursor returned by its predecessor in the chain.
      const cursor = pageNum === 1 ? undefined : cursorMapRef.current.get(pageNum - 1)
      if (pageNum > 1 && cursor === undefined) {
        return null
      }

      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      if (cursor) {
        params.set('cursor', cursor)
      }

      const result = await apiFetch<TransactionsResponse>(`/transactions?${params.toString()}`, {
        signal,
      })

      // Advance the forward chain and cache the raw page. This is idempotent:
      // concurrent callers for the same page write the same values, so a stale
      // write cannot corrupt pagination state.
      cursorMapRef.current.set(pageNum, result.nextCursor)
      pageCacheRef.current.set(pageNum, result.items)

      return { items: result.items, nextCursor: result.nextCursor }
    },
    []
  )

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
        setTotalPages(result.nextCursor === undefined ? 1 : 2)
        setNextCursor(result.nextCursor)
        setHasNextPage(result.nextCursor !== undefined)
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

      // If we already have this page cached, use it immediately and update the
      // end-of-stream signal to match the cached page.
      const cached = pageCacheRef.current.get(pageNum)
      if (cached) {
        setServerData(cached)
        setPage(pageNum)
        const cachedCursor = cursorMapRef.current.get(pageNum)
        setNextCursor(cachedCursor)
        setHasNextPage(cachedCursor !== undefined)
        return
      }

      // Need to fetch this page. Supersede any in-flight request so that only
      // the most recent navigation governs the displayed list.
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
          setNextCursor(result.nextCursor)
          setHasNextPage(result.nextCursor !== undefined)

          // Update totalPages: if we got a nextCursor, there's at least
          // one more page beyond this one.
          setTotalPages((prev) =>
            Math.max(prev, result.nextCursor === undefined ? pageNum : pageNum + 1)
          )
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
        setError(err instanceof ApiError ? err : new ApiError(0, 'Unexpected error loading page'))
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
      // Skip if already cached or already being fetched via navigation.
      if (pageCacheRef.current.has(pageNum)) return
      if (pageNum > 1 && cursorMapRef.current.get(pageNum - 1) === undefined) return

      // Register so a refetch or navigation supersedes the prefetch instead of
      // letting a stale result land after the caches were cleared.
      const controller = new AbortController()
      abortRef.current?.abort()
      abortRef.current = controller
      const fetchId = ++fetchIdRef.current

      try {
        const result = await fetchPage(pageNum, controller.signal)
        // Only commit discovery metadata if this prefetch is still the latest
        // operation and the mount is alive.
        if (!mountedRef.current || fetchId !== fetchIdRef.current) return
        if (result) {
          setTotalPages((prev) =>
            Math.max(prev, result.nextCursor === undefined ? pageNum : pageNum + 1)
          )
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
    setNextCursor(undefined)
    setHasNextPage(true)
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
    hasNextPage,
    nextCursor,
    goToPage,
    prefetchPage,
  }
}
