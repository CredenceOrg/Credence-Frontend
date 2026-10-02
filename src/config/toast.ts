// Default toast timeout values (in milliseconds).
// Can be overridden at build/runtime via Vite env vars:
// - VITE_TOAST_TIMEOUT       Overrides the default timeout for info/success toasts
// - VITE_TOAST_TIMEOUT_WARNING  Overrides the warning toast timeout
const DEFAULT_TIMEOUTS = {
  info: 5000,
  success: 5000,
  warning: 8000,
  danger: 0,
} as const

/**
 * Parse an environment timeout override.
 *
 * Invariants:
 * - Returns null for missing, blank, non-numeric, negative, or non-finite values.
 * - Returns a non-negative integer otherwise.
 * - Never throws; invalid input falls back to the compiled-in default.
 */
function parseEnvTimeout(raw: string | undefined): number | null {
if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 0) return null
  return Math.round(parsed)
}

/**
 * Resolve the timeout for a given severity.
 *
 * The danger severity is always 0 (no auto-dismiss) and cannot be
 * overridden by environment variables, because dismissing a danger toast
 * automatically could hide a failure from the user.
 */
function resolveTimeout(
  severity: keyof typeof DEFAULT_TIMEOUTS,
  override: number | null,
): number {
  if (severity === 'danger') return DEFAULT_TIMEOUTS.danger
  if (override !== null) return override
  return DEFAULT_TIMEOUTS[severity]
}

const SHARED_TIMEOUT_OVERRIDE = parseEnvTimeout(import.meta.env.VITE_TOAST_TIMEOUT)
const WARNING_TIMEOUT_OVERRIDE = parseEnvTimeout(import.meta.env.VITE_TOAST_TIMEOUT_WARNING)

export const TOAST_CONFIG = {
  /** Timeout per severity (milliseconds). 0 = no auto-dismiss. */
  timeouts: {
    info: parseEnvTimeout(import.meta.env.VITE_TOAST_TIMEOUT) ?? DEFAULT_TIMEOUTS.info,
    success: parseEnvTimeout(import.meta.env.VITE_TOAST_TIMEOUT) ?? DEFAULT_TIMEOUTS.success,
    warning: parseEnvTimeout(import.meta.env.VITE_TOAST_TIMEOUT_WARNING) ?? DEFAULT_TIMEOUTS.warning,
    danger: DEFAULT_TIMEOUTS.danger,
  },
  /** Maximum number of toasts displayed simultaneously. */
  maxToasts: 3,
} as const

export type ToastConfig = typeof TOAST_CONFIG

export default TOAST_CONFIG
