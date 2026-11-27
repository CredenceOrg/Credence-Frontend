import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError, ApiSessionConflictError, getIdentityEpoch } from '../api/client'
import { WIDGET_CACHE_DEFAULTS } from '../config/widgetCache'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { QUERY_CACHE_TTLS } from '../config/queryCache'
import { scrubPII } from '../lib/piiScrub'

// ── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  lastUpdated: number
  ttlMs: number
  gcTimer: ReturnType<typeof setTimeout>
}

const cache = new Map<string, CacheEntry<unknown>>()

function buildCacheKey(path: string, network: string, address: string): string {
  return `${network}:${address || 'anon'}:${path}`
}

function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  return cache.get(key) as CacheEntry<T> | undefined
}

function setCacheEntry<T>(
  key: string,
  data: T,
  ttlMs: number,
  gcTimeMs: number
): void {
  const previous = getCacheEntry<T>(key)
  if (previous) {
    clearTimeout(previous.gcTimer)
  }

  const gcTimer = setTimeout(() => {
    cache.delete(key)
  }, gcTimeMs)
  cache.set(key, { data, lastUpdated: Date.now(), ttlMs, gcTimer })
}

function isCacheFresh(key: string, staleTimeMs: number): boolean {
  const entry = getCacheEntry(key)
  if (!entry) return false
  return Date.now() - entry.lastUpdated < staleTimeMs
}

function isCacheExpired(key: string): boolean {
  const entry = getCacheEntry(key)
  if (!entry) return true
  return Date.now() - entry.lastUpdated >= entry.ttlMs
}

