import { describe, expect, it } from 'vitest'
import { describeTierProgress } from './tiers'
import { normalizeTrustScore } from './trustScore'
import type { TrustTier } from './tier'

describe('describeTierProgress', () => {
  const cases: {
    name: string
    score: number
    tier: TrustTier | string
    expectedTier: TrustTier
    nextLabel: string | null
    pointsRemaining: number
  }[] = [
    {
      name: 'platinum below the maximum points at the maximum score',
      score: 840,
      tier: 'platinum',
      expectedTier: 'platinum',
      nextLabel: null,
      pointsRemaining: 160,
    },
    {
      name: 'platinum at the maximum has no points remaining',
      score: 1000,
      tier: 'platinum',
      expectedTier: 'platinum',
      nextLabel: null,
      pointsRemaining: 0,
    },
    {
      name: 'gold points at the next tier',
      score: 600,
      tier: 'gold',
      expectedTier: 'gold',
      nextLabel: 'Platinum',
      pointsRemaining: 150,
    },
    {
      name: 'unknown tiers are derived from the score',
      score: 100,
      tier: 'diamond',
      expectedTier: 'bronze',
      nextLabel: 'Silver',
      pointsRemaining: 150,
    },
  ]

  it.each(cases)('$name', ({ score, tier, expectedTier, nextLabel, pointsRemaining }) => {
    const progress = describeTierProgress(score, tier)

    expect(progress.tier).toBe(expectedTier)
    expect(progress.nextLabel).toBe(nextLabel)
    expect(progress.pointsRemaining).toBe(pointsRemaining)
  })

  it('never throws or returns a non-finite value for NaN input', () => {
    const progress = describeTierProgress(Number.NaN, 'gold')

    expect(Number.isInteger(progress.pointsRemaining)).toBe(true)
    expect(progress.pointsRemaining).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(progress.pointsRemaining)).toBe(true)
  })

  it('clamps out-of-range and fractional scores', () => {
    const negative = describeTierProgress(-50, 'gold')
    const overflow = describeTierProgress(5000, 'gold')
    const fractional = describeTierProgress(600.4, 'gold')

    expect(negative.pointsRemaining).toBe(750)
    expect(overflow.pointsRemaining).toBe(0)
    expect(fractional.pointsRemaining).toBe(150)
  })

  it('always returns a member of the tier union for unknown labels', () => {
    for (const tier of ['', 'diamond', 'PLATINUM', undefined, null, 42]) {
      const progress = describeTierProgress(500, tier)
      expect(['bronze', 'silver', 'gold', 'platinum']).toContain(progress.tier)
      expect(progress.label.length).toBeGreaterThan(0)
    }
  })
})

describe('normalizeTrustScore', () => {
  const base = {
    address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    score: 840,
    tier: 'platinum',
    attestations: 4,
    updatedAt: '2026-01-15T12:00:00Z',
  }

  it('normalises an unknown tier from the score', () => {
    const result = normalizeTrustScore({ ...base, score: 100, tier: 'diamond' })

    expect(result).not.toBeNull()
    expect(result?.score).toBe(100)
    expect(result?.tier).toBe('bronze')
  })

  it('clamps out-of-range scores and non-finite scores', () => {
    expect(normalizeTrustScore({ ...base, score: 5000 })?.score).toBe(1000)
    expect(normalizeTrustScore({ ...base, score: -10 })?.score).toBe(0)
    expect(normalizeTrustScore({ ...base, score: Number.NaN })?.score).toBe(0)
    expect(normalizeTrustScore({ ...base, score: Number.POSITIVE_INFINITY })?.score).toBe(0)
  })

  it('coerces attestations to a non-negative integer', () => {
    expect(normalizeTrustScore({ ...base, attestations: 3.9 })?.attestations).toBe(3)
    expect(normalizeTrustScore({ ...base, attestations: -2 })?.attestations).toBe(0)
    expect(normalizeTrustScore({ ...base, attestations: 'many' })?.attestations).toBe(0)
  })

  it('returns null for payloads without identity fields', () => {
    expect(normalizeTrustScore(null)).toBeNull()
    expect(normalizeTrustScore('nope')).toBeNull()
    expect(normalizeTrustScore([])).toBeNull()
    expect(normalizeTrustScore({ ...base, address: '' })).toBeNull()
    expect(normalizeTrustScore({ ...base, updatedAt: '' })).toBeNull()
  })
})
