import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  QUIET_HOURS_TIME_PATTERN,
} from '../config/notifications'

/**
 * Pure-function helpers for the quiet hours feature.
 *
 * The toast provider and settings UI both depend on this module, but no
 * React hooks live here — every function is side-effect free so it can be
 * exhaustively tested in isolation.
 */

export interface QuietHoursWindow {
  /** Whether the user has opted in. */
  enabled: boolean
  /** Inclusive `HH:mm` start of the window. */
  start: string
  /** Inclusive `HH:mm` end of the window. */
  end: string
}

export interface QuietHoursDefaults {
  start: string
  end: string
}

/** Defaults applied when a user first enables the feature. */
export const QUIET_HOURS_DEFAULTS: QuietHoursDefaults = {
  start: DEFAULT_QUIET_HOURS_START,
  end: DEFAULT_QUIET_HOURS_END,
}

/** Outcome of parsing a `HH:mm` string. */
export type ParsedTime =
  | { ok: true; hours: number; minutes: number; totalMinutes: number }
  | { ok: false }

/**
 * Parse a `HH:mm` time string into discrete hour/minute values.
 *
 * Returns `{ ok: false }` for `null`, `undefined`, non-strings, or values
 * that don't match `QUIET_HOURS_TIME_PATTERN`.
 */
export function parseHHmm(value: unknown): ParsedTime {
  if (typeof value !== 'string' || value.length === 0) {
    return { ok: false }
  }
  const match = QUIET_HOURS_TIME_PATTERN.exec(value)
  if (!match) {
    return { ok: false }
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return {
    ok: true,
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes,
  }
}

/**
 * Returns `true` if `referenceMinutes` (minutes since midnight) falls inside
 * the window between `start` and `end`, inclusive at both ends.
 *
 * Behaviour:
 * - `start === end` is treated as an intentionally-degenerate window that
 *   silences nothing — the caller has not selected a meaningful range.
 * - A `start` that is later than `end` is interpreted as a window that
 *   crosses midnight (e.g. `22:00` → `07:00`).
 * - Invalid inputs short-circuit to `false` rather than throwing so the
 *   toast provider stays robust against malformed persisted state.
 */
export function isWithinQuietHours(
  start: string,
  end: string,
  referenceMinutes: number,
): boolean {
  if (!Number.isFinite(referenceMinutes)) return false
  const parsedStart = parseHHmm(start)
  const parsedEnd = parseHHmm(end)
  if (!parsedStart.ok || !parsedEnd.ok) return false
  if (parsedStart.totalMinutes === parsedEnd.totalMinutes) return false

  if (parsedStart.totalMinutes < parsedEnd.totalMinutes) {
    return (
      referenceMinutes >= parsedStart.totalMinutes &&
      referenceMinutes <= parsedEnd.totalMinutes
    )
  }

  // Cross-midnight: quiet hours covers from `start` through end-of-day, AND
  // from start-of-day through `end`.
  return (
    referenceMinutes >= parsedStart.totalMinutes ||
    referenceMinutes <= parsedEnd.totalMinutes
  )
}

/**
 * Returns the minutes-since-midnight for the supplied `Date`, using local
 * time. Exposed primarily so tests can inject a deterministic clock.
 */
export function nowMinutesSinceMidnight(reference: Date = new Date()): number {
  return reference.getHours() * 60 + reference.getMinutes()
}

/**
 * Decide whether `now` falls inside the user's quiet hours window.
 *
 * Returns `false` when the feature is disabled or when either bound is
 * malformed. Critically, this function knows nothing about toast severity:
 * the caller (typically `ToastProvider`) is responsible for exempting
 * critical severities so they always surface.
 */
export function isQuietHoursActive(
  window: QuietHoursWindow,
  reference: Date = new Date(),
): boolean {
  if (!window.enabled) return false
  return isWithinQuietHours(window.start, window.end, nowMinutesSinceMidnight(reference))
}