function evictIfExpired<T>(key: string): CacheEntry<T> | undefined {
  const entry = getCacheEntry<T>(key)
  if (entry && isCacheExpired(key)) {
    clearTimeout(entry.gcTimer)
    cache.delete(key)
    return undefined
  }
  return entry
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface UseApiQueryOptions {
  /** Set `false` to skip the initial fetch. Default `true`. */
  enabled?: boolean
  /** Time in ms before cached data is considered stale. */
  staleTimeMs?: number
  /** Time in ms before stale cached data is no longer served. */
  ttlMs?: number
  /** Time in ms before an unused cache entry is garbage-collected. */
  gcTimeMs?: number
  /** Additional identity scope for cached data, such as wallet and network. */
  identityKey?: string
}

export interface UseApiQueryResult<T> {
  data: T | undefined
  isLoading: boolean
  error: ApiError | null
  /** Whether the current data is stale-while-revalidating or expired. */
  isStale: boolean
  /** Force a re-fetch, bypassing stale-time checks. */
  refetch: () => Promise<void>
}

/**
 * Type-safe, cache-aware wrapper around `apiFetch` for GET requests.
 *
 * Automatically manages loading/error states, caches responses keyed by the
 * API path (and optional identity scope), and serves cached data within the
 * configured `staleTimeMs`. An in-flight request is aborted when the component
 * unmounts, becomes disabled, or a new fetch supersedes it.
 *
 * @param path    API path passed to `apiFetch` (e.g. `'/trust-score/GABC…'`).
 * @param options `{ enabled, staleTimeMs, ttlMs, gcTimeMs, identityKey }`.
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
    staleTimeMs = QUERY_CACHE_TTLS.STALE_TIME_MS,
    ttlMs = QUERY_CACHE_TTLS.DEFAULT_TTL_MS,
    gcTimeMs = QUERY_CACHE_TTLS.GC_TIME_MS,
    identityKey,
  } = options
  const queryKey = makeCacheKey(path, identityKey)

  const [dataState, setDataState] = useState<{ key: string; value: T } | undefined>(() => {
    const cached = evictIfExpired<T>(queryKey)
    return cached ? { key: queryKey, value: cached.data } : undefined
  })
  const [errorState, setErrorState] = useState<{ key: string; value: ApiError } | undefined>()
  const [loadingState, setLoadingState] = useState({ key: queryKey, value: enabled })
  const [staleState, setStaleState] = useState(() => {
    const cached = evictIfExpired<T>(queryKey)
    return { key: queryKey, value: cached !== undefined && !isCacheFresh(queryKey, staleTimeMs) }
  const { enabled = true, staleTimeMs = WIDGET_CACHE_DEFAULTS.STALE_TIME_MS } = options
  const { network } = useSettings()
  const { address } = useWallet()
  const cacheKey = buildCacheKey(path, network, address)

  const [data, setData] = useState<T | undefined>(() => {
    const cached = getCacheEntry<T>(cacheKey)
    return cached?.data
  })
  const [error, setError] = useState<ApiError | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(enabled)
  const [isStale, setIsStale] = useState<boolean>(() => {
    const cached = getCacheEntry<T>(cacheKey)
    return cached !== undefined && !isCacheFresh(cacheKey, staleTimeMs)
  })

  const mountedRef = useRef(true)
  const runIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const pathRef = useRef(path)
  pathRef.current = path
  const identityKeyRef = useRef(identityKey)
  identityKeyRef.current = identityKey
  const cacheKeyRef = useRef(cacheKey)
  const prevCacheKeyRef = useRef(cacheKey)
  cacheKeyRef.current = cacheKey

  // Cleanup: mark unmounted, abort any in-flight request
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort('unmounted')
      abortRef.current = null
    }
  }, [])

  // Abort in-flight requests and reset state when network, address, or path changes
  useEffect(() => {
    if (prevCacheKeyRef.current === cacheKey) return
    prevCacheKeyRef.current = cacheKey

    abortRef.current?.abort('context-changed')
    abortRef.current = null
    runIdRef.current += 1

    const cached = getCacheEntry<T>(cacheKey)
    setData(cached?.data)
    setIsStale(cached !== undefined && !isCacheFresh(cacheKey, staleTimeMs))
    setError(null)
  }, [cacheKey, staleTimeMs])

  const fetch = useCallback(
    async (bypassCache = false): Promise<void> => {
      const currentPath = pathRef.current
      const currentQueryKey = makeCacheKey(currentPath, identityKeyRef.current)
      let serveStaleInBackground = false

      // Serve from cache unless bypassed
      if (!bypassCache && isCacheFresh(currentQueryKey, staleTimeMs)) {
        const cached = getCacheEntry<T>(currentQueryKey)
      const currentKey = cacheKeyRef.current

      // Serve from cache unless bypassed
      const currentKey = cacheKeyRef.current

      // Serve from cache unless bypassed
      const currentKey = cacheKeyRef.current

      // Serve from cache unless bypassed
      if (!bypassCache && isCacheFresh(currentKey, staleTimeMs)) {
        const cached = getCacheEntry<T>(currentKey)
        if (cached) {
      if (!bypassCache) {
        const cached = evictIfExpired<T>(currentQueryKey)
        if (cached && isCacheFresh(currentQueryKey, staleTimeMs)) {
          setDataState({ key: currentQueryKey, value: cached.data })
          setStaleState({ key: currentQueryKey, value: false })
          setErrorState(undefined)
          setLoadingState({ key: currentQueryKey, value: false })
          return
        }
        if (cached) {
          setDataState({ key: currentQueryKey, value: cached.data })
          setStaleState({ key: currentQueryKey, value: true })
          setLoadingState({ key: currentQueryKey, value: false })
          serveStaleInBackground = true
        }
      } else {
        evictIfExpired<T>(currentQueryKey)
      }

      if (bypassCache) {
        const cached = evictIfExpired<T>(currentQueryKey)
        if (cached) {
          setStaleState({ key: currentQueryKey, value: false })
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
      if (!serveStaleInBackground) {
        setLoadingState({ key: currentQueryKey, value: true })
        setErrorState(undefined)
      }
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
          setCacheEntry(currentQueryKey, sanitized, ttlMs, gcTimeMs)
          setStaleState({ key: currentQueryKey, value: false })
          setErrorState(undefined)
          setData(sanitized)
          setCacheEntry(currentKey, sanitized)
          setIsStale(false)
          setError(null)
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
    [staleTimeMs, ttlMs, gcTimeMs, cacheKey]
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
      : evictIfExpired<T>(queryKey) !== undefined &&
        !isCacheFresh(queryKey, staleTimeMs)

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
export function invalidateApiQuery(path: string): void {
  const suffix = `:${path}`
  for (const key of cache.keys()) {
    if (key === path || key.endsWith(suffix)) {
      cache.delete(key)
    }
  }
  const key = makeCacheKey(path, identityKey)
  const entry = cache.get(key)
  if (entry) clearTimeout(entry.gcTimer)
  cache.delete(key)
}

/**
 * Clear the entire API query cache. Useful in tests.
 */
export function clearApiQueryCache(): void {
  for (const entry of cache.values()) {
    clearTimeout(entry.gcTimer)
  }
  cache.clear()
}
