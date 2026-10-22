import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError, ApiSessionConflictError, getIdentityEpoch } from '../api/client'
import type { ApiResponse, operations, Transaction } from '../api/types'
import { useWallet } from '../context/WalletContext'
import { useSettings } from '../context/SettingsContext'
import {
  addPendingTransaction as addPendingToStorage,
  removePendingTransaction as removePendingFromStorage,
  readPendingTransactions,
  writePendingTransactions,
  migrateToV2,
  type TransactionWithNetwork,
} from '../lib/pendingTransactionsStorage'
/**
 * Fixed page size for every request. Falls inside the contractually valid
 * range (1–100) documented in `openapi.yaml` (`LimitParam`), so the client
 * never requests unbounded data. Changing this value changes the page the
 * server returns, so it must remain stable across cursor requests.
 */
const PAGE_SIZE = 20
/**
 * Hard ceiling on the number of distinct pages the hook will ever fetch.
 *
 * Guarantees termination under an adversarial or buggy server that never
 * stops returning a `nextCursor` (a cursor loop): once `MAX_PAGES` distinct
 * pages have been fetched the hook reports end-of-stream and refuses to fetch
 * further. This keeps ordering/end-of-stream deterministic and prevents
 * unbounded network work on a single list.
 */
const MAX_PAGES = 1000
/**
 * Bound on the number of pages retained in the VDOM cache and cursor map.
 *
 * For large result sets the client never caches every page in memory; the
 * two most recent pages stay cached for smooth backward navigation while
 * older ones are evicted. Pages are always lazily refetchable from the
 * server, so eviction does not change the data — it only bounds memory.
 */
