import { useId, useState } from 'react'
import Badge, { type BadgeVariant } from './Badge'
import './TierLadder.css'

export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface TierDefinition {
  id: TierId
  label: string
  scoreMin: number
  scoreMax: number | null
  benefits: string[]
}

/** Protocol tier ladder — thresholds align with docs/tier-thresholds.md */
export const TIER_LADDER: TierDefinition[] = [
  {
    id: 'bronze',
    label: 'Bronze',
    scoreMin: 0,
    scoreMax: 249,
    benefits: [
      'Trust score visible in protocol lookups',
      'Eligible to create and maintain a standard bond',
      'Attestations count toward your base reputation',
    ],
  },
  {
    id: 'silver',
    label: 'Silver',
    scoreMin: 250,
    scoreMax: 499,
    benefits: [
      'Improved ranking in identity search results',
      'Extended grace period before bond status warnings',
      'Higher weight for verified peer attestations',
    ],
  },
  {
    id: 'gold',
    label: 'Gold',
    scoreMin: 500,
    scoreMax: 749,
    benefits: [
      'Priority consideration for attestation requests',
      'Reduced slashing sensitivity on first-time violations',
      'Access to advanced trust-score breakdown metrics',
    ],
  },
  {
    id: 'platinum',
    label: 'Platinum',
    scoreMin: 750,
    scoreMax: null,
    benefits: [
      'Maximum attestation and bond-duration weighting',
      'Eligible for validator and governance reputation signals',
      'Top-tier visibility across Credence trust surfaces',
    ],
  },
]

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
        <span className="tier-ladder__trigger-hint">
          Tier thresholds and benefits
        </span>
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

      <div
        id={panelId}
        className="tier-ladder__panel"
        hidden={!isOpen}
      >
        <p className="tier-ladder__intro">
          Your trust score (0–1000) is computed from bond amount, bond duration, and
          attestations. Tiers unlock as your score crosses each threshold at epoch
          settlement.
        </p>

        <ol className="tier-ladder__list">
          {TIER_LADDER.map((tier, index) => (
            <li
              key={tier.id}
              className={`tier-ladder__step tier-ladder__step--${tier.id}`}
            >
              <div className="tier-ladder__rail" aria-hidden="true">
                <span className="tier-ladder__marker">{index + 1}</span>
                {index < TIER_LADDER.length - 1 && <span className="tier-ladder__connector" />}
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
