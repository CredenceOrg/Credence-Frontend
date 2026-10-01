import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import TrustGauge, { pointsToNextTier, getProgressPercentage } from './TrustGauge'
import type { TrustTier } from '../lib/tier'
import { MAX_SCORE, TIERS } from '../lib/tiers'
import { useReducedMotion } from '../hooks/useReducedMotion'

// Default the reduced-motion hook to "no preference" so existing assertions
// (and any new ones that don't override it) keep behaving as before.
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn() => false,
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
    expect(getProgressPercentage(249)).toBloseTo(24.9)
  })

  it('returns 49.9 for score=499', () => {
    expect(getProgressPercentage(499)).toCloseTo(49.9)
  })

  // --- Failure-boundary coverage (#1170) -----------------------------------
  //
  // Legacy behavior pinned `getProgressPercentage(-100)` as -10 (no lower
  // clamp, callers were required to pre-normalize). That contract let a
  // corrupted score leak a NaN or negative width into the gauge's CSS custom
  // properties, so the function is now total: every numeric input is clamped
  // through `normalizeScore` into [0, 100]. The assertions below are the
  // regression suite for that migration path — the previous negative-output
  // behavior is intentionally NOT preserved (it was the failure mode).
  describe('failure boundaries', () => {
    it.each([
      ['NaN', NaN, 0],
      ['+Infinity (fails closed: non-finite never grants max trust)', Infinity, 0],
      ['-Infinity', -Infinity, 0],
      ['negative below minimum', -100, 0],
      ['negative-zero', -0, 0],
      ['overflow above maximum', 1000.5, 100],
    ] as const)('clamps %s to %i', (_label, input, expected) => {
      expect(getProgressPercentage(input)).toBe(expected)
    })

    it('maps the minimum and maximum inclusive boundaries to 0 and 100', () => {
      expect(getProgressPercentage(0)).toBe(0)
      expect(getProgressPercentage(MAX_SCORE)).toBe(100)
    })

    it('is deterministic: duplicate calls with the same input yield identical output', () => {
      const results = Array.from({ length: 5 }, () => getProgressPercentage(-100))
      expect(results).toEqual([0, 0, 0, 0, 0])
    })

    it('does not mutate global state across interleaved valid and invalid calls', () => {
      expect(getProgressPercentage(500)).toBe(50)
      expect(getProgressPercentage(NaN)).toBe(0)
      expect(getProgressPercentage(500)).toBe(50)
      expect(getProgressPercentage(Infinity)).toBe(0)
      expect(getProgressPercentage(-50)).toBe(0)
    })
  it('returns a negative value for negative score (no lower clamp)', () => {
    // getProgressPercentage only clamps at 100; callers must supply score >= 0
    expect(getProgressPercentage(-100)).toCloseTo(-10)
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

// --- Tier badge --/
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

// --- Score display --/
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

// --- id and className props --/
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

// --- Accessible heading --/
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

// --- Failure-boundary coverage for the component (#1170) ------------------
//
// The component is the authoritative failure boundary between raw,
// possibly-corrupted scores and the rendered gauge. These tests pin the
// invariants: invalid scores are deterministically clamped into the declared
// ARIA range, out-of-range inputs never emit audit commits, the parity marker
// stays honest, and a valid score after an invalid one recovers with no stale
// state and a monotonic audit sequence.
describe('TrustGauge failure boundaries', () => {
  const auditRoot = (container: HTMLElement) => container.firstElementChild as HTMLElement

  it('renders clamped values through aria-valuenow, score display, and progress width for invalid scores', () => {
    const invalidScores = [NaN, Infinity, -Infinity, -100] as const

    invalidScores.forEach((score) => {
      const { container, unmount } = render(<TrustGauge score={score} tier="bronze" />)

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow', '0')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '1000')
      expect(screen.getByText('0')).toBeInTheDocument()

      const progress = container.querySelector('.trust-gauge__progress') as HTMLElement | null
      expect(progress).not.toBeNull()
      expect(progress!.style.getPropertyValue('--progress-width')).toBe('0%')

      unmount()
    })
  })

  it('clamps overflow above the maximum to 1000 / 100%', () => {
    const { container } = render(<TrustGauge score={1001} tier="platinum" />)

    const progressbar = screen.getByRole('progressbar')
    expect(progressbar).toHaveAttribute('aria-valuenow', '1000')
    expect(progressbar).toHaveAttribute('aria-valuemax', '1000')

    const progress = container.querySelector('.trust-gauge__progress') as HTMLElement | null
    expect(progress!.style.getPropertyValue('--progress-width')).toBe('100%')
  })

  it('does not emit an audit commit for out-of-range scores and keeps parity honest', () => {
    const onCommit = vi.fn()
    const { container } = render(<TrustGauge score={-50} tier="bronze" onCommit={onCommit} />)

    // Untrusted scores must never enter the audit stream.
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')

    // Diagnostics remain truthful: the rendered root reports the committed
    // (clamped) score, never the raw invalid prop.
    expect(auditRoot(container)).toHaveAttribute('data-score', '0')
    expect(auditRoot(container)).toHaveAttribute('data-audit-parity', 'match')
  })

  it('recovers fully when a valid score follows an invalid one (no stale state)', () => {
    const onCommit = vi.fn()
    const { container, rerender } = render(
      <TrustGauge score={NaN} tier="bronze" onCommit={onCommit} />
    )

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(onCommit).not.toHaveBeenCalled()

    // Recovery: the clamped-invalid mount never seeds the audit baseline, so
    // the first valid score commits as the first authoritative observation —
    // with sequence 1 and NO previousScore/previousTier inheritance.
    rerender(<TrustGauge score={300} tier="silver" onCommit={onCommit} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '300')
    expect(screen.getByText('200 points to gold')).toBeInTheDocument()
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ score: 300, tier: 'silver', sequence: 1 })
    )
    const commit = onCommit.mock.calls[0][0] as {
      previousScore?: number
      previousTier?: TrustTier
    }
    expect(commit.previousScore).toBeUndefined()
    expect(commit.previousTier).toBeUndefined()
    expect(auditRoot(container)).toHaveAttribute('data-audit-parity', 'match')
  })

  it('does not commit the invalid interlude between two valid scores (dedupe stays anchored to the seeded baseline)', () => {
    const onCommit = vi.fn()
    const { rerender } = render(<TrustGauge score={100} tier="bronze" onCommit={onCommit} />)

    // Mount with a valid score seeds the audit baseline without committing.
    expect(onCommit).not.toHaveBeenCalled()

    // Invalid interlude: rendered output clamps to 0, and the audit stream
    // sees nothing.
    rerender(<TrustGauge score={Infinity} tier="bronze" onCommit={onCommit} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(onCommit).not.toHaveBeenCalled()

    // The next valid score returns to the seeded baseline values, which the
    // dedupe logic still holds — so no commit fires (already-observed state).
    rerender(<TrustGauge score={100} tier="bronze" onCommit={onCommit} />)
    expect(onCommit).not.toHaveBeenCalled()

    // A genuinely new valid state commits with a monotonic sequence.
    rerender(<TrustGauge score={400} tier="silver" onCommit={onCommit} />)
    expect(onCommit).toHaveBeenCalledTimes(1)
    const sequences = onCommit.mock.calls.map((call) => (call[0] as { sequence: number }).sequence)
    expect(sequences).toEqual([1])
  })

  it('is deterministic: identical invalid props always render identical output', () => {
    const results = [NaN, -100, Infinity, NaN, -100, Infinity].map((score) => {
      const { container, unmount } = render(<TrustGauge score={score} tier="bronze" />)
      const value = screen.getByRole('progressbar').getAttribute('aria-valuenow')
      const width = (
        container.querySelector('.trust-gauge__progress') as HTMLElement | null
      )?.style.getPropertyValue('--progress-width')
      unmount()
      return `${value}:${width}`
    })

    // Same input class -> identical rendered output, regardless of call order.
    expect(results[0]).toBe(results[3]) // NaN twice
    expect(results[1]).toBe(results[4]) // -100 twice
    expect(results[2]).toBe(results[5]) // Infinity twice
// --- Deterministic failure-boundary coverage ---
//
// The following tests pin down the exact behavior of `pointsToNextTier` at
// failure boundaries: NaN / Infinity / fractional scores, unknown tier labels,
// and any future regression that would let a non-finite or negative value
// escape. They are deterministic and do not depend on any external state.
describe('pointsToNextTier - failure boundaries', () => {
  it('returns 0 for NaN score (defensive clamp)', () => {
    expect(pointsToNextTier(NaN, 'bronze')).toBe(0)
  })

  it('returns 0 for +Infinity score', () => {
    expect(pointsToNextTier(Number.POSITIVE_INFINITY, 'bronze')).toBe(0)
  })

  it('returns 0 for -Infinity score', () => {
    expect(pointsToNextTier(Number.NEGATIVE_INFINITY, 'bronze')).toBe(0)
  })

  it('rounds fractional scores up to the next integer boundary', () => {
    // 249.5 -> ceil(250) - 249.5 = 0.5 -> ceil = 1
    expect(pointsToNextTier(249.5, 'bronze')).toBe(1)
    // 0.5 -> 250 - 0.5 = 249.5 -> ceil = 250
    expect(pointsToNextTier(0.5, 'bronze')).toBe(250)
  })

  it('returns 0 for an unknown tier label (defensive fallback)', () => {
    expect(pointsToNextTier(100, 'unknown' as TrustTier)).toBe(0)
  })

  it('returns 0 for an empty tier label (defensive fallback)', () => {
    expect(pointsToNextTier(100, '' as TrustTier)).toBe(0)
  })

  it('returns a non-negative integer for every tier at every boundary', () => {
    const tiers: TrustTier[] = ['bronze', 'silver', 'gold', 'platinum']
    const boundaries = [-1, 0, 249, 250, 251, 499, 500, 501, 749, 750, 751, 999, 1000, 1001]
    for (const tier of tiers) {
      for (const score of boundaries) {
        const result = pointsToNextTier(score, tier)
        expect(Number.isInteger(result)).toBe(true)
        expect(result).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('is pure and deterministic for repeated calls', () => {
    const first = pointsToNextTier(123, 'bronze')
    for (let i = 0; i < 100; i++) {
      expect(pointsToNextTier(123, 'bronze')).toBe(first)
    }
  })
})


describe('TrustGauge failure boundary states', () => {
  it('renders loading skeleton and aria-busy when isLoading is true', () => {
    const { container } = render(<TrustGauge score={500} tier="gold" isLoading={true} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(container.querySelector('.trust-gauge__loading-overlay')).toBeInTheDocument()
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true')
  })

  it('renders error banner and aria-invalid when error is present', () => {
    const errorMsg = 'Failed to fetch trust score'
    const { container } = render(<TrustGauge score={0} tier="bronze" error={new Error(errorMsg)} />)
    expect(screen.getByText(errorMsg)).toBeInTheDocument()
    expect(container.querySelector('.trust-gauge__error-banner')).toBeInTheDocument()
    expect(container.firstChild).toHaveAttribute('aria-invalid', 'true')
  })

  it('renders error banner with string error', () => {
    const errorMsg = 'Network Error'
    render(<TrustGauge score={0} tier="bronze" error={errorMsg} />)
    expect(screen.getByText(errorMsg)).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<TrustGauge score={0} tier="bronze" error="Error" onRetry={onRetry} />)
    const button = screen.getByRole('button', { name: /retry/i })
    button.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders stale banner when isStale is true', () => {
    const { container } = render(<TrustGauge score={500} tier="gold" isStale={true} />)
    expect(screen.getByText(/displaying offline or cached data/i)).toBeInTheDocument()
    expect(container.querySelector('.trust-gauge__stale-banner')).toBeInTheDocument()
  })

  it('hides gauge and shows permission denied message when isPermitted is false', () => {
    render(<TrustGauge score={500} tier="gold" isPermitted={false} />)
    expect(screen.getByText(/permission to view this trust score/i)).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

