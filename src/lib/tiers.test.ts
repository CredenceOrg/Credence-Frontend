import { describe, it, expect } from 'vitest'
import { TIERS, TIER_ORDER, MAX_SCORE } from './tiers'
import { TIER_THRESHOLDS, tierForScore } from './tier'
import { TIER_LADDER } from '../components/TierLadder'
import { pointsToNextTier } from '../components/TrustGauge'

describe('TIERS', () => {
  it('includes all four protocol tiers', () => {
    expect(TIER_ORDER).toEqual(['bronze', 'silver', 'gold', 'platinum'])
  })

  it('every TIER_ORDER entry has a corresponding TIERS record', () => {
    for (const id of TIER_ORDER) {
      expect(TIERS[id]).toBeDefined()
    }
  })

  it('boundaries match the canonical TIER_THRESHOLDS source', () => {
    for (const id of TIER_ORDER) {
      expect(TIERS[id].min).toBe(TIER_THRESHOLDS[id].min)
      expect(TIERS[id].max).toBe(TIER_THRESHOLDS[id].max)
    }
  })

  it('each tier has a non-empty label', () => {
    for (const id of TIER_ORDER) {
      expect(TIERS[id].label.length).toBeGreaterThan(0)
    }
  })

  it('each tier has exactly 3 benefits', () => {
    for (const id of TIER_ORDER) {
      expect(TIERS[id].benefits.length).toBe(3)
      for (const benefit of TIERS[id].benefits) {
        expect(typeof benefit).toBe('string')
        expect(benefit.length).toBeGreaterThan(0)
      }
    }
  })

  it('each tier has CSS variable references for color, surfaceColor, textColor', () => {
    for (const id of TIER_ORDER) {
      expect(TIERS[id].color).toMatch(/^var\(--credence-color-/)
      expect(TIERS[id].surfaceColor).toMatch(/^var\(--credence-color-/)
      expect(TIERS[id].textColor).toMatch(/^var\(--credence-color-/)
    }
  })

  it('tier ids are consistent with their record keys', () => {
    for (const id of TIER_ORDER) {
      expect(TIERS[id].id).toBe(id)
    }
  })

  it('tiers are ordered by ascending min score', () => {
    const mins = TIER_ORDER.map((id) => TIERS[id].min)
    for (let i = 1; i < mins.length; i++) {
      expect(mins[i]).toBeGreaterThan(mins[i - 1])
    }
  })
})

describe('tier boundaries (inclusive convention)', () => {
  it('bronze covers 0 through 249', () => {
    expect(tierForScore(0)).toBe('bronze')
    expect(tierForScore(249)).toBe('bronze')
    expect(tierForScore(249.9)).toBe('bronze')
  })

  it('silver starts at 250', () => {
    expect(tierForScore(250)).toBe('silver')
  })

  it('silver covers through 499', () => {
    expect(tierForScore(499)).toBe('silver')
    expect(tierForScore(499.9)).toBe('silver')
  })

  it('gold starts at 500', () => {
    expect(tierForScore(500)).toBe('gold')
  })

  it('gold covers through 749', () => {
    expect(tierForScore(749)).toBe('gold')
    expect(tierForScore(749.9)).toBe('gold')
  })

  it('platinum starts at 750 and is open-ended', () => {
    expect(tierForScore(750)).toBe('platinum')
    expect(tierForScore(1000)).toBe('platinum')
    expect(tierForScore(5000)).toBe('platinum')
  })

  it('TIERS reflects null max for platinum (open-ended)', () => {
    expect(TIERS.platinum.max).toBeNull()
  })
})

describe('boundary parity (TrustGauge and TierLadder agree)', () => {
  for (const id of TIER_ORDER) {
    it(`${id}: tierForScore boundary is consistent with TIERS.min/TIERS.max`, () => {
      const info = TIERS[id]
      if (info.min > 0) {
        expect(tierForScore(info.min - 1)).not.toBe(id)
      }
      expect(tierForScore(info.min)).toBe(id)
      if (info.max !== null) {
        expect(tierForScore(info.max)).toBe(id)
        expect(tierForScore(info.max + 1)).not.toBe(id)
      }
    })
  }

  it('TierLadder scoreMin/scoreMax match TIERS min/max for every tier', () => {
    for (const tier of TIER_LADDER) {
      const canonical = TIERS[tier.id as keyof typeof TIERS]
      expect(tier.scoreMin).toBe(canonical.min)
      expect(tier.scoreMax).toBe(canonical.max)
    }
  })

  it('TrustGauge pointsToNextTier aligns with TIERS boundaries', () => {
    expect(pointsToNextTier(249, 'bronze')).toBe(1)
    expect(pointsToNextTier(250, 'bronze')).toBe(0)
    expect(pointsToNextTier(499, 'silver')).toBe(1)
    expect(pointsToNextTier(500, 'silver')).toBe(0)
    expect(pointsToNextTier(749, 'gold')).toBe(1)
    expect(pointsToNextTier(750, 'gold')).toBe(0)
    expect(pointsToNextTier(750, 'platinum')).toBe(0)
  })
})

describe('MAX_SCORE', () => {
  it('is 1000', () => {
    expect(MAX_SCORE).toBe(1000)
  })
})
