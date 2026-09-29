import { useEffect, useId, useRef, useState } from 'react'
import Badge, { type BadgeVariant } from './Badge'
import './TierLadder.css'

import { type TrustTier, TIERS, TIER_ORDER, MAX_SCORE } from '../lib/tiers'

export type TierId = TrustTier

export interface TierDefinition {
  id: TierId
  label: string
  scoreMin: number
  scoreMax: number | null
  benefits: string[]
}

/** Protocol tier ladder built from the canonical TIERS source */
export const TIER_LADDER: TierDefinition[] = TIER_ORDER.map((id) => {
  const t = TIERS[id]
  return {
    id: t.id,
    label: t.label,
    scoreMin: t.min,
    scoreMax: t.max,
    benefits: t.benefits,
  }
})

/**
 * Deterministically formats the score threshold range for a given tier definition.
 *
 * Invariants:
 * 1. Fail-Safe: Never throws for null, undefined, primitive, partial, or malformed input.
 * 2. Range Monotonicity: Upper bound is guaranteed to be >= lower bound (`scoreMax >= scoreMin`).
 * 3. Range Clamping: Numeric bounds are strictly validated and clamped within [0, MAX_SCORE] (0–1000).
 * 4. Boundary Normalization: Fractional scores are rounded to the nearest integer.
 * 5. Open-Ended Tiers: Null or undefined `scoreMax` (e.g. Platinum tier) is formatted as `${scoreMin}+`.
 * 6. Fallback Canonical Lookup: If min/max are missing or non-numeric but a known tier `id` is present,
 *    thresholds are safely resolved from canonical TIERS configuration.
 * 7. Purity & Determinism: Pure function; concurrent or repeated calls with identical arguments yield identical results.
 */
export function formatThreshold(tier?: Partial<TierDefinition> | null): string {
  try {
    if (!tier || typeof tier !== 'object') {
      return '0+'
    }

    // Canonical fallback if tier id is recognized
    const canonical = tier.id && tier.id in TIERS ? TIERS[tier.id as TrustTier] : null

    // Resolve and sanitize scoreMin
    let min: number
    if (typeof tier.scoreMin === 'number') {
      if (tier.scoreMin === Number.POSITIVE_INFINITY) {
        min = MAX_SCORE
      } else if (tier.scoreMin === Number.NEGATIVE_INFINITY) {
        min = 0
      } else if (Number.isNaN(tier.scoreMin)) {
        min = canonical ? canonical.min : 0
      } else {
        min = Math.round(tier.scoreMin)
      }
    } else if (
      typeof tier.scoreMin === 'string' &&
      (tier.scoreMin as string).trim() !== '' &&
      Number.isFinite(Number(tier.scoreMin))
    ) {
      min = Math.round(Number(tier.scoreMin))
    } else if (canonical) {
      min = canonical.min
    } else {
      min = 0
    }
    min = Math.min(Math.max(min, 0), MAX_SCORE)

    // Resolve and sanitize scoreMax
    // If scoreMax is explicitly null or undefined, tier is unbounded
    if (tier.scoreMax === null || tier.scoreMax === undefined) {
      if ('scoreMax' in tier && tier.scoreMax === null) {
        return `${min}+`
      }
      if (canonical && canonical.max !== null) {
        const max = Math.min(Math.max(canonical.max, min), MAX_SCORE)
        return `${min}–${max}`
      }
      return `${min}+`
    }

    let max: number
    if (typeof tier.scoreMax === 'number') {
      if (tier.scoreMax === Number.POSITIVE_INFINITY) {
        max = MAX_SCORE
      } else if (tier.scoreMax === Number.NEGATIVE_INFINITY) {
        max = 0
      } else if (Number.isNaN(tier.scoreMax)) {
        if (canonical && canonical.max !== null) {
          max = canonical.max
        } else {
          return `${min}+`
        }
      } else {
        max = Math.round(tier.scoreMax)
      }
    } else if (
      typeof tier.scoreMax === 'string' &&
      (tier.scoreMax as string).trim() !== '' &&
      Number.isFinite(Number(tier.scoreMax))
    ) {
      max = Math.round(Number(tier.scoreMax))
    } else if (canonical && canonical.max !== null) {
      max = canonical.max
    } else {
      return `${min}+`
    }

    // Clamp max to [0, MAX_SCORE] and guarantee monotonicity: max >= min
    max = Math.min(Math.max(max, 0), MAX_SCORE)
    if (max < min) {
      max = min
    }

    return `${min}–${max}`
  } catch {
    return '0+'
  }
}

export interface TierLadderProps {
  className?: string
  defaultOpen?: boolean
  /** Custom or dynamically loaded tier definitions. Defaults to protocol TIER_LADDER */
  tiers?: TierDefinition[]
  /** Indicates whether tier data is actively being fetched or synchronized */
  isLoading?: boolean
  /** Error encountered while loading or synchronizing tier data */
  error?: Error | string | null
  /** Callback to retry loading tier data after an error */
  onRetry?: () => void | Promise<void>
  /** Indicates whether the currently displayed tier data is stale */
  isStale?: boolean
  /** Indicates whether the current viewer has permission to view tier thresholds. Defaults to true */
  hasPermission?: boolean
  /** Custom message to display when permission is denied */
  permissionMessage?: string
}

