import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { WIDGET_CACHE_DEFAULTS } from '../config/widgetCache'

/**
 * Per-widget cache state machine.
 *
 *  idle     – no fetch has run for this widget yet
 *  loading  – a fetch is in-flight; previous data is kept (when present) to
 *             avoid a flash of empty UI while the new payload arrives
 *  success  – `data` is set and `error` is undefined
 *  error    – `error` is set and `data` is preserved from the previous
 *             successful entry where available
 */
export type WidgetStatus = 'idle' | 'loading' | 'success' | 'error'

export interface WidgetEntry<T> {
  status: WidgetStatus
  data: T | undefined
  error: Error | undefined
  lastUpdated: number | undefined
}

export type WidgetFetcher<T> = () => Promise<T>

const EMPTY_ENTRY: WidgetEntry<unknown> = {
  status: 'idle',
  data: undefined,
  error: undefined,
  lastUpdated: undefined,
}

// Exposed as `WidgetCacheStore` so consumers can integrate with the same
// store the hook uses (for example: `useWidgetCache(...)` plus a banner
// that invalidates another widget imperatively).
class WidgetCacheStore {
  private entries = new Map<string, WidgetEntry<unknown>>()
  private listeners = new Map<string, Set<() => void>>()
  private abortControllers = new Map<string, AbortController>()

  get<T>(key: string): WidgetEntry<T> {
    return (
      (this.entries.get(key) as WidgetEntry<T> | undefined) ??
      (EMPTY_ENTRY as WidgetEntry<T>)
    )
  }

  subscribe(key: string, listener: () => void): () => void {
    let set = this.listeners.get(key)
    if (!set) {
      set = new Set()
      this.listeners.set(key, set)
    }
    set.add(listener)
    return () => {
      set?.delete(listener)
      if (set && set.size === 0) this.listeners.delete(key)
    }
  }

  private notify(key: string): void {
    this.listeners.get(key)?.forEach((fn) => fn())
  }

  private setEntry<T>(key: string, entry: WidgetEntry<T>): void {
    this.entries.set(key, entry)
    if (this.entries.size > WIDGET_CACHE_DEFAULTS.MAX_ENTRIES) {
      // Cheap FIFO prune — drop the oldest insertion. LRU semantics are
      // a future enhancement; documented in `WIDGET_CACHE_DEFAULTS.MAX_ENTRIES`.
      const firstKey = this.entries.keys().next().value
      if (firstKey && firstKey !== key) {
        this.entries.delete(firstKey)
      }
    }
    this.notify(key)
  }

  /**
   * Force a re-fetch for a single widget key. Calling `refresh('a')`
   * does NOT touch widget `'b'` — the per-widget isolation described
   * in issue #561 derives from here.
   *
   * Returns the underlying promise so callers can await in tests; UI
   * consumers should rely on `entry.status` and ignore the return value.
   */
  refresh<T>(key: string, fetcher: WidgetFetcher<T>): Promise<T> {
    // Cancel any in-flight refresh for the SAME key so the latest call
    // wins; the previous promise's `fetcher` will still run to completion
    // but its result will be discarded if it resolves after the abort.
    this.abortControllers.get(key)?.abort('superseded')
    const controller = new AbortController()
    this.abortControllers.set(key, controller)

    const prev = this.get<T>(key)
    this.setEntry(key, { ...prev, status: 'loading', error: undefined })

    return fetcher().then(
      (data) => {
        if (controller.signal.aborted) return data
        this.setEntry<T>(key, {
          status: 'success',
          data,
          error: undefined,
          lastUpdated: Date.now(),
        })
        this.abortControllers.delete(key)
        return data
      },
      (err: unknown) => {
        if (controller.signal.aborted) throw err
        const error = err instanceof Error ? err : new Error(String(err))
        // Preserve previous data so the UI doesn't go blank on a transient
        // failure; the error is still surfaced via `entry.error`.
        this.setEntry<T>(key, {
          status: 'error',
          data: prev.data,
          error,
          lastUpdated: prev.lastUpdated,
        })
        this.abortControllers.delete(key)
        throw error
      }
    )
  }

  /**
   * Idempotent auto-fetch used by `useWidgetCache`. Bails when the slot is
   * not in `idle` state (e.g. another subscriber has already kicked off a
   * fetch). Centralising the dedupe here means two components that mount
   * with the same widget key share a single initial network call instead
   * of racing each other and superseding via AbortController.
   */
  fetchIfIdle<T>(key: string, fetcher: WidgetFetcher<T>): void {
    const current = this.get<T>(key)
    if (current.status !== 'idle') return
    this.refresh(key, fetcher).catch(() => {
      /* surfaced via entry.error */
    })
  }

