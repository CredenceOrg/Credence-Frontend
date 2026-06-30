import { describe, it, expect, vi } from 'vitest'
import {
  getPenaltyRateForDuration,
  computeBondSlashBreakdown,
  getPenaltyRate,
  computeWithdrawBreakdown,
  calcUnlockDate,
  type MockBond,
} from './bondPenalty'

// ---------------------------------------------------------------------------
// getPenaltyRateForDuration
// ---------------------------------------------------------------------------

describe('getPenaltyRateForDuration', () => {
  it('returns 0.20 for a 30-day lock', () => {
    expect(getPenaltyRateForDuration(30)).toBe(0.2)
  })

  it('returns 0.15 for a 90-day lock', () => {
    expect(getPenaltyRateForDuration(90)).toBe(0.15)
  })

  it('returns 0.10 for a 180-day lock', () => {
    expect(getPenaltyRateForDuration(180)).toBe(0.1)
  })

  it('falls back to 0.20 (most conservative) for an unknown duration', () => {
    // Unknown durations default to the highest penalty so estimates stay safe.
    expect(getPenaltyRateForDuration(0)).toBe(0.2)
    expect(getPenaltyRateForDuration(60)).toBe(0.2)
    expect(getPenaltyRateForDuration(365)).toBe(0.2)
    expect(getPenaltyRateForDuration(-1)).toBe(0.2)
    expect(getPenaltyRateForDuration(NaN)).toBe(0.2)
  })
})

// ---------------------------------------------------------------------------
// computeBondSlashBreakdown
// ---------------------------------------------------------------------------

describe('computeBondSlashBreakdown', () => {
  // ── 30-day: 20% penalty ──────────────────────────────────────────────────

  it('computes a 20% slash for a 30-day bond', () => {
    const result = computeBondSlashBreakdown(1000, 30)
    expect(result.penaltyPercent).toBe(20)
    expect(result.penaltyUsdc).toBeCloseTo(200, 5)
    expect(result.resultingUsdc).toBeCloseTo(800, 5)
    expect(result.bondAmount).toBe('1,000 USDC')
    expect(result.penaltyAmount).toBe('200 USDC')
    expect(result.resultingBalance).toBe('800 USDC')
  })

  // ── 90-day: 15% penalty ──────────────────────────────────────────────────

  it('computes a 15% slash for a 90-day bond', () => {
    const result = computeBondSlashBreakdown(1000, 90)
    expect(result.penaltyPercent).toBe(15)
    expect(result.penaltyUsdc).toBeCloseTo(150, 5)
    expect(result.resultingUsdc).toBeCloseTo(850, 5)
    expect(result.bondAmount).toBe('1,000 USDC')
    expect(result.penaltyAmount).toBe('150 USDC')
    expect(result.resultingBalance).toBe('850 USDC')
  })

  // ── 180-day: 10% penalty ─────────────────────────────────────────────────

  it('computes a 10% slash for a 180-day bond', () => {
    const result = computeBondSlashBreakdown(1000, 180)
    expect(result.penaltyPercent).toBe(10)
    expect(result.penaltyUsdc).toBeCloseTo(100, 5)
    expect(result.resultingUsdc).toBeCloseTo(900, 5)
    expect(result.bondAmount).toBe('1,000 USDC')
    expect(result.penaltyAmount).toBe('100 USDC')
    expect(result.resultingBalance).toBe('900 USDC')
  })

  // ── arithmetic invariant ─────────────────────────────────────────────────

  it('satisfies penalty + resulting = principal for all known durations', () => {
    const principal = 2500
    for (const days of [30, 90, 180] as const) {
      const r = computeBondSlashBreakdown(principal, days)
      expect(r.penaltyUsdc + r.resultingUsdc).toBeCloseTo(principal, 10)
    }
  })

  // ── zero amount ──────────────────────────────────────────────────────────

  it('handles a zero-USDC bond without NaN results', () => {
    const result = computeBondSlashBreakdown(0, 30)
    expect(result.penaltyUsdc).toBe(0)
    expect(result.resultingUsdc).toBe(0)
    expect(result.bondAmount).toBe('0 USDC')
    expect(result.penaltyAmount).toBe('0 USDC')
    expect(result.resultingBalance).toBe('0 USDC')
  })

  // ── large principal ───────────────────────────────────────────────────────

  it('handles a large bond amount (1 million USDC)', () => {
    const result = computeBondSlashBreakdown(1_000_000, 180)
    expect(result.penaltyPercent).toBe(10)
    expect(result.penaltyUsdc).toBeCloseTo(100_000, 5)
    expect(result.resultingUsdc).toBeCloseTo(900_000, 5)
    // Formatted strings should use thousands separators
    expect(result.bondAmount).toBe('1,000,000 USDC')
    expect(result.penaltyAmount).toBe('100,000 USDC')
    expect(result.resultingBalance).toBe('900,000 USDC')
  })

  // ── fractional USDC amounts ───────────────────────────────────────────────

  it('handles fractional USDC amounts (333.33 principal, 30-day)', () => {
    const result = computeBondSlashBreakdown(333.33, 30)
    expect(result.penaltyPercent).toBe(20)
    expect(result.penaltyUsdc).toBeCloseTo(66.666, 3)
    expect(result.resultingUsdc).toBeCloseTo(266.664, 3)
  })

  it('handles fractional USDC amounts (333.33 principal, 90-day)', () => {
    const result = computeBondSlashBreakdown(333.33, 90)
    expect(result.penaltyPercent).toBe(15)
    expect(result.penaltyUsdc).toBeCloseTo(49.9995, 3)
    expect(result.resultingUsdc).toBeCloseTo(283.3305, 3)
  })

  // ── unknown duration falls back to 20% ───────────────────────────────────

  it('uses the 20% fallback rate for an unknown duration', () => {
    const result = computeBondSlashBreakdown(1000, 60)
    expect(result.penaltyPercent).toBe(20)
    expect(result.penaltyUsdc).toBeCloseTo(200, 5)
    expect(result.resultingUsdc).toBeCloseTo(800, 5)
  })

  it('uses the 20% fallback rate for duration 0', () => {
    const result = computeBondSlashBreakdown(500, 0)
    expect(result.penaltyPercent).toBe(20)
    expect(result.penaltyUsdc).toBeCloseTo(100, 5)
  })

  // ── returned shape is complete ───────────────────────────────────────────

  it('returns all six required fields', () => {
    const result = computeBondSlashBreakdown(100, 30)
    expect(result).toHaveProperty('bondAmount')
    expect(result).toHaveProperty('penaltyPercent')
    expect(result).toHaveProperty('penaltyAmount')
    expect(result).toHaveProperty('resultingBalance')
    expect(result).toHaveProperty('penaltyUsdc')
    expect(result).toHaveProperty('resultingUsdc')
  })
})

