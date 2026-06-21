import { describe, it, expect } from 'vitest'
import { tierForScore, TIER_THRESHOLDS } from './tier'

describe('tierForScore', () => {
  it('correctly assigns the Bronze tier', () => {
    expect(tierForScore(TIER_THRESHOLDS.bronze.min)).toBe('bronze')
    expect(tierForScore(TIER_THRESHOLDS.bronze.max)).toBe('bronze')
    expect(tierForScore(125)).toBe('bronze')
    
    // Floating point near boundary
    expect(tierForScore(249.9)).toBe('bronze')
  })

  it('correctly assigns the Silver tier', () => {
    expect(tierForScore(TIER_THRESHOLDS.silver.min)).toBe('silver')
    expect(tierForScore(TIER_THRESHOLDS.silver.max)).toBe('silver')
    expect(tierForScore(350)).toBe('silver')
    
    // Floating point near boundaries
    expect(tierForScore(250.1)).toBe('silver')
    expect(tierForScore(499.9)).toBe('silver')
  })

  it('correctly assigns the Gold tier', () => {
    expect(tierForScore(TIER_THRESHOLDS.gold.min)).toBe('gold')
    expect(tierForScore(TIER_THRESHOLDS.gold.max)).toBe('gold')
    expect(tierForScore(625)).toBe('gold')
    
    // Floating point near boundaries
    expect(tierForScore(500.1)).toBe('gold')
    expect(tierForScore(749.9)).toBe('gold')
  })

  it('correctly assigns the Platinum tier', () => {
    expect(tierForScore(TIER_THRESHOLDS.platinum.min)).toBe('platinum')
    expect(tierForScore(1000)).toBe('platinum')
    
    // Floating point near boundary
    expect(tierForScore(750.1)).toBe('platinum')
  })

  it('clamps out-of-bounds scores logically', () => {
    // Below 0 clamps to bronze
    expect(tierForScore(-1)).toBe('bronze')
    expect(tierForScore(-100)).toBe('bronze')

    // Above 1000 clamps to platinum (since platinum is unbounded upwards)
    expect(tierForScore(1001)).toBe('platinum')
    expect(tierForScore(5000)).toBe('platinum')
  })
})
