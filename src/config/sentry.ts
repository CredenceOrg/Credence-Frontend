const DEFAULT_DSN = ''

const envDsn = import.meta.env.VITE_SENTRY_DSN?.trim() || DEFAULT_DSN

/**
 * Read a sample rate from the environment.
 *
 * Accepts any finite number and clamps it into `[0, 1]`. Unset, blank or
 * non-numeric values fall back to `fallback` so a typo in a deployment's env
 * cannot silently switch telemetry off (or on) by accident.
 */
function readSampleRate(raw: string | undefined, fallback: number): number {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback
  const parsed = Number(raw.trim())
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(1, Math.max(0, parsed))
}

const environment =
  import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() ||
  (import.meta.env.PROD ? 'production' : 'development')

const release = import.meta.env.VITE_SENTRY_RELEASE?.trim() || undefined

export const SENTRY_CONFIG = {
  dsn: envDsn,
  /**
   * Error reporting is opt-in: an empty DSN keeps the SDK out of the bundle's
   * runtime path entirely (see `src/lib/errorReporting.ts`).
   */
  enabled: envDsn.length > 0,
  environment,
  release,
  /** Fraction of error events sent. 1 = every event. */
  sampleRate: readSampleRate(import.meta.env.VITE_SENTRY_SAMPLE_RATE, 1),
  /** Fraction of performance transactions traced. 0 = tracing off. */
  tracesSampleRate: readSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0),
} as const

export type SentryConfig = typeof SENTRY_CONFIG

export default SENTRY_CONFIG
