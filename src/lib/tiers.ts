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
