import { describe, expect, it } from 'vitest'
import {
  BOND_AMOUNT_MAX_USDC,
  BOND_AMOUNT_MIN_USDC,
  TRUST_SCORE_ADDRESS_MAX_LENGTH,
  validateBondAmount,
  validateTrustScoreAddress,
} from '../mutationGuard'

describe('validateBondAmount (bounded input before expensive work)', () => {
  it('accepts the minimum boundary exactly', () => {
    expect(validateBondAmount(BOND_AMOUNT_MIN_USDC)).toEqual({
      ok: true,
      value: '10.00',
    })
  })

  it('accepts the maximum boundary exactly', () => {
    expect(validateBondAmount(BOND_AMOUNT_MAX_USDC)).toEqual({
      ok: true,
      value: '1000000.00',
    })
  })

  it('rejects a value just below the minimum', () => {
    const result = validateBondAmount(BOND_AMOUNT_MIN_USDC - 1)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/at least/)
  })

  it('rejects a value just above the maximum', () => {
    const result = validateBondAmount(BOND_AMOUNT_MAX_USDC + 1)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/must not exceed/)
  })

  it('rejects adversarial non-finite and out-of-range numbers', () => {
    expect(validateBondAmount(Infinity).ok).toBe(false)
    expect(validateBondAmount(-Infinity).ok).toBe(false)
    expect(validateBondAmount(NaN).ok).toBe(false)
    expect(validateBondAmount(Number.MAX_VALUE).ok).toBe(false)
    expect(validateBondAmount(Number.MIN_SAFE_INTEGER).ok).toBe(false)
  })

  it('rejects non-numeric and empty input', () => {
    expect(validateBondAmount('').ok).toBe(false)
    expect(validateBondAmount('abc').ok).toBe(false)
    expect(validateBondAmount(undefined).ok).toBe(false)
    expect(validateBondAmount(null).ok).toBe(false)
  })

  it('accepts a numeric string within range', () => {
    expect(validateBondAmount('500')).toEqual({ ok: true, value: '500.00' })
  })

  it('rejects fractional precision that cannot be represented exactly', () => {
    expect(validateBondAmount('10.001').ok).toBe(false)
    // The nearest JavaScript number has 17 fractional digits. It must be
    // rejected rather than rounded to a financially different value.
    expect(validateBondAmount(0.1 + 0.2).ok).toBe(false)
  })

  it('never passes through a non-bounded amount as ok', () => {
    // Property-style guard: any ok result is finite and within the closed bounds.
    const samples = [-1, 0, 9, 10, 500, 1_000_000, 1_000_001, 1e30]
    for (const s of samples) {
      const r = validateBondAmount(s)
      if (r.ok) {
        expect(r.value).toMatch(/^\d+\.\d{2}$/)
        expect(Number(r.value)).toBeGreaterThanOrEqual(BOND_AMOUNT_MIN_USDC)
        expect(Number(r.value)).toBeLessThanOrEqual(BOND_AMOUNT_MAX_USDC)
      }
    }
  })
})

describe('validateTrustScoreAddress (bounded lookup input)', () => {
  it('accepts a normal Stellar-style address', () => {
    expect(
      validateTrustScoreAddress('GBXVM3QP4H2W2AD6CJ7K2YKT3VHYZL6KXZPQZDIQDOHNNLQ4B7TQ6R2C')
    ).toEqual({
      ok: true,
      value: 'GBXVM3QP4H2W2AD6CJ7K2YKT3VHYZL6KXZPQZDIQDOHNNLQ4B7TQ6R2C',
    })
  })

  it('rejects empty and whitespace-only addresses', () => {
    expect(validateTrustScoreAddress('').ok).toBe(false)
    expect(validateTrustScoreAddress('   ').ok).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(validateTrustScoreAddress(undefined).ok).toBe(false)
    expect(validateTrustScoreAddress(null).ok).toBe(false)
    expect(validateTrustScoreAddress(123).ok).toBe(false)
  })

  it('rejects an adversarial over-long address', () => {
    const tooLong = 'A'.repeat(TRUST_SCORE_ADDRESS_MAX_LENGTH + 1)
    const result = validateTrustScoreAddress(tooLong)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/must not exceed/)
  })

  it('accepts the length boundary exactly', () => {
    const exact = 'A'.repeat(TRUST_SCORE_ADDRESS_MAX_LENGTH)
    expect(validateTrustScoreAddress(exact).ok).toBe(true)
  })
})
