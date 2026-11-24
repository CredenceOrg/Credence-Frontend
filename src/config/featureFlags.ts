/**
 * Feature flag definitions and URL-param-based reader.
 *
 * Feature flags let the team ship incomplete / experimental UI behind a
 * URL-param gate so they can be reviewed, tested, and iterated on in the
 * deployed environment without affecting production users.
 *
 * ## Usage
 *
 *   // Parse an explicit search string (pure; no browser globals)
 *   const flags = getFeatureFlags(location.search)
 *   if (flags.newDashboard) { ... }
 *
 *   // In components, prefer the shared context:
 *   const newDashboard = useFeatureFlag('newDashboard')
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

export type FeatureFlagName = keyof FeatureFlags

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
 * Pass the current router `location.search`; `FeatureFlagProvider` does this
 * once per search string so consumers stay in sync with client-side navigation.
 */
export function getFeatureFlags(search: string): FeatureFlags {
  const params = new URLSearchParams(search)
  const flags = { ...DEFAULTS }

  for (const key of Object.keys(DEFAULTS) as FeatureFlagName[]) {
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
export const FEATURE_FLAG_LABELS: Record<FeatureFlagName, string> = {
  debug: 'Debug Overlay',
  newDashboard: 'New Dashboard Layout',
  betaChart: 'Beta Chart Components',
  newTransactionList: 'New Transaction List',
}
