/**
 * Structured logger for application lifecycle and recoverable events.
 *
 * Output is one key=value line per call, suitable for `grep` and machine parsing.
 * Never logs secret-like fields; if a caller passes a forbidden field name,
 * the entry is silently dropped from the line so a misuse cannot leak a token.
 *
 * Use `info` for lifecycle events (a locale switched, a session started),
 * `warn` for recoverable conditions (a stale cache, a retry), and `error`
 * only when the caller cannot proceed.
 */

export type LogLevel = 'info' | 'warn' | 'error'

export type LogFields = Record<string, string | number | boolean | null | undefined>

/** Field names that must never appear in a log line. Matched case-insensitively. */
const FORBIDDEN_KEYS = new Set([
  'secret',
  'token',
  'password',
  'authorization',
  'cookie',
  'session',
  'apikey',
  'api_key',
  'private_key',
])

const escape = (raw: string): string => raw.replace(/([\\\n\r=])/g, '\\$1')

const renderValue = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  const str = typeof value === 'string' ? value : String(value)
  if (str === '') return '-'
  return escape(str)
}

const emit = (level: LogLevel, event: string, fields: LogFields): void => {
  const safeFields: Array<[string, string]> = []
  for (const [key, value] of Object.entries(fields)) {
    const lowered = key.toLowerCase()
    if (FORBIDDEN_KEYS.has(lowered)) continue
    if (typeof value === 'string' && /^(bearer\s|sk_|pk_|ghp_|xox[a-z]-)/i.test(value)) continue
    safeFields.push([escape(key), renderValue(value)])
  }
  const ts = new Date().toISOString()
  const parts = [`ts=${ts}`, `level=${level}`, `event=${escape(event)}`, ...safeFields.map(([k, v]) => `${k}=${v}`)]
  const line = parts.join(' ')
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info
  try {
    sink(line)
  } catch {
    /* never throw from logging */
  }
}

export const logInfo = (event: string, fields: LogFields = {}): void => emit('info', event, fields)
export const logWarn = (event: string, fields: LogFields = {}): void => emit('warn', event, fields)
export const logError = (event: string, fields: LogFields = {}): void => emit('error', event, fields)
