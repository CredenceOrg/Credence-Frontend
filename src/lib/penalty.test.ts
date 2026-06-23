import { describe, it, expect } from 'vitest'
import { getPenaltyRate, computeWithdrawBreakdown } from './penalty'
import type { BondStatus, MockBond } from './penalty'

describe('getPenaltyRate', () => {
  it('returns 0 for active bonds', () => {
    expect(getPenaltyRate('active')).toBe(0)
  })

  it('returns 0.1 for grace-period bonds', () => {
    expect(getPenaltyRate('grace-period')).toBe(0.1)
  })

  it('returns 0.2 for locked bonds', () => {
    expect(getPenaltyRate('locked')).toBe(0.2)
  })
})

describe('computeWithdrawBreakdown', () => {
  const makeBond = (amountUsdc: number, status: BondStatus): MockBond => ({
    id: 1,
    amountUsdc,
    status,
  })

  it('computes zero-penalty breakdown for active bond', () => {
    const result = computeWithdrawBreakdown(makeBond(1000, 'active'))
    expect(result.penaltyUsdc).toBe(0)
    expect(result.penaltyPercent).toBe(0)
    expect(result.bondAmount).toBe('1,000 USDC')
    expect(result.penaltyAmount).toBe('0 USDC')
    expect(result.resultingBalance).toBe('1,000 USDC')
  })

  it('computes 10% penalty for grace-period bond', () => {
    const result = computeWithdrawBreakdown(makeBond(1000, 'grace-period'))
    expect(result.penaltyUsdc).toBe(100)
    expect(result.penaltyPercent).toBe(10)
    expect(result.bondAmount).toBe('1,000 USDC')
    expect(result.penaltyAmount).toBe('100 USDC')
    expect(result.resultingBalance).toBe('900 USDC')
  })

  it('computes 20% penalty for locked bond', () => {
    const result = computeWithdrawBreakdown(makeBond(1000, 'locked'))
    expect(result.penaltyUsdc).toBe(200)
    expect(result.penaltyPercent).toBe(20)
    expect(result.bondAmount).toBe('1,000 USDC')
    expect(result.penaltyAmount).toBe('200 USDC')
    expect(result.resultingBalance).toBe('800 USDC')
  })

  it('breakdown arithmetic: penalty + resulting = amount (grace-period)', () => {
    const bond = makeBond(2500, 'grace-period')
    const result = computeWithdrawBreakdown(bond)
    expect(result.penaltyUsdc + (bond.amountUsdc - result.penaltyUsdc)).toBe(bond.amountUsdc)
  })

  it('breakdown arithmetic: penalty + resulting = amount (locked)', () => {
    const bond = makeBond(750, 'locked')
    const result = computeWithdrawBreakdown(bond)
    expect(result.penaltyUsdc + (bond.amountUsdc - result.penaltyUsdc)).toBe(bond.amountUsdc)
  })

  it('handles fractional USDC amounts correctly', () => {
    const result = computeWithdrawBreakdown(makeBond(333.33, 'locked'))
    expect(result.penaltyUsdc).toBeCloseTo(66.666, 3)
    expect(result.penaltyPercent).toBe(20)
  })
})