// ---------------------------------------------------------------------------
// getPenaltyRate
// ---------------------------------------------------------------------------

describe('getPenaltyRate', () => {
  it('returns 0.2 for "locked" status', () => {
    expect(getPenaltyRate('locked')).toBe(0.2)
  })

  it('returns 0.1 for "grace-period" status', () => {
    expect(getPenaltyRate('grace-period')).toBe(0.1)
  })

  it('returns 0 for "active" status', () => {
    expect(getPenaltyRate('active')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeWithdrawBreakdown
// ---------------------------------------------------------------------------

describe('computeWithdrawBreakdown', () => {
  it('computes 20% penalty for locked status', () => {
    const bond: MockBond = { id: 1, amountUsdc: 1000, status: 'locked' }
    const result = computeWithdrawBreakdown(bond)
    expect(result.penaltyPercent).toBe(20)
    expect(result.penaltyUsdc).toBeCloseTo(200, 5)
    expect(result.resultingUsdc).toBeCloseTo(800, 5)
    expect(result.bondAmount).toBe('1,000 USDC')
    expect(result.penaltyAmount).toBe('200 USDC')
    expect(result.resultingBalance).toBe('800 USDC')
  })

  it('computes 10% penalty for grace-period status', () => {
    const bond: MockBond = { id: 1, amountUsdc: 500, status: 'grace-period' }
    const result = computeWithdrawBreakdown(bond)
    expect(result.penaltyPercent).toBe(10)
    expect(result.penaltyUsdc).toBeCloseTo(50, 5)
    expect(result.resultingUsdc).toBeCloseTo(450, 5)
    expect(result.bondAmount).toBe('500 USDC')
    expect(result.penaltyAmount).toBe('50 USDC')
    expect(result.resultingBalance).toBe('450 USDC')
  })

  it('computes 0% penalty for active status', () => {
    const bond: MockBond = { id: 1, amountUsdc: 750, status: 'active' }
    const result = computeWithdrawBreakdown(bond)
    expect(result.penaltyPercent).toBe(0)
    expect(result.penaltyUsdc).toBe(0)
    expect(result.resultingUsdc).toBe(750)
    expect(result.bondAmount).toBe('750 USDC')
    expect(result.penaltyAmount).toBe('0 USDC')
    expect(result.resultingBalance).toBe('750 USDC')
  })

  it('satisfies conservation invariant (penaltyUsdc + resultingUsdc === bond amount)', () => {
    const bond: MockBond = { id: 1, amountUsdc: 2500, status: 'locked' }
    const result = computeWithdrawBreakdown(bond)
    expect(result.penaltyUsdc + result.resultingUsdc).toBeCloseTo(bond.amountUsdc, 10)
  })

  it('handles zero-amount bond', () => {
    const bond: MockBond = { id: 1, amountUsdc: 0, status: 'locked' }
    const result = computeWithdrawBreakdown(bond)
    expect(result.penaltyUsdc).toBe(0)
    expect(result.resultingUsdc).toBe(0)
  })

  it('handles fractional USDC amounts', () => {
    const bond: MockBond = { id: 1, amountUsdc: 333.33, status: 'locked' }
    const result = computeWithdrawBreakdown(bond)
    expect(result.penaltyUsdc).toBeCloseTo(66.666, 3)
    expect(result.resultingUsdc).toBeCloseTo(266.664, 3)
  })

  it('handles very large amounts', () => {
    const bond: MockBond = { id: 1, amountUsdc: 1_000_000, status: 'grace-period' }
    const result = computeWithdrawBreakdown(bond)
    expect(result.bondAmount).toBe('1,000,000 USDC')
    expect(result.penaltyAmount).toBe('100,000 USDC')
    expect(result.resultingBalance).toBe('900,000 USDC')
  })
})

// ---------------------------------------------------------------------------
// calcUnlockDate
// ---------------------------------------------------------------------------

describe('calcUnlockDate', () => {
  it('calculates the correct unlock date', () => {
    const mockDate = new Date('2026-01-01T00:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)
    
    const date30 = calcUnlockDate(30)
    const date90 = calcUnlockDate(90)
    const date180 = calcUnlockDate(180)
    
    expect(date30).toMatch(/2026/)
    expect(date30).toMatch(/Jan|January/)
    expect(date90).toMatch(/2026/)
    expect(date90).toMatch(/Apr|April/)
    expect(date180).toMatch(/2026/)
    expect(date180).toMatch(/Jun|June/)
    
    vi.useRealTimers()
  })
})
