import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TrustGauge, { pointsToNextTier, getProgressPercentage } from './TrustGauge'
import type { TrustTier } from '../lib/tier'
import { TIERS } from '../lib/tiers'
import { useReducedMotion } from '../hooks/useReducedMotion'

// Default the reduced-motion hook to "no preference" so existing assertions
// (and any new ones that don't override it) keep behaving as before.
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

// --- pointsToNextTier ---
describe('pointsToNextTier', () => {
  it('returns 250 at score=0 in bronze', () => {
    expect(pointsToNextTier(0, 'bronze')).toBe(250)
  })

  it('returns 1 at score=249 in bronze (boundary below silver)', () => {
    expect(pointsToNextTier(249, 'bronze')).toBe(1)
  })

  it('returns 250 at score=250 in silver', () => {
    expect(pointsToNextTier(250, 'silver')).toBe(250)
  })

  it('returns 1 at score=499 in silver (boundary below gold)', () => {
    expect(pointsToNextTier(499, 'silver')).toBe(1)
  })

  it('returns 250 at score=500 in gold', () => {
    expect(pointsToNextTier(500, 'gold')).toBe(250)
  })

  it('returns 1 at score=749 in gold (boundary below platinum)', () => {
    expect(pointsToNextTier(749, 'gold')).toBe(1)
  })

  it('returns 0 at score=750 in platinum (already at top tier)', () => {
    expect(pointsToNextTier(750, 'platinum')).toBe(0)
  })

  it('returns 0 at score=1000 in platinum (max score)', () => {
    expect(pointsToNextTier(1000, 'platinum')).toBe(0)
  })

  it('never returns negative (score above tier threshold)', () => {
    expect(pointsToNextTier(300, 'bronze')).toBe(0)
  })

  it('handles negative score defensively (treats as below-zero offset)', () => {
    // score is below zero: points = silver.min (250) - (-50) = 300
    expect(pointsToNextTier(-50, 'bronze')).toBe(300)
  })

  it('handles tier mismatch where score already exceeds next-tier threshold', () => {
    // score=600 with tier='bronze': silver.min(250) - 600 < 0, clamped to 0
    expect(pointsToNextTier(600, 'bronze')).toBe(0)
  })
})

// --- getProgressPercentage ---
describe('getProgressPercentage', () => {
  it('returns 0 for score=0', () => {
    expect(getProgressPercentage(0)).toBe(0)
  })

  it('returns 25 for score=250', () => {
    expect(getProgressPercentage(250)).toBe(25)
  })

  it('returns 50 for score=500', () => {
    expect(getProgressPercentage(500)).toBe(50)
  })

  it('returns 75 for score=750', () => {
    expect(getProgressPercentage(750)).toBe(75)
  })

  it('returns 100 for score=1000', () => {
    expect(getProgressPercentage(1000)).toBe(100)
  })

  it('caps at 100 for score above 1000', () => {
    expect(getProgressPercentage(1001)).toBe(100)
    expect(getProgressPercentage(9999)).toBe(100)
  })

  it('returns 24.9 for score=249', () => {
    expect(getProgressPercentage(249)).toBeCloseTo(24.9)
  })

  it('returns 49.9 for score=499', () => {
    expect(getProgressPercentage(499)).toBeCloseTo(49.9)
  })

  it('returns a negative value for negative score (no lower clamp)', () => {
    // getProgressPercentage only clamps at 100; callers must supply score >= 0
    expect(getProgressPercentage(-100)).toBeCloseTo(-10)
  })
})

// --- ARIA attributes ---
describe('TrustGauge ARIA attributes', () => {
  it('sets aria-valuenow to the provided score', () => {
    render(<TrustGauge score={500} tier="gold" />)
    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '500')
  })

  it('sets aria-valuemin to 0', () => {
    render(<TrustGauge score={0} tier="bronze" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '0')
  })

  it('sets aria-valuemax to 1000', () => {
    render(<TrustGauge score={0} tier="bronze" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '1000')
  })

  it('aria-label reflects score and tier', () => {
    render(<TrustGauge score={300} tier="silver" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      'Trust score: 300 out of 1000, silver tier'
    )
  })
})

// --- Component rendering at boundary scores ---
describe('TrustGauge rendering at boundary scores', () => {
  const cases: { score: number; tier: TrustTier; expectedNext?: string }[] = [
    { score: 0, tier: 'bronze', expectedNext: '250 points to silver' },
    { score: 249, tier: 'bronze', expectedNext: '1 points to silver' },
    { score: 250, tier: 'silver', expectedNext: '250 points to gold' },
    { score: 499, tier: 'silver', expectedNext: '1 points to gold' },
    { score: 500, tier: 'gold', expectedNext: '250 points to platinum' },
    { score: 749, tier: 'gold', expectedNext: '1 points to platinum' },
  ]

  cases.forEach(({ score, tier, expectedNext }) => {
    it(`shows "${expectedNext}" for score=${score} tier=${tier}`, () => {
      render(<TrustGauge score={score} tier={tier} />)
      expect(screen.getByText(expectedNext!)).toBeInTheDocument()
    })
  })

  it('does not show max message at score=750 in platinum (isAtMax requires score>=1000)', () => {
    render(<TrustGauge score={750} tier="platinum" />)
    expect(screen.queryByText('Platinum tier — maximum score achieved')).not.toBeInTheDocument()
  })

  it('shows max message at score=1000 in platinum', () => {
    render(<TrustGauge score={1000} tier="platinum" />)
    expect(screen.getByText('Platinum tier — maximum score achieved')).toBeInTheDocument()
  })
})