  invalidate(key: string): void {
    this.entries.delete(key)
    this.listeners.get(key)?.forEach((fn) => fn())
  }

  /**
   * Test-only helper. Not exported publicly; tests reach it via
   * `__TESTING__.store.resetAll()`. Also aborts any in-flight refresh so
   * listeners from a previous test don't leak `entry` references.
   */
  resetAll(): void {
    for (const controller of this.abortControllers.values()) controller.abort('reset')
    this.abortControllers.clear()
    this.entries.clear()
    this.listeners.clear()
  }
}

const store = new WidgetCacheStore()

export interface WidgetCacheContextValue {
  /** Invalidate a widget imperatively (e.g. from another widget's success). */
  invalidate: (key: string) => void
  /** Direct store access for advanced integrations. Prefer the hook. */
  store: WidgetCacheStore
}

const WidgetCacheContext = createContext<WidgetCacheContextValue | null>(null)

/**
 * Mounts the singleton widget cache into the React tree. Existing pages
 * that do not call `useWidgetCache` are unaffected — the provider is a
 * no-op for them.
 */
export function WidgetCacheProvider({ children }: { children: ReactNode }) {
  const value = useMemo<WidgetCacheContextValue>(
    () => ({
      invalidate: (key: string) => store.invalidate(key),
      store,
    }),
    []
  )
  return <WidgetCacheContext.Provider value={value}>{children}</WidgetCacheContext.Provider>
}

export interface UseWidgetCacheOptions {
  /** Set `false` to skip the initial automatic fetch. Defaults to `true`. */
  enabled?: boolean
}

export interface UseWidgetCacheResult<T> {
  /** Raw status string — useful for tests and richer UI states. */
  status: WidgetStatus
  data: T | undefined
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: Error | undefined
  lastUpdated: number | undefined
  /**
   * Force a re-fetch for this widget only. Does not affect other widgets
   * sharing the same `<WidgetCacheProvider>`. Safe to call repeatedly —
   * each call supersedes any in-flight refresh for the same key.
   */
  refresh: () => void
}

/**
 * Subscribe a component to a single widget slot in the shared cache.
 *
 * @param key       Stable widget identifier (e.g. `'trust:recent-activity'`).
 *                  Must be unique app-wide — collisions overwrite each other.
 * @param fetcher   Async function that produces the widget's data.
 * @param options   `{ enabled: false }` to skip the initial fetch.
 */
export function useWidgetCache<T>(
  key: string,
  fetcher: WidgetFetcher<T>,
  options: UseWidgetCacheOptions = {}
): UseWidgetCacheResult<T> {
  const enabled = options.enabled ?? true
  const ctx = useContext(WidgetCacheContext)

  // Stable fetcher ref so identity churn from a parent re-render does not
  // cause the `refresh` identity (and therefore downstream effect
  // dependencies) to change every render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [key]
  )
  const getSnapshot = useCallback(() => store.get<T>(key), [key])
  const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const refresh = useCallback(() => {
    const fn = fetcherRef.current
    store
      .refresh(key, fn)
      .catch(() => {
        // Errors are surfaced via `entry.error`; swallow here so a
        // misbehaving fetcher doesn't become an uncaught promise rejection.
      })
  }, [key, ctx])

  useEffect(() => {
    if (!enabled) return
    // Idempotent on the store side, so multiple subscribers sharing the
    // same widget key only trigger one initial fetch. We deliberately
    // exclude `entry.status` from the deps so we don't re-fire on every
    // status transition; fetchIfIdle is the dedupe boundary, so the
    // effect only needs to re-run when `enabled` flips or the consumer
    // targets a different `key`.
    store.fetchIfIdle(key, fetcherRef.current)
  }, [enabled, key])

  return {
    status: entry.status,
    data: entry.data,
    isLoading: entry.status === 'loading',
    isSuccess: entry.status === 'success',
    isError: entry.status === 'error',
    error: entry.error,
    lastUpdated: entry.lastUpdated,
    refresh,
  }
}

/**
 * Test-only escape hatch. Used by `WidgetCache.test.tsx` to reset the
 * singleton store between tests; not part of the public API surface.
 */
export const __TESTING__ = {
  store,
  WIDGET_CACHE_DEFAULTS,
}
