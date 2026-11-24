import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError, ApiSessionConflictError, getIdentityEpoch } from '../api/client'
import { WIDGET_CACHE_DEFAULTS } from '../config/widgetCache'
import { scrubPII } from '../lib/piiScrub'

// ── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  lastUpdated: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined
}

function setCacheEntry<T>(key: string, data: T): void {
  cache.set(key, { data, lastUpdated: Date.now() })
}

function isCacheFresh(key: string, staleTimeMs: number): boolean {
  const entry = getCacheEntry(key)
  if (!entry) return false
  return Date.now() - entry.lastUpdated < staleTimeMs
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface UseApiQueryOptions {
  /** Set `false` to skip the initial fetch. Default `true`. */
  enabled?: boolean
  /** Time in ms before cached data is considered stale. Default 30 000. */
  staleTimeMs?: number
  /** Additional identity scope for cached data, such as wallet and network. */
  identityKey?: string
}

export interface UseApiQueryResult<T> {
  data: T | undefined
  isLoading: boolean
  error: ApiError | null
  /** Whether the current data came from cache (within staleTime). */
  isStale: boolean
  /** Force a re-fetch, bypassing stale-time checks. */
  refetch: () => Promise<void>
}

/**
 * Type-safe, cache-aware wrapper around `apiFetch` for GET requests.
 *
 * Automatically manages loading/error states, caches responses keyed by the
 * API path (and optional identity scope), and serves cached data within the
 * configured `staleTime`. An in-flight request is aborted when the component
 * unmounts, becomes disabled, or a new fetch supersedes it.
 *
 * @param path    API path passed to `apiFetch` (e.g. `'/trust-score/GABC…'`).
 * @param options `{ enabled, staleTimeMs, identityKey }`.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useApiQuery<TrustScore>(
 *   `/trust-score/${address}`,
 * )
 * ```
 */
export function useApiQuery<T>(
  path: string,
  options: UseApiQueryOptions = {}
): UseApiQueryResult<T> {
  const {
    enabled = true,
    staleTimeMs = WIDGET_CACHE_DEFAULTS.STALE_TIME_MS,
    identityKey,
  } = options
  const queryKey = makeCacheKey(path, identityKey)

  const [dataState, setDataState] = useState<{ key: string; value: T } | undefined>(() => {
    const cached = getCacheEntry<T>(queryKey)
    return cached ? { key: queryKey, value: cached.data } : undefined
  })
  const [errorState, setErrorState] = useState<{ key: string; value: ApiError } | undefined>()
  const [loadingState, setLoadingState] = useState({ key: queryKey, value: enabled })
  const [staleState, setStaleState] = useState(() => {
    const cached = getCacheEntry<T>(queryKey)
    return { key: queryKey, value: cached !== undefined && !isCacheFresh(queryKey, staleTimeMs) }
  })

  const mountedRef = useRef(true)
  const runIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const pathRef = useRef(path)
  pathRef.current = path
  const identityKeyRef = useRef(identityKey)
  identityKeyRef.current = identityKey

  // Cleanup: mark unmounted, abort any in-flight request
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort('unmounted')
      abortRef.current = null
    }
  }, [])

  const fetch = useCallback(
    async (bypassCache = false): Promise<void> => {
      const currentPath = pathRef.current
      const currentQueryKey = makeCacheKey(currentPath, identityKeyRef.current)

      // Serve from cache unless bypassed
      if (!bypassCache && isCacheFresh(currentQueryKey, staleTimeMs)) {
        const cached = getCacheEntry<T>(currentQueryKey)
        if (cached) {
          setDataState({ key: currentQueryKey, value: cached.data })
          setStaleState({ key: currentQueryKey, value: false })
          setErrorState(undefined)
          setLoadingState({ key: currentQueryKey, value: false })
          return
        }
      }

      // Offline guard
      if (typeof window !== 'undefined' && !window.navigator.onLine) {
        setLoadingState({ key: currentQueryKey, value: false })
        return
      }

      // Abort any previous in-flight request for this hook
      abortRef.current?.abort('superseded')
      const controller = new AbortController()
      abortRef.current = controller

      const currentRunId = ++runIdRef.current
      setLoadingState({ key: currentQueryKey, value: true })
      setErrorState(undefined)
      const identityEpoch =
        identityKeyRef.current === undefined ? undefined : getIdentityEpoch()

      try {
        const result = await apiFetch<T>(currentPath, {
          signal: controller.signal,
          ...(identityEpoch === undefined ? {} : { identityEpoch }),
        })
        // Keep the cache as a safe boundary: callers receive the same
        // sanitized value that is stored, so PII cannot leak through the
        // query hook before it reaches the cache.
        const sanitized = scrubPII(result)

        if (mountedRef.current && currentRunId === runIdRef.current) {
          setDataState({ key: currentQueryKey, value: sanitized })
          setCacheEntry(currentQueryKey, sanitized)
          setStaleState({ key: currentQueryKey, value: false })
          setErrorState(undefined)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        if (identityKeyRef.current !== undefined && err instanceof ApiSessionConflictError) return

        if (mountedRef.current && currentRunId === runIdRef.current) {
          setErrorState({
            key: currentQueryKey,
            value: err instanceof ApiError ? err : new ApiError(0, String(err)),
          })
        }
      } finally {
        if (mountedRef.current && currentRunId === runIdRef.current) {
          setLoadingState({ key: currentQueryKey, value: false })
        }
      }
    },
    [staleTimeMs]
  )

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      void fetch(false)
    } else {
      abortRef.current?.abort('disabled')
      runIdRef.current += 1
      setLoadingState({ key: queryKey, value: false })
    }
  }, [enabled, fetch, queryKey])

  const data = dataState?.key === queryKey ? dataState.value : undefined
  const error = errorState?.key === queryKey ? errorState.value : null
  const isLoading = enabled && (loadingState.key !== queryKey || loadingState.value)
  const isStale =
    staleState.key === queryKey
      ? staleState.value
      : getCacheEntry<T>(queryKey) !== undefined && !isCacheFresh(queryKey, staleTimeMs)

  return { data, isLoading, error, isStale, refetch: () => fetch(true) }
}

function makeCacheKey(path: string, identityKey?: string): string {
  return identityKey === undefined ? path : `${path}\u0000${identityKey}`
}

/**
 * Invalidate a single cached entry so the next mount or refetch re-fetches.
 *
 * @example
 * ```ts
 * invalidateApiQuery('/trust-score/GABC…')
 * ```
 */
export function invalidateApiQuery(path: string, identityKey?: string): void {
  cache.delete(makeCacheKey(path, identityKey))
}

/**
 * Clear the entire API query cache. Useful in tests.
 */
export function clearApiQueryCache(): void {
  cache.clear()
}
