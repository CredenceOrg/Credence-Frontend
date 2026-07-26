const DEFAULT_DSN = ''

const envDsn = import.meta.env.VITE_SENTRY_DSN?.trim() || DEFAULT_DSN

export const SENTRY_CONFIG = {
  dsn: envDsn,
} as const

export type SentryConfig = typeof SENTRY_CONFIG

export default SENTRY_CONFIG