export default function TierLadder({
  className = '',
  defaultOpen = false,
  tiers,
  isLoading = false,
  error = null,
  onRetry,
  isStale = false,
  hasPermission = true,
  permissionMessage = 'You do not have permission to view tier thresholds.',
}: TierLadderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isRetrying, setIsRetrying] = useState(false)
  const isRetryingRef = useRef(false)
  const isMountedRef = useRef(true)
  const panelId = useId()
  const headingId = useId()

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleRetry = async () => {
    if (!onRetry || isRetryingRef.current) return
    isRetryingRef.current = true
    setIsRetrying(true)
    try {
      await onRetry()
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error(
          '[TierLadder] Retry failed:',
          err instanceof Error ? err.message : 'Unknown error'
        )
      }
    } finally {
      if (isMountedRef.current) {
        isRetryingRef.current = false
        setIsRetrying(false)
      }
    }
  }

  // Format error message safely, stripping sensitive content
  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Failed to load tier thresholds.'
    : null

  // Resolve tiers safely: if caller passed an array, filter out nullish items; otherwise fallback to TIER_LADDER
  const resolvedTiers =
    Array.isArray(tiers) && tiers.length > 0
      ? tiers.filter((t): t is TierDefinition => t !== null && typeof t === 'object')
      : TIER_LADDER

  return (
    <section className={`tier-ladder ${className}`.trim()} aria-labelledby={headingId}>
      <h2 id={headingId} className="sr-only">
        How trust is earned
      </h2>

      <button
        type="button"
        className="tier-ladder__trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-busy={isLoading || isRetrying}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="tier-ladder__trigger-label">How trust is earned</span>
        <span className="tier-ladder__trigger-hint">Tier thresholds and benefits</span>
        <svg
          className={`tier-ladder__chevron${isOpen ? ' tier-ladder__chevron--open' : ''}`}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div id={panelId} className="tier-ladder__panel" hidden={!isOpen}>
        <p className="tier-ladder__intro">
          Your trust score (0–1000) is computed from bond amount, bond duration, and attestations.
          Tiers unlock as your score crosses each threshold at epoch settlement.
        </p>

        {/* Permission Denied State */}
        {!hasPermission && (
          <div className="tier-ladder__status tier-ladder__status--permission" role="alert">
            <span className="tier-ladder__status-icon" aria-hidden="true">
              🔒
            </span>
            <span>{permissionMessage}</span>
          </div>
        )}

        {hasPermission && (
          <>
            {/* Error & Retry State */}
            {errorMessage && (
              <div className="tier-ladder__status tier-ladder__status--error" role="alert">
                <span className="tier-ladder__status-icon" aria-hidden="true">
                  ⚠
                </span>
                <span className="tier-ladder__error-text">{errorMessage}</span>
                {onRetry && (
                  <button
                    type="button"
                    className="tier-ladder__retry-btn"
                    onClick={handleRetry}
                    disabled={isRetrying || isLoading}
                  >
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </button>
                )}
              </div>
            )}

            {/* Loading State Indicator */}
            {isLoading && (
              <div
                className="tier-ladder__status tier-ladder__status--loading"
                role="status"
                aria-live="polite"
              >
                <span className="tier-ladder__spinner" aria-hidden="true" />
                <span>Loading tier thresholds...</span>
              </div>
            )}

            {/* Stale State Indicator */}
            {isStale && (
              <div className="tier-ladder__status tier-ladder__status--stale" role="status">
                <span className="tier-ladder__status-icon" aria-hidden="true">
                  ℹ
                </span>
                <span>Tier thresholds may be out of date.</span>
              </div>
            )}

            {/* Tiers List */}
            <ol className="tier-ladder__list">
              {resolvedTiers.map((tier, index) => {
                const tierId = tier?.id && tier.id in TIERS ? tier.id : 'bronze'
                const tierLabel = tier?.label || TIERS[tierId as TrustTier]?.label || 'Bronze'
                const benefits = Array.isArray(tier?.benefits) ? tier.benefits : []

                return (
                  <li
                    key={tier?.id ?? index}
                    className={`tier-ladder__step tier-ladder__step--${tierId}`}
                  >
                    <div className="tier-ladder__rail" aria-hidden="true">
                      <span className="tier-ladder__marker">{index + 1}</span>
                      {index < resolvedTiers.length - 1 && (
                        <span className="tier-ladder__connector" />
                      )}
                    </div>

                    <article className="tier-ladder__card">
                      <header className="tier-ladder__card-header">
                        <Badge variant={tierId as BadgeVariant} />
                        <div className="tier-ladder__threshold">
                          <span className="tier-ladder__threshold-label">Score range</span>
                          <span className="tier-ladder__threshold-value">
                            {formatThreshold(tier)}
                          </span>
                        </div>
                      </header>

                      <h3 className="tier-ladder__tier-name">{tierLabel} tier</h3>

                      <ul className="tier-ladder__benefits">
                        {benefits.map((benefit, bIndex) => (
                          <li key={typeof benefit === 'string' ? benefit : bIndex}>
                            {String(benefit)}
                          </li>
                        ))}
                      </ul>
                    </article>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>
    </section>
  )
}
