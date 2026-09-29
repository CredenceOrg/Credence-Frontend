/**
 * Central constants for the widget cache and dashboard demo fetchers.
 *
 * Imported by:
 *  - `src/widgetCache/WidgetCache.tsx` for cache defaults
 *  - dashboard pages (`src/pages/Bond.tsx`, `src/pages/TrustScore.tsx`)
 *    for `WIDGET_DEMO_FETCH` so every mocked latency lives in one place
 *
 * Land new widget-cache related constants here rather than scattered
 * across the codebase.
 */

export const WIDGET_CACHE_DEFAULTS = {
  /**
   * How long (ms) a successful entry is considered "fresh enough" to skip
   * a refetch. Currently informational; the hook treats every `refresh()`
   * call as unconditional but exposes `lastUpdated` so consumers can decide.
   */
  STALE_TIME_MS: 30_000,
  /**
   * Maximum number of distinct widget keys the in-memory cache should keep
   * before pruning. The store enforces this FIFO on every write (the oldest
   * insertion is dropped when exceeded). Real LRU eviction is tracked as
   * future work in `docs/widget-cache.md`.
   */
  MAX_ENTRIES: 64,
} as const

export const WIDGET_DEMO_FETCH = {
  /**
   * Simulated network latency (ms) for the demo bond-list and recent-activity
   * fetchers. Centralised so the dashboard feels consistent and so it can be
   * tweaked (or set to 0) without touching page-level code.
   */
  LATENCY_MS: 600,
} as const

export type WidgetCacheDefaults = typeof WIDGET_CACHE_DEFAULTS
export type WidgetDemoFetch = typeof WIDGET_DEMO_FETCH
