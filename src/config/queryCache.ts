/**
 * Central configuration module for query-cache TTLs (closes #746).
 *
 * Exposes sane default TTL (Time-To-Live) values in milliseconds for
 * query caching and provides environment variable overrides (`VITE_QUERY_CACHE_*`).
 *
 * Imported by:
 *  - Query client and dashboard data fetchers (issuer / verifier workflows)
 *
 * Precedence:
 *  1. Environment variable override (if present, non-empty, numeric, and > 0)
 *  2. Built-in default value
 */

export const QUERY_CACHE_DEFAULTS = {
  /** Default TTL for general queries (1 minute). */
  DEFAULT_TTL_MS: 60_000,
  /** Duration before cached query data is considered stale (30 seconds). */
  STALE_TIME_MS: 30_000,
  /** Garbage collection / cache duration before unused entries are evicted (5 minutes). */
  GC_TIME_MS: 300_000,
  /** TTL for issuer-specific dashboard queries (2 minutes). */
  ISSUER_TTL_MS: 120_000,
  /** TTL for verifier-specific dashboard queries (2 minutes). */
  VERIFIER_TTL_MS: 120_000,
} as const

/**
 * Safely parses a TTL environment variable override.
 * Falls back to `defaultValue` if `envValue` is undefined, empty, whitespace,
 * non-numeric, zero, or negative.
 */
export function parseTtlEnv(
  envValue: string | undefined,
  defaultValue: number,
): number {
  if (envValue === undefined) {
    return defaultValue
  }
  const trimmed = envValue.trim()
  if (trimmed === '') {
    return defaultValue
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue
  }
  return parsed
}

export const QUERY_CACHE_TTLS = {
  DEFAULT_TTL_MS: parseTtlEnv(
    import.meta.env?.VITE_QUERY_CACHE_DEFAULT_TTL_MS,
    QUERY_CACHE_DEFAULTS.DEFAULT_TTL_MS,
  ),
  STALE_TIME_MS: parseTtlEnv(
    import.meta.env?.VITE_QUERY_CACHE_STALE_TIME_MS,
    QUERY_CACHE_DEFAULTS.STALE_TIME_MS,
  ),
  GC_TIME_MS: parseTtlEnv(
    import.meta.env?.VITE_QUERY_CACHE_GC_TIME_MS,
    QUERY_CACHE_DEFAULTS.GC_TIME_MS,
  ),
  ISSUER_TTL_MS: parseTtlEnv(
    import.meta.env?.VITE_QUERY_CACHE_ISSUER_TTL_MS,
    QUERY_CACHE_DEFAULTS.ISSUER_TTL_MS,
  ),
  VERIFIER_TTL_MS: parseTtlEnv(
    import.meta.env?.VITE_QUERY_CACHE_VERIFIER_TTL_MS,
    QUERY_CACHE_DEFAULTS.VERIFIER_TTL_MS,
  ),
} as const

export type QueryCacheDefaults = typeof QUERY_CACHE_DEFAULTS
export type QueryCacheTtls = typeof QUERY_CACHE_TTLS

export default QUERY_CACHE_TTLS
