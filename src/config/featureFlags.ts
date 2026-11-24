/**
 * Feature flag definitions and URL-param-based reader.
 *
 * Feature flags let the team ship incomplete / experimental UI behind a
 * URL-param gate so they can be reviewed, tested, and iterated on in the
 * deployed environment without affecting production users.
 *
 * ## Usage
 *
 *   // Check a single flag
 *   const flags = getFeatureFlags()
 *   if (flags.newDashboard) { ... }
 *
 *   // Enable flags via URL
 *   ?debug=1&newDashboard=1&betaChart=1
 *
 *   // The debug overlay (?debug=1) itself shows the current state of
 *   // every registered flag and lets you toggle them on the fly.
 */

export interface FeatureFlags {
  /** Enable the debug overlay itself. */
  readonly debug: boolean
  /** Toggle the new dashboard layout (example flag). */
  readonly newDashboard: boolean
  /** Toggle experimental chart components (example flag). */
  readonly betaChart: boolean
  /** Toggle alternative transaction list (example flag). */
  readonly newTransactionList: boolean
}

/** Default state — all flags off. */
const DEFAULTS: FeatureFlags = {
  debug: false,
  newDashboard: false,
  betaChart: false,
  newTransactionList: false,
}

/**
 * Read the current set of feature flags from `URLSearchParams`.
 *
 * Any flag whose URL param is `1` or `true` (case-insensitive) is active;
 * any other value (or absent param) leaves the flag at its default.
 *
 * Call this on every render you want to react to URL changes, or call it
 * once and cache the result when the app boots.
 */
export function getFeatureFlags(search: string = window.location.search): FeatureFlags {
  const params = new URLSearchParams(search)
  const flags = { ...DEFAULTS }

  for (const key of Object.keys(DEFAULTS) as Array<keyof FeatureFlags>) {
    const raw = params.get(key)
    if (raw !== null) {
      flags[key] = raw === '1' || raw.toLowerCase() === 'true'
    }
  }

  // debug is implicit when ANY flag is set via URL
  if (!flags.debug) {
    flags.debug = Object.values(flags).some(Boolean)
  }

  return flags
}

/**
 * Return a human-readable label for each flag (used in the debug overlay).
 */
export const FEATURE_FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  debug: 'Debug Overlay',
  newDashboard: 'New Dashboard Layout',
  betaChart: 'Beta Chart Components',
  newTransactionList: 'New Transaction List',
}