const MAX_CACHED_PAGES = 50

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
  const { address: walletAddress, network: walletNetwork } = useWallet()
  const { network: settingsNetwork } = useSettings()

  const [serverData, setServerData] = useState<Transaction[]>([])
  const [pendingData, setPendingData] = useState<TransactionWithNetwork[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)

  // Use wallet network if available, otherwise fall back to settings network
  const network = (walletNetwork || settingsNetwork) as 'public' | 'test'

  const data = [...pendingData, ...serverData]

  // Navigation-only abort controller / fetch id. Prefetches deliberately do
  // not touch these: they are background work and must never invalidate a
  // user-visible navigation (or leave it stuck in `isLoading`).
  const abortRef = useRef<AbortController | null>(null)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)
  const migrationRanRef = useRef(false)

  // Cursor map: page number → cursor string (or undefined for the first
  // page). Updated after each successful fetch. This is the forward chain:
  // page N+1 can only be requested with the cursor returned by page N.
  const cursorMapRef = useRef<Map<number, string | undefined>>(new Map())

  // Cache of fetched pages: page number → Transaction[]. Enables backward
  // (Previous) navigation without re-requesting the network.
  const pageCacheRef = useRef<Map<number, Transaction[]>>(new Map())

  // Deduplicated in-flight page requests, keyed by page number. Both prefetch
  // and navigation register here before awaiting the network, so a second
  // trigger for the same page joins the existing request instead of aborting
  // it and spending another rate-limit token.
  const inFlightRef = useRef<Map<number, InFlightPage>>(new Map())

  // Incremented whenever the caches are invalidated (refetch / unmount). A
  // prefetch that started before the invalidation must not commit its
  // discovery metadata afterwards, even if it settles in the same tick.
  const cacheEpochRef = useRef(0)

  const fetchPage = useCallback(
    async (pageNum: number, signal?: AbortSignal): Promise<FetchedPage | null> => {
      // Deterministic termination: never fetch beyond the hard page ceiling.
      if (pageNum > MAX_PAGES) {
        return null
      }

      // The first page has no preceding cursor; every later page requires the
      // cursor returned by its predecessor in the chain. A missing cursor for
      // a later page means the chain is invalid (e.g. end-of-stream already
      // reached or a corrupted refetch), so refuse to issue the request.
      const cursor = pageNum === 1 ? undefined : cursorMapRef.current.get(pageNum - 1)
      if (pageNum > 1 && cursor === undefined) {
        return null
      }

      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      if (cursor) {
        params.set('cursor', cursor)
      }

      const epoch = getIdentityEpoch()

      const result = await apiFetch<TransactionsResponse>(`/transactions?${params.toString()}`, {
        signal,
        identityEpoch: epoch,
      })

      // A response that lands after abort (refetch / unmount / superseded
      // navigation) must not be written into a cache that may already have
      // been cleared, or it would resurrect a stale chain.
      if (signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }

      // Advance the forward chain and cache the raw page. This is idempotent:
      // concurrent callers for the same page write the same values, so a stale
      // write cannot corrupt pagination state.
      cursorMapRef.current.set(pageNum, result.nextCursor)
      pageCacheRef.current.set(pageNum, result.items)

      // Bound cache growth: evict the oldest pages once the working set grows
      // beyond MAX_CACHED_PAGES. Refetching the server is idempotent, so the
      // only cost of eviction is a later network round-trip.
      while (pageCacheRef.current.size > MAX_CACHED_PAGES) {
        const oldest = pageCacheRef.current.keys().next().value
        if (oldest === undefined) break
        pageCacheRef.current.delete(oldest)
        cursorMapRef.current.delete(oldest)
      }

      return { items: result.items, nextCursor: result.nextCursor }
    },
    []
  )

  /**
   * Starts (or joins) the single in-flight request for `pageNum`.
   *
   * The promise is registered in the map before it is returned, so a caller
   * that triggers the same page a moment later observes the existing entry
   * rather than aborting it. When a navigation starts the request it passes
   * its own `AbortController`, so `abortRef` can still cancel the actual
   * network call on a later navigation. The entry removes itself on settle;
   * `refetch()` and unmount abort and clear the whole map instead.
   */
  const startPageRequest = useCallback(
    (pageNum: number, controller: AbortController = new AbortController()): InFlightPage => {
      const existing = inFlightRef.current.get(pageNum)
      if (existing) return existing

      const entry: InFlightPage = {
        controller,
        promise: fetchPage(pageNum, controller.signal),
      }
      inFlightRef.current.set(pageNum, entry)

      // `finally` re-throws a rejection, so the derived promise is caught here
      // to keep an unawaited (fire-and-forget prefetch) failure from becoming
      // an unhandled rejection. Real callers still observe `entry.promise`.
      void entry.promise
        .finally(() => {
          if (inFlightRef.current.get(pageNum) === entry) {
            inFlightRef.current.delete(pageNum)
          }
        })
        .catch(() => undefined)

      return entry
    },
    [fetchPage]
  )

  /** Aborts every outstanding page request and forgets the map entries. */
  const abortInFlightPages = useCallback(() => {
    inFlightRef.current.forEach(({ controller }) => controller.abort())
    inFlightRef.current.clear()
  }, [])

  const fetchTransactions = useCallback(async () => {
    // Disconnected state: no fetch, return empty list
    if (!walletAddress) {
      setServerData([])
      setPendingData([])
      setIsLoading(false)
      setError(null)
      setPage(1)
      setTotalPages(0)
      setNextCursor(undefined)
      setHasNextPage(false)
      return
    }

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
        const pending = readPendingTransactions(network, walletAddress)
        const serverHashes = new Set(result.items.map((tx) => tx.hash))
        const remainingPending = pending.filter((tx) => !serverHashes.has(tx.hash))
        writePendingTransactions(network, walletAddress, remainingPending)

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

      // Silently discard session conflict errors (identity changed during request)
      if (err instanceof ApiSessionConflictError) {
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
  }, [fetchPage, walletAddress, network])

  const goToPage = useCallback(
    async (pageNum: number) => {
      if (pageNum < 1 || pageNum > MAX_PAGES || pageNum === page) return

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

      // Need to fetch this page. A navigation supersedes other *navigations*
      // via `abortRef` / `fetchIdRef`, but it never aborts a page request that
      // is already in flight — it adopts it so the work (and its rate-limit
      // token) is not thrown away.
      setIsLoading(true)
      setError(null)

      // Adopt the existing controller when this page is already loading;
      // otherwise create the one that owns the new request. Pointing
      // `abortRef` at the real controller keeps a later navigation able to
      // cancel the actual network call.
      const inFlight = inFlightRef.current.get(pageNum)
      const controller = inFlight?.controller ?? new AbortController()
      if (abortRef.current && abortRef.current !== controller) {
        abortRef.current.abort()
      }
      abortRef.current = controller
      const fetchId = ++fetchIdRef.current

      // `startPageRequest` returns the prefetch's entry when one exists, so
      // this await joins it rather than issuing a second request.
      const { promise } = startPageRequest(pageNum, controller)

      try {
        const result = await promise
        if (!mountedRef.current || fetchId !== fetchIdRef.current) return

        if (result) {
          const pending = readPendingTransactions(network, walletAddress)
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

        // Silently discard session conflict errors
        if (err instanceof ApiSessionConflictError) {
          return
        }

        setError(err instanceof ApiError ? err : new ApiError(0, 'Unexpected error loading page'))
      } finally {
        if (mountedRef.current && fetchId === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [fetchPage, page, network, walletAddress]
  )

  const prefetchPage = useCallback(
    async (pageNum: number) => {
      if (pageNum < 1 || pageNum > MAX_PAGES) return
      // Skip if already cached or already being fetched (by a prefetch or a
      // navigation). Joining is the caller's job in `goToPage`; a duplicate
      // prefetch is a no-op.
      if (pageCacheRef.current.has(pageNum)) return
      if (pageNum > 1 && cursorMapRef.current.get(pageNum - 1) === undefined) return
      if (inFlightRef.current.has(pageNum)) return

      const epoch = cacheEpochRef.current
      const { promise } = startPageRequest(pageNum)

      try {
        const result = await promise
        // A refetch/unmount invalidated the caches while this was in flight:
        // do not publish discovery metadata for a page that is no longer part
        // of the current chain.
        if (!mountedRef.current || epoch !== cacheEpochRef.current) return
        if (result) {
          setTotalPages((prev) =>
            Math.max(prev, result.nextCursor === undefined ? pageNum : pageNum + 1)
          )
        }
      } catch {
        // Prefetch failures are silent — the user can still click to fetch normally
      }
    },
    [startPageRequest]
  )

  const refetch = useCallback(() => {
    abortInFlightPages()
    cacheEpochRef.current += 1
    pageCacheRef.current.clear()
    cursorMapRef.current.clear()
    setPage(1)
    setTotalPages(0)
    setNextCursor(undefined)
    setHasNextPage(true)
    void fetchTransactions()
  }, [abortInFlightPages, fetchTransactions])

  const addPending = useCallback((tx: Transaction) => {
    if (!walletAddress) return
    addPendingToStorage(network, walletAddress, tx)
    setPendingData((prev) => [{ ...tx, _network: network }, ...prev])
  }, [network, walletAddress])

  const removePendingByHash = useCallback((hash: string) => {
    if (!walletAddress) return
    removePendingFromStorage(network, walletAddress, hash)
    setPendingData((prev) => prev.filter((tx) => tx.hash !== hash))
  }, [network, walletAddress])

  useEffect(() => {
    mountedRef.current = true

    // One-time migration from v1/v0 to v2 on first mount
    if (!migrationRanRef.current) {
      migrateToV2(network, walletAddress)
      migrationRanRef.current = true
    }

    // Load pending transactions from storage for current identity
    if (walletAddress) {
      setPendingData(readPendingTransactions(network, walletAddress))
    } else {
      setPendingData([])
    }

    void fetchTransactions()

    return () => {
      mountedRef.current = false
      cacheEpochRef.current += 1
      abortRef.current?.abort()
      abortInFlightPages()
    }
  }, [fetchTransactions, network, walletAddress])

  // Clear caches and reset when address or network changes
  useEffect(() => {
    pageCacheRef.current.clear()
    cursorMapRef.current.clear()
    setPage(1)
    setTotalPages(0)
    setNextCursor(undefined)
    setHasNextPage(true)
  }, [network, walletAddress])

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
