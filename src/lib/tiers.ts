import { type TrustTier, TIER_THRESHOLDS, tierForScore } from './tier'

export type { TrustTier }
export { tierForScore }

export interface TierInfo {
  id: TrustTier
  label: string
  min: number
  max: number | null
  color: string
  surfaceColor: string
  textColor: string
  benefits: string[]
}

export const MAX_SCORE = 1000

export const TIERS: Record<TrustTier, TierInfo> = {
  bronze: {
    id: 'bronze',
    label: 'Bronze',
    min: TIER_THRESHOLDS.bronze.min,
    max: TIER_THRESHOLDS.bronze.max,
    color: 'var(--credence-color-bronze-border)',
    surfaceColor: 'var(--credence-color-bronze-surface)',
    textColor: 'var(--credence-color-bronze-text)',
    benefits: [
      'Trust score visible in protocol lookups',
      'Eligible to create and maintain a standard bond',
      'Attestations count toward your base reputation',
    ] as string[],
  },
  silver: {
    id: 'silver',
    label: 'Silver',
    min: TIER_THRESHOLDS.silver.min,
    max: TIER_THRESHOLDS.silver.max,
    color: 'var(--credence-color-silver-border)',
    surfaceColor: 'var(--credence-color-silver-surface)',
    textColor: 'var(--credence-color-silver-text)',
    benefits: [
      'Improved ranking in identity search results',
      'Extended grace period before bond status warnings',
      'Higher weight for verified peer attestations',
    ] as string[],
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    min: TIER_THRESHOLDS.gold.min,
    max: TIER_THRESHOLDS.gold.max,
    color: 'var(--credence-color-gold-border)',
    surfaceColor: 'var(--credence-color-gold-surface)',
    textColor: 'var(--credence-color-gold-text)',
    benefits: [
      'Priority consideration for attestation requests',
      'Reduced slashing sensitivity on first-time violations',
      'Access to advanced trust-score breakdown metrics',
    ] as string[],
  },
  platinum: {
    id: 'platinum',
    label: 'Platinum',
    min: TIER_THRESHOLDS.platinum.min,
    max: TIER_THRESHOLDS.platinum.max,
    color: 'var(--credence-color-platinum-border)',
    surfaceColor: 'var(--credence-color-platinum-surface)',
    textColor: 'var(--credence-color-platinum-text)',
    benefits: [
      'Maximum attestation and bond-duration weighting',
      'Eligible for validator and governance reputation signals',
      'Top-tier visibility across Credence trust surfaces',
    ] as string[],
  },
} as const

export const TIER_ORDER: TrustTier[] = ['bronze', 'silver', 'gold', 'platinum']

/** Runtime membership check for an untrusted tier value. */
export function isTrustTier(value: unknown): value is TrustTier {
  return typeof value === 'string' && (TIER_ORDER as string[]).includes(value)
}

/**
 * Clamp an untrusted score into the authoritative `[0, MAX_SCORE]` range.
 *
 * Non-finite values (NaN, ±Infinity) collapse to 0 rather than propagating
 * into arithmetic, so callers never render `NaN` and never throw.
 */
export function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0
  }
  return Math.min(Math.max(score, 0), MAX_SCORE)
}

/**
 * Derive the canonical tier from a score, tolerating invalid input.
 *
 * Unlike {@link tierForScore}, this first clamps the score to
 * `[0, MAX_SCORE]` so an out-of-range value cannot select a tier that the
 * gauge would never render.
 */
export function tierFromScore(score: number): TrustTier {
  return tierForScore(normalizeScore(score))
}

/**
 * Resolve a tier supplied by an untrusted payload.
 *
 * Known tiers are preserved (the API is authoritative for its own label),
 * while unknown / missing / malformed values fall back to the tier derived
 * from the score. The result is always a member of {@link TIER_ORDER}.
 */
export function resolveTier(tier: unknown, score: number): TrustTier {
  return isTrustTier(tier) ? tier : tierFromScore(score)
}

/** Human-readable description of where a score sits within its tier. */
export interface TierProgress {
  /** Normalised, always-valid tier. */
  tier: TrustTier
  /** Display label for the tier (e.g. `"Platinum"`). */
  label: string
  /** Label of the next tier, or `null` when there is no next tier. */
  nextLabel: string | null
  /**
   * Whole points needed to reach the next tier, or — for the final tier —
   * to reach {@link MAX_SCORE}. Always a finite, non-negative integer.
   */
  pointsRemaining: number
}

/**
 * Describe a score's progress without ever indexing past the tier list.
 *
 * Invariants:
 * - `tier` is always valid: unknown input falls back to {@link tierForScore}.
 * - The final tier (`platinum`) has `nextLabel === null`, so callers never
 *   compute a "next tier" for it. `pointsRemaining` instead measures the
 *   distance to {@link MAX_SCORE}.
 * - `pointsRemaining` is always a finite integer `>= 0`, even for `NaN`,
 *   negative, fractional, or overflow scores.
 * - The function is pure and deterministic.
 */
export function describeTierProgress(score: number, tier: unknown): TierProgress {
  const normalizedScore = normalizeScore(score)
  const resolvedTier = resolveTier(tier, normalizedScore)
  const tierIndex = TIER_ORDER.indexOf(resolvedTier)
  const nextTier = TIER_ORDER[tierIndex + 1]

  if (nextTier === undefined) {
    return {
      tier: resolvedTier,
      label: TIERS[resolvedTier].label,
      nextLabel: null,
      pointsRemaining: Math.max(0, Math.ceil(MAX_SCORE - normalizedScore)),
    }
  }

  return {
    tier: resolvedTier,
    label: TIERS[resolvedTier].label,
    nextLabel: TIERS[nextTier].label,
    pointsRemaining: Math.max(0, Math.ceil(TIERS[nextTier].min - normalizedScore)),
  }
}
