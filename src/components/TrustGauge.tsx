import './TrustGauge.css'

import { type TrustTier, TIER_THRESHOLDS } from '../lib/tier'

export interface TrustGaugeProps {
  /** Current trust score (0-1000) */
  score: number
  /** Current tier */
  tier: TrustTier
  /** Custom className for wrapper */
  className?: string
  /** Optional ID for accessibility */
  id?: string
}

/**
 * Tier thresholds and configuration
 * These define the score ranges for each tier using the canonical limits
 */
export const TIER_CONFIG = {
  bronze: {
    min: TIER_THRESHOLDS.bronze.min,
    max: TIER_THRESHOLDS.bronze.max,
    color: 'var(--credence-color-bronze-border)',
    surfaceColor: 'var(--credence-color-bronze-surface)',
    textColor: 'var(--credence-color-bronze-text)',
    label: 'Bronze',
  },
  silver: {
    min: TIER_THRESHOLDS.silver.min,
    max: TIER_THRESHOLDS.silver.max,
    color: 'var(--credence-color-silver-border)',
    surfaceColor: 'var(--credence-color-silver-surface)',
    textColor: 'var(--credence-color-silver-text)',
    label: 'Silver',
  },
  gold: {
    min: TIER_THRESHOLDS.gold.min,
    max: TIER_THRESHOLDS.gold.max,
    color: 'var(--credence-color-gold-border)',
    surfaceColor: 'var(--credence-color-gold-surface)',
    textColor: 'var(--credence-color-gold-text)',
    label: 'Gold',
  },
  platinum: {
    min: TIER_THRESHOLDS.platinum.min,
    max: 1000, // Visual maximum for the gauge progress
    color: 'var(--credence-color-platinum-border)',
    surfaceColor: 'var(--credence-color-platinum-surface)',
    textColor: 'var(--credence-color-platinum-text)',
    label: 'Platinum',
  },
} as const

/** Maximum possible score */
const MAX_SCORE = 1000

/** Tier order for progression */
export const TIER_ORDER: readonly TrustTier[] = ['bronze', 'silver', 'gold', 'platinum']

type TierMarker = {
  id: TrustTier
  markerPercentage: number
  title: string
}

type TierLegendItem = {
  id: TrustTier
  label: string
  min: number
  max: number
  color: string
}

/** Precomputed tier metadata used by render paths that do not need per-render work. */
export const TIER_MARKERS: readonly TierMarker[] = TIER_ORDER.map((id) => ({
  id,
  markerPercentage: (TIER_CONFIG[id].min / MAX_SCORE) * 100,
  title: `${TIER_CONFIG[id].label}: ${TIER_CONFIG[id].min}-${TIER_CONFIG[id].max} points`,
}))

export const TIER_LEGEND_ITEMS: readonly TierLegendItem[] = TIER_ORDER.map((id) => ({
  id,
  label: TIER_CONFIG[id].label,
  min: TIER_CONFIG[id].min,
  max: TIER_CONFIG[id].max,
  color: TIER_CONFIG[id].color,
}))

const NEXT_TIER_BY_TIER: Readonly<Record<TrustTier, TrustTier | null>> = {
  bronze: 'silver',
  silver: 'gold',
  gold: 'platinum',
  platinum: null,
}

/**
 * Calculate points remaining to reach the next tier
 * @param score Current score
 * @param tier Current tier
 * @returns Points needed to reach next tier (0 if at platinum)
 */
export function pointsToNextTier(score: number, tier: TrustTier): number {
  const nextTier = NEXT_TIER_BY_TIER[tier]
  if (!nextTier) {
    return 0
  }
  return Math.max(0, TIER_CONFIG[nextTier].min - score)
}

/**
 * Calculate percentage of fill for the gauge (0-100)
 * @param score Current score
 * @returns Percentage (0-100)
 */
export function getProgressPercentage(score: number): number {
  return Math.min((score / MAX_SCORE) * 100, 100)
}

