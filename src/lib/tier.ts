/**
 * Represents the four protocol trust tiers.
 */
export type TrustTier = 'bronze' | 'silver' | 'gold' | 'platinum'

/**
 * Single source of truth for tier thresholds aligned to docs/tier-thresholds.md.
 * Ranges are inclusive on both ends, except Platinum which has no upper cap (represented as null).
 */
export const TIER_THRESHOLDS = {
  bronze: { min: 0, max: 249 },
  silver: { min: 250, max: 499 },
  gold: { min: 500, max: 749 },
  platinum: { min: 750, max: null },
} as const

/**
 * Returns the correct trust tier for a given score.
 * Clamps negative scores to Bronze and scores > 1000 to Platinum.
 *
 * @param score - The protocol trust score (0-1000)
 * @returns The corresponding TrustTier
 */
export function tierForScore(score: number): TrustTier {
  if (score < TIER_THRESHOLDS.silver.min) {
    return 'bronze'
  }
  if (score < TIER_THRESHOLDS.gold.min) {
    return 'silver'
  }
  if (score < TIER_THRESHOLDS.platinum.min) {
    return 'gold'
  }
  return 'platinum'
}
