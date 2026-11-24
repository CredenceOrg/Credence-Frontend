/**
 * errorReporting.ts
 *
 * Thin, opt-in bridge between the app's failure sites and Sentry.
 *
 * Design constraints
 * ------------------
 *  1. **No DSN, no SDK.** `@sentry/browser` is loaded with a dynamic
 *     `import()`, and only after `SENTRY_CONFIG.enabled` is true. Deployments
 *     without `VITE_SENTRY_DSN` therefore never download or execute the SDK,
 *     and the initial JS bundle is unchanged.
 *  2. **Reporting never breaks the app.** Every entry point is total: import
 *     failures, a blocked CDN chunk and SDK errors are swallowed (a single dev
 *     warning is printed) so a crash handler can't itself crash the page.
 *  3. **Nothing personal leaves the device.** `beforeSend` runs the event
 *     through `scrubTelemetryPII`, stripping wallet addresses, emails and
 *     amounts at any depth.
 *  4. **One handler per global event.** The SDK's own `GlobalHandlers`
 *     integration is filtered out so uncaught errors and unhandled rejections
 *     are reported exactly once, through our explicit listeners.
 */
import { SENTRY_CONFIG } from '../config/sentry'
import { scrubTelemetryPII } from './piiScrub'

type SentrySdk = typeof import('@sentry/browser')

/** Extra, non-sensitive context attached to a reported failure. */
export type ErrorReportingContext = Record<string, unknown>

let sdk: SentrySdk | null = null
let initPromise: Promise<SentrySdk | null> | null = null
let warnedAboutInitFailure = false

/**
 * Flag stored on `window` so the listeners stay single-registered even if this
 * module is evaluated more than once (HMR in dev, or a duplicated chunk).
 */
const GLOBAL_HANDLERS_FLAG = '__credenceErrorReportingHandlersInstalled'

/** True when a DSN is configured, i.e. when reporting is switched on. */
export function isErrorReportingEnabled(): boolean {
  return SENTRY_CONFIG.enabled
}

/**
 * Scrub an event before it is sent. Exported so the contract is testable and
 * so other reporters can reuse the same redaction rules.
 */
export function scrubReportedEvent<T>(event: T): T {
  return scrubTelemetryPII(event)
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason: unknown = event.reason
  void captureException(reason instanceof Error ? reason : new Error(String(reason)), {
    source: 'unhandledrejection',
  })
}

function handleWindowError(event: ErrorEvent): void {
  const error: unknown = event.error
  if (!(error instanceof Error)) return
  void captureException(error, { source: 'window.onerror' })
}

function installGlobalHandlers(): void {
  if (typeof window === 'undefined') return
  const flag = window as unknown as Record<string, unknown>
  if (flag[GLOBAL_HANDLERS_FLAG]) return
  flag[GLOBAL_HANDLERS_FLAG] = true
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
  window.addEventListener('error', handleWindowError)
}

/**
 * Initialise the SDK once. Resolves even when reporting is disabled or the SDK
 * fails to load; callers never need to guard the call.
 */
export async function initErrorReporting(): Promise<void> {
  if (!SENTRY_CONFIG.enabled) return

  if (!initPromise) {
    initPromise = (async (): Promise<SentrySdk | null> => {
      try {
        const Sentry = await import('@sentry/browser')
        Sentry.init({
          dsn: SENTRY_CONFIG.dsn,
          environment: SENTRY_CONFIG.environment,
          ...(SENTRY_CONFIG.release ? { release: SENTRY_CONFIG.release } : {}),
          sampleRate: SENTRY_CONFIG.sampleRate,
          tracesSampleRate: SENTRY_CONFIG.tracesSampleRate,
          // Report uncaught errors and rejections through our own listeners so
          // scrubbing and de-duplication run in one place.
          integrations: (integrations) => integrations.filter((it) => it.name !== 'GlobalHandlers'),
          beforeSend(event) {
            try {
              return scrubReportedEvent(event)
            } catch {
              // Never let scrubbing failure send an unscrubbed payload.
              return null
            }
          },
        })
        sdk = Sentry
        return Sentry
      } catch (error) {
        if (import.meta.env.DEV && !warnedAboutInitFailure) {
          warnedAboutInitFailure = true
          console.warn('[errorReporting] Sentry failed to initialise:', error)
        }
        return null
      }
    })()
  }

  await initPromise
  installGlobalHandlers()
}

/**
 * Report an exception. A no-op when no DSN is configured, which makes it safe
 * to call unconditionally from `componentDidCatch` and global handlers.
 */
export async function captureException(
  error: unknown,
  context: ErrorReportingContext = {}
): Promise<void> {
  if (!SENTRY_CONFIG.enabled) return

  await initErrorReporting()
  if (!sdk) return

  try {
    sdk.captureException(error, { extra: scrubReportedEvent({ ...context }) })
  } catch {
    // Telemetry must never surface an error to the user.
  }
}
