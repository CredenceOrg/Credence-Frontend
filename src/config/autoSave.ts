/**
 * Central constants for the Settings auto-save flow (closes #564).
 *
 * Imported by:
 *  - `src/hooks/useDebouncedAutoSave.ts` for debounce + lifecycle tuning
 *  - `src/components/indicators/AutoSaveIndicator.tsx` for the pill TTL
 *    and the relative-time refresh cadence
 *  - `src/pages/Settings.tsx` for the user-facing i18n label bundle
 *
 * Land new auto-save related constants here rather than scattered across
 * the components.
 */

export const AUTO_SAVE_DEFAULTS = {
  /**
   * How long (ms) `useDebouncedAutoSave` waits after the last value change
   * before firing the save fn. Tuned so rapid typing does not queue one
   * PATCH per keystroke.
   */
  DEBOUNCE_MS: 600,
  /**
   * How long the "Saved just now" pill stays visible after a successful
   * save before fading out. Long enough to read; short enough not to nag.
   *
   * Set to 6s (`6_000`) so the user can see the full progression
   * ("just now" → "Saved 5s ago") before the pill auto-hides. The internal
   * `formatRelative()` switches from "just now" to "Ns ago" at the 5s
   * boundary, so this constant MUST be greater than 5_000 for the
   * "Ns ago" branch to be observable without a per-call-site `ttlMs` override.
   */
  PILL_TTL_MS: 6_000,
  /**
   * How often the pill re-renders to refresh relative-time labels
   * (`Saved 5s ago` → `Saved 6s ago`). Capped at one tick per interval so
   * the form isn't re-rendered at the wall-clock rate.
   */
  PILL_REFRESH_MS: 30_000,
} as const

export type AutoSaveDefaults = typeof AUTO_SAVE_DEFAULTS
