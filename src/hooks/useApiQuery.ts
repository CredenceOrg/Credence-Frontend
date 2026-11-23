import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import { WIDGET_CACHE_DEFAULTS } from '../config/widgetCache'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { scrubPII } from '../lib/piiScrub'

// ── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  lastUpdated: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function buildCacheKey(path: string, network: string, address: string): string {
  return `${network}:${address || 'anon'}:${path}`
}

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
 * API path, and serves cached data within the configured `staleTime`. An
 * in-flight request is aborted when the component unmounts or when a new
 * fetch supersedes it.
 *
 * @param path    API path passed to `apiFetch` (e.g. `'/trust-score/GABC…'`).
 * @param options `{ enabled, staleTimeMs }`.
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
      const currentKey = cacheKeyRef.current

      // Serve from cache unless bypassed
      if (!bypassCache && isCacheFresh(currentKey, staleTimeMs)) {
        const cached = getCacheEntry<T>(currentKey)
        if (cached) {
          setData(cached.data)
          setIsStale(false)
          setError(null)
          setIsLoading(false)
          return
        }
      }

      // Offline guard
      if (typeof window !== 'undefined' && !window.navigator.onLine) {
        setIsLoading(false)
        return
      }

      // Abort any previous in-flight request for this hook
      abortRef.current?.abort('superseded')
      const controller = new AbortController()
      abortRef.current = controller

      const currentRunId = ++runIdRef.current
      setIsLoading(true)
      setError(null)

      try {
        const result = await apiFetch<T>(currentPath, {
          signal: controller.signal,
        })
        // Keep the cache as a safe boundary: callers receive the same
        // sanitized value that is stored, so PII cannot leak through the
        // query hook before it reaches the cache.
        const sanitized = scrubPII(result)

        if (mountedRef.current && currentRunId === runIdRef.current) {
          setData(sanitized)
          setCacheEntry(currentKey, sanitized)
          setIsStale(false)
          setError(null)
        }
      } catch (err) {
        if (controller.signal.aborted) return

        if (mountedRef.current && currentRunId === runIdRef.current) {
          setError(err instanceof ApiError ? err : new ApiError(0, String(err)))
        }
      } finally {
        if (mountedRef.current && currentRunId === runIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [staleTimeMs, cacheKey]
  )

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      void fetch(false)
    } else {
      setIsLoading(false)
    }
  }, [enabled, fetch])

  return { data, isLoading, error, isStale, refetch: () => fetch(true) }
}

/**
 * Invalidate a single cached entry so the next mount or refetch re-fetches.
 *
 * @example
 * ```ts
 * invalidateApiQuery('/trust-score/GABC…')
 * ```
 */
export function invalidateApiQuery(path: string): void {
  const suffix = `:${path}`
  for (const key of cache.keys()) {
    if (key === path || key.endsWith(suffix)) {
      cache.delete(key)
    }
  }
}

/**
 * Clear the entire API query cache. Useful in tests.
 */
export function clearApiQueryCache(): void {
  cache.clear()
}