// --- Tier badge ---
describe('TrustGauge tier badge', () => {
  const tiers: TrustTier[] = ['bronze', 'silver', 'gold', 'platinum']

  tiers.forEach((tier) => {
    it(`renders ${TIERS[tier].label} badge for tier=${tier}`, () => {
      const score = TIERS[tier].min
      render(<TrustGauge score={score} tier={tier} />)
      const badge = screen.getByText(TIERS[tier].label, { selector: '[data-tier]' })
      expect(badge).toHaveAttribute('data-tier', tier)
    })
  })
})

// --- Score display ---
describe('TrustGauge score display', () => {
  it('renders the numeric score value', () => {
    render(<TrustGauge score={375} tier="silver" />)
    expect(screen.getByText('375')).toBeInTheDocument()
  })

  it('renders the /1000 label', () => {
    render(<TrustGauge score={375} tier="silver" />)
    expect(screen.getByText('/ 1000')).toBeInTheDocument()
  })
})

// --- Tier legend ---
describe('TrustGauge tier legend', () => {
  it('renders all four tier range labels from canonical TIERS', () => {
    render(<TrustGauge score={0} tier="bronze" />)
    expect(screen.getByText(/Bronze: 0.?249/)).toBeInTheDocument()
    expect(screen.getByText(/Silver: 250.?499/)).toBeInTheDocument()
    expect(screen.getByText(/Gold: 500.?749/)).toBeInTheDocument()
    expect(screen.getByText(/Platinum: 750.?1000/)).toBeInTheDocument()
  })
})

// --- id and className props ---
describe('TrustGauge props', () => {
  it('applies the default id of trust-gauge', () => {
    const { container } = render(<TrustGauge score={0} tier="bronze" />)
    expect(container.querySelector('#trust-gauge')).toBeInTheDocument()
  })

  it('applies a custom id', () => {
    const { container } = render(<TrustGauge score={0} tier="bronze" id="my-gauge" />)
    expect(container.querySelector('#my-gauge')).toBeInTheDocument()
  })

  it('merges a custom className with trust-gauge', () => {
    const { container } = render(<TrustGauge score={0} tier="bronze" className="extra" />)
    const wrapper = container.firstElementChild
    expect(wrapper).toHaveClass('trust-gauge')
    expect(wrapper).toHaveClass('extra')
  })
})

// --- Accessible heading ---
describe('TrustGauge accessible heading', () => {
  it('renders the visible heading', () => {
    render(<TrustGauge score={0} tier="bronze" />)
    expect(screen.getByRole('heading', { name: 'Trust Score Gauge' })).toBeInTheDocument()
  })
})

// --- prefers-reduced-motion gating ---
//
// The TrustGauge applies JS-driven transitions to the progress fill and the
// current-score thumb (`transition: width ...` and `transition: left ...`).
// When the user prefers reduced motion, those transitions are overridden to
// `none` via an inline style so the gauge "snaps" to the new position rather
// than animating. The CSS @media rule in TrustGauge.css still hides the
// animation in older paths, but the JS override is the canonical signal for
// any future JS-driven animation logic.
describe('TrustGauge – prefers-reduced-motion gating', () => {
  afterEach(() => {
    // Reset the mocked hook between tests so the default (`false`) is restored
    // and assertions in earlier describe blocks that assume non-reduced motion
    // can not be polluted by a previous test that toggled it to `true`.
    vi.mocked(useReducedMotion).mockReset()
  })

  it('does not override the progress transition when reduce is off', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false)
    const { container } = render(<TrustGauge score={500} tier="gold" />)
    const progress = container.querySelector('.trust-gauge__progress') as HTMLElement | null
    expect(progress).not.toBeNull()
    // The inline style set should not contain a `transition:` declaration when
    // there is no reduce preference — the CSS file still drives the duration.
    expect(progress!.style.transition).toBe('')
  })

  it('overrides the progress transition to none when reduce is on', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    const { container } = render(<TrustGauge score={500} tier="gold" />)
    const progress = container.querySelector('.trust-gauge__progress') as HTMLElement | null
    expect(progress).not.toBeNull()
    expect(progress!.style.transition).toBe('none')
  })

  it('does not override the thumb transition when reduce is off', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false)
    const { container } = render(<TrustGauge score={500} tier="gold" />)
    const thumb = container.querySelector('.trust-gauge__thumb') as HTMLElement | null
    expect(thumb).not.toBeNull()
    expect(thumb!.style.transition).toBe('')
  })

  it('overrides the thumb transition to none when reduce is on', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    const { container } = render(<TrustGauge score={500} tier="gold" />)
    const thumb = container.querySelector('.trust-gauge__thumb') as HTMLElement | null
    expect(thumb).not.toBeNull()
    expect(thumb!.style.transition).toBe('none')
  })

  it('still renders correctly across all variants during reduced motion', () => {
    // Spot-check that the component renders fully (ARIA + scoring) regardless
    // of motion gating — gating is purely visual. Score=400, tier=silver
    // leaves 100 points to gold (500 - 400).
    vi.mocked(useReducedMotion).mockReturnValue(true)
    render(<TrustGauge score={400} tier="silver" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '400')
    expect(screen.getByText('400')).toBeInTheDocument()
    expect(screen.getByText('100 points to gold')).toBeInTheDocument()
  })
})
