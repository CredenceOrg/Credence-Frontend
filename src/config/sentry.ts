/**
 * Resolve the Sentry DSN from runtime config (window.__RUNTIME_CONFIG__),
 * then fall back to the build-time Vite env var, then to empty string.
 */
function resolveDsn(): string {
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__?.VITE_SENTRY_DSN) {
    return window.__RUNTIME_CONFIG__.VITE_SENTRY_DSN.trim()
  }
  return import.meta.env.VITE_SENTRY_DSN?.trim() || ''
}

export const SENTRY_CONFIG = {
  dsn: resolveDsn(),
} as const

export type SentryConfig = typeof SENTRY_CONFIG

export default SENTRY_CONFIG
