/**
 * Centralized constants for the notifications feature.
 *
 * Land new defaults for any notification-related preference here so they stay
 * in a single place — mirrors the project convention used by `src/config/links.ts`.
 */

/** Default start of the quiet hours window when the user enables the feature. */
export const DEFAULT_QUIET_HOURS_START = '22:00'

/** Default end of the quiet hours window when the user enables the feature. */
export const DEFAULT_QUIET_HOURS_END = '07:00'

/**
 * Strict 24-hour `HH:mm` regex. Accepts `00:00` through `23:59` with
 * zero-padded hour and minute values.
 *
 * Exposed so the settings payload validator and the toast provider can share
 * the same shape without duplicating the pattern.
 */
export const QUIET_HOURS_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
