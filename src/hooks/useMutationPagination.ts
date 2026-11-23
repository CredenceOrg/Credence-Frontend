/**
 * @file useMutationPagination.ts
 * @description React hook for deterministic, scope-safe pagination of bond and trust-score mutations.
 *
 * Implements cursor pagination guarantees:
 * - Deterministic ordering by (updatedAt DESC/ASC, operationId tiebreaker)
 * - Scope-safe cursor encoding and verification
 * - Bounded page limits and memory cache (MAX_CACHED_PAGES)
 * - Hard ceiling on page navigation (MAX_PAGES) to prevent loops
 * - Resilience against concurrent insertions between page queries
 * - Safe error handling on corrupted/invalid cursors
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  paginateMutationOperations,
  type MutationOperation,
  type MutationType,
  type MutationStatus,
  type PaginateMutationOptions,
  DEFAULT_MUTATION_PAGE_LIMIT,
} from '../lib/mutationStorage'
import { logWarn } from '../lib/log'

export const MAX_MUTATION_PAGES = 1000
export const MAX_CACHED_MUTATION_PAGES = 50

export interface UseMutationPaginationOptions {
  type?: MutationType
  status?: MutationStatus
  scope?: string
  pageSize?: number
  order?: 'desc' | 'asc'
  autoRefreshInterval?: number
}

interface CachedPage {
  items: MutationOperation[]
  nextCursor?: string
  hasNextPage: boolean
  totalCount: number
}

export interface UseMutationPaginationResult {
  items: MutationOperation[]
  isLoading: boolean
  error: Error | null
  page: number
  totalPages: number
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  nextCursor?: string
  goToPage: (targetPage: number) => Promise<void>
  nextPage: () => Promise<void>
  previousPage: () => Promise<void>
  refetch: () => void
  setPageSize: (size: number) => void
  setType: (type?: MutationType) => void
  setStatus: (status?: MutationStatus) => void
  setScope: (scope?: string) => void
}

export function useMutationPagination(
  options: UseMutationPaginationOptions = {}
): UseMutationPaginationResult {
  const [currentType, setType] = useState<MutationType | undefined>(options.type)
  const [currentStatus, setStatus] = useState<MutationStatus | undefined>(options.status)
  const [currentScope, setScope] = useState<string | undefined>(options.scope)
  const [pageSize, setPageSize] = useState<number>(options.pageSize ?? DEFAULT_MUTATION_PAGE_LIMIT)
  const [order] = useState<'desc' | 'asc'>(options.order ?? 'desc')

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [items, setItems] = useState<MutationOperation[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const [hasNextPage, setHasNextPage] = useState<boolean>(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [discoveredPages, setDiscoveredPages] = useState<number>(1)

  // Cache: page number -> CachedPage
  const pageCacheRef = useRef<Map<number, CachedPage>>(new Map())
  // Cursor map: page number -> cursor to fetch that page (page 1 is undefined)
  const cursorMapRef = useRef<Map<number, string | undefined>>(new Map([[1, undefined]]))
  const isFetchingRef = useRef<boolean>(false)

  // Reset pagination state whenever scope/filters change
  const resetPagination = useCallback(() => {
    pageCacheRef.current.clear()
    cursorMapRef.current.clear()
    cursorMapRef.current.set(1, undefined)
    setCurrentPage(1)
    setDiscoveredPages(1)
    setError(null)
  }, [])

  // Sync with prop changes if passed
  useEffect(() => {
    if (options.type !== currentType) {
      setType(options.type)
      resetPagination()
    }
  }, [options.type, currentType, resetPagination])

  useEffect(() => {
    if (options.status !== currentStatus) {
      setStatus(options.status)
      resetPagination()
    }
  }, [options.status, currentStatus, resetPagination])

  useEffect(() => {
    if (options.scope !== currentScope) {
      setScope(options.scope)
      resetPagination()
    }
  }, [options.scope, currentScope, resetPagination])

  const fetchPage = useCallback(
    async (targetPage: number): Promise<void> => {
      if (targetPage < 1 || targetPage > MAX_MUTATION_PAGES) {
        return
      }

      // Check cache first
      const cached = pageCacheRef.current.get(targetPage)
      if (cached) {
        setItems(cached.items)
        setHasNextPage(cached.hasNextPage)
        setNextCursor(cached.nextCursor)
        setTotalCount(cached.totalCount)
        setCurrentPage(targetPage)
        setIsLoading(false)
        setError(null)
        return
      }

      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setIsLoading(true)

      try {
        const cursor = cursorMapRef.current.get(targetPage)

        const paginationOpts: PaginateMutationOptions = {
          type: currentType,
          status: currentStatus,
          scope: currentScope,
          limit: pageSize,
          cursor,
          order,
        }

        const result = paginateMutationOperations(paginationOpts)

        const pageData: CachedPage = {
          items: result.items,
          nextCursor: result.nextCursor,
          hasNextPage: result.hasNextPage,
          totalCount: result.totalCount,
        }

        // Bound cache size
        if (pageCacheRef.current.size >= MAX_CACHED_MUTATION_PAGES) {
          const firstKey = pageCacheRef.current.keys().next().value
          if (firstKey !== undefined) {
            pageCacheRef.current.delete(firstKey)
          }
        }

        pageCacheRef.current.set(targetPage, pageData)

        // If next page exists and cursor is available, record cursor for next page
        if (result.hasNextPage && result.nextCursor) {
          cursorMapRef.current.set(targetPage + 1, result.nextCursor)
          setDiscoveredPages((prev) => Math.max(prev, targetPage + 1))
        }

        setItems(result.items)
        setHasNextPage(result.hasNextPage)
        setNextCursor(result.nextCursor)
        setTotalCount(result.totalCount)
        setCurrentPage(targetPage)
        setError(null)
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err))
        setError(errorObj)
        logWarn('mutation_pagination_fetch_error', {
          targetPage,
          error: errorObj.message,
        })
      } finally {
        setIsLoading(false)
        isFetchingRef.current = false
      }
    },
    [currentType, currentStatus, currentScope, pageSize, order]
  )

  const goToPage = useCallback(
    async (targetPage: number): Promise<void> => {
      if (targetPage < 1 || targetPage > MAX_MUTATION_PAGES) return
      await fetchPage(targetPage)
    },
    [fetchPage]
  )

  const nextPage = useCallback(async (): Promise<void> => {
    if (hasNextPage && currentPage < MAX_MUTATION_PAGES) {
      await fetchPage(currentPage + 1)
    }
  }, [hasNextPage, currentPage, fetchPage])

  const previousPage = useCallback(async (): Promise<void> => {
    if (currentPage > 1) {
      await fetchPage(currentPage - 1)
    }
  }, [currentPage, fetchPage])

  const refetch = useCallback(() => {
    resetPagination()
    void fetchPage(1)
  }, [resetPagination, fetchPage])

  // Initial load or filter change load
  useEffect(() => {
    void fetchPage(currentPage)
  }, [fetchPage, currentPage])

  // Optional auto-refresh
  useEffect(() => {
    if (!options.autoRefreshInterval || options.autoRefreshInterval <= 0) return

    const interval = setInterval(() => {
      // Invalidate current page cache and refetch
      pageCacheRef.current.delete(currentPage)
      void fetchPage(currentPage)
    }, options.autoRefreshInterval)

    return () => clearInterval(interval)
  }, [options.autoRefreshInterval, currentPage, fetchPage])

  return {
    items,
    isLoading,
    error,
    page: currentPage,
    totalPages: discoveredPages,
    totalCount,
    hasNextPage,
    hasPreviousPage: currentPage > 1,
    nextCursor,
    goToPage,
    nextPage,
    previousPage,
    refetch,
    setPageSize: (size: number) => {
      setPageSize(size)
      resetPagination()
    },
    setType: (t?: MutationType) => {
      setType(t)
      resetPagination()
    },
    setStatus: (s?: MutationStatus) => {
      setStatus(s)
      resetPagination()
    },
    setScope: (sc?: string) => {
      setScope(sc)
      resetPagination()
    },
  }
}