export default function TrustGauge({
  score,
  tier,
  className = '',
  id = 'trust-gauge',
}: TrustGaugeProps) {
  const percentage = getProgressPercentage(score)
  const nextTier = NEXT_TIER_BY_TIER[tier]
  const nextTierPoints = pointsToNextTier(score, tier)
  const isAtMax = tier === 'platinum' && score >= TIER_CONFIG.platinum.max

  return (
    <div className={`trust-gauge ${className}`} id={id}>
      {/* Accessible heading and description */}
      <div className="trust-gauge__header">
        <h3 className="trust-gauge__title">Trust Score Gauge</h3>
        <p className="trust-gauge__description">
          Visual representation of your trust score across tier bands from Bronze to Platinum
        </p>
      </div>

      {/* Main gauge container */}
      <div
        className="trust-gauge__container"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={MAX_SCORE}
        aria-label={`Trust score: ${score} out of ${MAX_SCORE}, ${tier} tier`}
      >
        {/* Track background with tier divisions */}
        <div className="trust-gauge__track">
          {/* Tier threshold markers and fills */}
          <div
            className="trust-gauge__fill trust-gauge__fill--bronze"
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="trust-gauge__fill trust-gauge__fill--silver"
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="trust-gauge__fill trust-gauge__fill--gold"
            role="presentation"
            aria-hidden="true"
          />
          <div
            className="trust-gauge__fill trust-gauge__fill--platinum"
            role="presentation"
            aria-hidden="true"
          />

          {/* Progress indicator - shows actual current progress */}
          <div
            className="trust-gauge__progress"
            style={
              {
                '--progress-width': `${percentage}%`,
              } as React.CSSProperties & { '--progress-width': string }
            }
            role="presentation"
            aria-hidden="true"
          />

          {/* Tier threshold markers */}
          <div className="trust-gauge__markers">
            {TIER_MARKERS.map((marker, index) => (
              <div
                key={marker.id}
                className={`trust-gauge__marker trust-gauge__marker--${marker.id}`}
                style={
                  {
                    '--marker-position': `${marker.markerPercentage}%`,
                  } as React.CSSProperties & { '--marker-position': string }
                }
                title={marker.title}
              >
                {/* Only show label for first marker on mobile, all on desktop */}
                {index === 0 && <span className="trust-gauge__marker-label">{marker.id}</span>}
              </div>
            ))}
          </div>

          {/* Current score indicator thumb */}
          <div
            className="trust-gauge__thumb"
            style={
              {
                '--thumb-position': `${percentage}%`,
              } as React.CSSProperties & { '--thumb-position': string }
            }
            role="presentation"
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Score and tier display */}
      <div className="trust-gauge__stats">
        <div className="trust-gauge__score-display">
          <span className="trust-gauge__score-value">{score}</span>
          <span className="trust-gauge__score-label">/ {MAX_SCORE}</span>
        </div>

        <div className="trust-gauge__tier-display">
          <span className="trust-gauge__tier-badge" data-tier={tier}>
            {TIER_CONFIG[tier].label}
          </span>
        </div>

        <div className="trust-gauge__progress-caption">
          {isAtMax ? (
            <span className="trust-gauge__maxed">Platinum tier — maximum score achieved</span>
          ) : nextTier ? (
            <span className="trust-gauge__next-tier">
              {nextTierPoints} points to {nextTier}
            </span>
          ) : (
            <span className="trust-gauge__next-tier">{nextTierPoints} points to next tier</span>
          )}
        </div>
      </div>

      {/* Tier legend/explanation */}
      <div className="trust-gauge__legend">
        <p className="trust-gauge__legend-title">Tier Ranges</p>
        <ul className="trust-gauge__legend-list">
          {TIER_LEGEND_ITEMS.map((item) => (
            <li key={item.id} className="trust-gauge__legend-item">
              <span
                className="trust-gauge__legend-dot"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="trust-gauge__legend-text">
                {item.label}: {item.min}–{item.max}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
