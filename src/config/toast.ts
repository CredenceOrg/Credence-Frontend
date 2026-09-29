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

function parseEnvTimeout(raw: string | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null
}

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