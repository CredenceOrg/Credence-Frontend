// ==== Deterministic Failure‑Boundary Coverage for TierLadder ==== //
// This module now validates the integrity of the tier data at runtime and provides a
// deterministic fallback UI when invariants are violated. The public interface of
// the component (props) remains unchanged.

import { useId, useState, useMemo } from 'react'
import Badge, { type BadgeVariant } from './Badge'
import './TierLadder.css'

import { type TrustTier, TIERS, TIER_ORDER } from '../lib/tiers'

export type TierId = TrustTier

export interface TierDefinition {
  id: TierId
  label: string
  scoreMin: number
  scoreMax: number | null
  benefits: string[]
}

/**
 * Runtime validation error types for tier data.
 * `code` is stable for deterministic handling in tests and UI.
 */
export type TierValidationError = {
  code: 'DUPLICATE_ID' | 'MISSING_TIER' | 'INVALID_RANGE' | 'UNEXPECTED_NULL_MAX'
  message: string
}

/**
 * Validate the raw tier definitions derived from `TIERS` & `TIER_ORDER`.
 * Returns an array of errors – empty means the data is safe to use.
 */
function validateTierData(order: TrustTier[], tiers: Record<TrustTier, any>): TierValidationError[] {
  const errors: TierValidationError[] = []
  const seen = new Set<TrustTier>()

  for (const id of order) {
    // Ensure tier exists in source map
    const raw = tiers[id]
    if (!raw) {
      errors.push({
        code: 'MISSING_TIER',
        message: `Tier definition missing for id "${id}".`,
      })
      continue
    }
    // Duplicate detection
    if (seen.has(id)) {
      errors.push({
        code: 'DUPLICATE_ID',
        message: `Duplicate tier id "${id}" in TIER_ORDER.`,
      })
    }
    seen.add(id)

    // Validate numeric ranges
    const min = raw.min as number
    const max = raw.max as number | null
    if (typeof min !== 'number' || (max !== null && typeof max !== 'number')) {
      errors.push({
        code: 'INVALID_RANGE',
        message: `Tier "${id}" has non‑numeric score boundaries.`,
      })
    } else if (max !== null && min > max) {
      errors.push({
        code: 'INVALID_RANGE',
        message: `Tier "${id}" min (${min}) exceeds max (${max}).`,
      })
    } else if (max === null && min < 0) {
      // In our domain a null max means "or higher"; min should be non‑negative.
      errors.push({
        code: 'UNEXPECTED_NULL_MAX',
        message: `Tier "${id}" has null max with negative min (${min}).`,
      })
    }
  }
  return errors
}

/**
 * Build the deterministic ladder after successful validation.
 * The function is pure and safe to memoise.
 */
function buildTierLadder(order: TrustTier[], tiers: Record<TrustTier, any>): TierDefinition[] {
  return order.map((id) => {
    const t = tiers[id]
    return {
      id: t.id,
      label: t.label,
      scoreMin: t.min,
      scoreMax: t.max,
      benefits: t.benefits,
    }
  })
}

/** Deterministic status enum – used for UI rendering */
enum LadderStatus {
  VALID = 'valid',
  INVALID = 'invalid',
}

/** Hook that validates and returns the ladder together with status/error info. */
function useTierLadder() {
  // Validation is cheap and synchronous – memoise based on the source data.
  const validationErrors = useMemo(() => validateTierData(TIER_ORDER, TIERS), [])
  const status = validationErrors.length === 0 ? LadderStatus.VALID : LadderStatus.INVALID

  const ladder = useMemo(() => {
    if (status === LadderStatus.VALID) {
      return buildTierLadder(TIER_ORDER, TIERS)
    }
    // Return an empty array on error – UI will show a deterministic fallback.
    return [] as TierDefinition[]
  }, [status])

  return { status, validationErrors, ladder }
}

/** Helper to format thresholds – unchanged logic */
function formatThreshold(tier: TierDefinition): string {
  if (tier.scoreMax === null) {
    return `${tier.scoreMin}+`
  }
  return `${tier.scoreMin}–${tier.scoreMax}`
}

interface TierLadderProps {
  className?: string
  defaultOpen?: boolean
}

export default function TierLadder({ className = '', defaultOpen = false }: TierLadderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const panelId = useId()
  const headingId = useId()

  const { status, validationErrors, ladder } = useTierLadder()

  // Deterministic fallback UI when validation fails.
  if (status === LadderStatus.INVALID) {
    const error = validationErrors[0]
    return (
      <section className={`tier-ladder ${className}`.trim()} aria-labelledby={headingId}>
        <h2 id={headingId} className="sr-only">
          Tier ladder data error
        </h2>
        <div className="tier-ladder__error" role="alert">
          <strong>Configuration error:</strong> {error.message}
        </div>
      </section>
    )
  }

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
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div id={panelId} className="tier-ladder__panel" hidden={!isOpen}>
        <p className="tier-ladder__intro">
          Your trust score (0–1000) is computed from bond amount, bond duration, and attestations.
          Tiers unlock as your score crosses each threshold at epoch settlement.
        </p>

        <ol className="tier-ladder__list">
          {ladder.map((tier, index) => (
            <li key={tier.id} className={`tier-ladder__step tier-ladder__step--${tier.id}`}>
              <div className="tier-ladder__rail" aria-hidden="true">
                <span className="tier-ladder__marker">{index + 1}</span>
                {index < ladder.length - 1 && <span className="tier-ladder__connector" />}
              </div>

              <article className="tier-ladder__card">
                <header className="tier-ladder__card-header">
                  <Badge variant={tier.id as BadgeVariant} />
                  <div className="tier-ladder__threshold">
                    <span className="tier-ladder__threshold-label">Score range</span>
                    <span className="tier-ladder__threshold-value">{formatThreshold(tier)}</span>
                  </div>
                </header>

                <h3 className="tier-ladder__tier-name">{tier.label} tier</h3>

                <ul className="tier-ladder__benefits">
                  {tier.benefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
