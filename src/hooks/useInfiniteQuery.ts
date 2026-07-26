import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type InfiniteQueryOptions<TItem, TCursor> = {
  queryKey: string
  fetchPage: (cursor: TCursor | null) => Promise<{
    items: TItem[]
    nextCursor: TCursor | null
  }>
}

type InfiniteQueryState<TItem, TCursor> = {
  data: TItem[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error: Error | null
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<void>
}

export function useInfiniteQuery<TItem, TCursor>({
  queryKey,
  fetchPage,
}: InfiniteQueryOptions<TItem, TCursor>): InfiniteQueryState<TItem, TCursor> {
  const [items, setItems] = useState<TItem[]>([])
  const [cursor, setCursor] = useState<TCursor | null>(null)
  const [status, setStatus] = useState<InfiniteQueryState<TItem, TCursor>['status']>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)
  const requestedCursorsRef = useRef<Set<string>>(new Set())

  const loadPage = useCallback(
    async (nextCursor: TCursor | null) => {
      const key = `${queryKey}:${String(nextCursor)}`
      if (requestedCursorsRef.current.has(key)) {
        return
      }

      requestedCursorsRef.current.add(key)
      setStatus('loading')
      setError(null)
      setIsFetchingNextPage(true)

      try {
        const page = await fetchPage(nextCursor)
        setItems((current) => {
          if (nextCursor === null) {
            return page.items
          }

          return [...current, ...page.items]
        })
        setHasNextPage(page.nextCursor !== null)
        setCursor(page.nextCursor)
        setStatus('success')
      } catch (err) {
        requestedCursorsRef.current.delete(key)
        setError(err instanceof Error ? err : new Error('Failed to fetch page'))
        setStatus('error')
      } finally {
        setIsFetchingNextPage(false)
      }
    },
    [fetchPage, queryKey]
  )

  useEffect(() => {
    void loadPage(null)
  }, [loadPage])

  const fetchNextPage = useCallback(async () => {
    if (!hasNextPage || isFetchingNextPage) {
      return
    }

    await loadPage(cursor)
  }, [cursor, hasNextPage, isFetchingNextPage, loadPage])

  return useMemo(
    () => ({
      data: items,
      status,
      error,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
    }),
    [error, fetchNextPage, hasNextPage, isFetchingNextPage, items, status]
  )
}
