import { describe, expect, it } from 'vitest'
import {
  BOND_AMOUNT_MAX_USDC,
  BOND_AMOUNT_MIN_USDC,
  TRUST_SCORE_ADDRESS_MAX_LENGTH,
  validateBondAmount,
  validateTrustScoreAddress,
} from './mutationGuard'

describe('mutationGuard', () => {
  describe('validateBondAmount', () => {
    it('accepts valid bond amounts within range', () => {
      const result = validateBondAmount(100)
      expect(result).toEqual({ ok: true, value: 100 })
    })

    it('accepts minimum bond amount', () => {
      const result = validateBondAmount(BOND_AMOUNT_MIN_USDC)
      expect(result).toEqual({ ok: true, value: BOND_AMOUNT_MIN_USDC })
    })

    it('accepts maximum bond amount', () => {
      const result = validateBondAmount(BOND_AMOUNT_MAX_USDC)
      expect(result).toEqual({ ok: true, value: BOND_AMOUNT_MAX_USDC })
    })

    it('accepts numeric strings and coerces them', () => {
      const result = validateBondAmount('500')
      expect(result).toEqual({ ok: true, value: 500 })
    })

    it('accepts decimal amounts', () => {
      const result = validateBondAmount(100.5)
      expect(result).toEqual({ ok: true, value: 100.5 })
    })

    it('rejects amounts below minimum', () => {
      const result = validateBondAmount(5)
      expect(result).toEqual({
        ok: false,
        message: `Bond amount must be at least ${BOND_AMOUNT_MIN_USDC} USDC.`,
      })
    })

    it('rejects amounts above maximum', () => {
      const result = validateBondAmount(2_000_000)
      expect(result).toEqual({
        ok: false,
        message: `Bond amount must not exceed ${BOND_AMOUNT_MAX_USDC} USDC.`,
      })
    })

    it('rejects Infinity', () => {
      const result = validateBondAmount(Infinity)
      expect(result).toEqual({
        ok: false,
        message: 'Bond amount must be a finite number.',
      })
    })

    it('rejects -Infinity', () => {
      const result = validateBondAmount(-Infinity)
      expect(result).toEqual({
        ok: false,
        message: 'Bond amount must be a finite number.',
      })
    })

    it('rejects NaN', () => {
      const result = validateBondAmount(NaN)
      expect(result).toEqual({
        ok: false,
        message: 'Bond amount must be a finite number.',
      })
    })

    it('rejects non-numeric strings', () => {
      const result = validateBondAmount('not-a-number')
      expect(result).toEqual({
        ok: false,
        message: 'Bond amount must be a valid number.',
      })
    })

    it('rejects null', () => {
      const result = validateBondAmount(null)
      expect(result.ok).toBe(false)
      expect(result.ok === false && result.message).toBeTruthy()
    })

    it('rejects undefined', () => {
      const result = validateBondAmount(undefined)
      expect(result).toEqual({
        ok: false,
        message: 'Bond amount must be a valid number.',
      })
    })

    it('rejects objects', () => {
      const result = validateBondAmount({})
      expect(result).toEqual({
        ok: false,
        message: 'Bond amount must be a valid number.',
      })
    })

    it('coerces single-element arrays to numbers', () => {
      // Number([100]) === 100, so this actually passes validation
      const result = validateBondAmount([100])
      expect(result).toEqual({ ok: true, value: 100 })
    })

    it('rejects negative amounts', () => {
      const result = validateBondAmount(-50)
      expect(result).toEqual({
        ok: false,
        message: `Bond amount must be at least ${BOND_AMOUNT_MIN_USDC} USDC.`,
      })
    })

    it('rejects zero', () => {
      const result = validateBondAmount(0)
      expect(result).toEqual({
        ok: false,
        message: `Bond amount must be at least ${BOND_AMOUNT_MIN_USDC} USDC.`,
      })
    })
  })

  describe('validateTrustScoreAddress', () => {
    it('accepts valid Stellar addresses', () => {
      const address = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ'
      const result = validateTrustScoreAddress(address)
      expect(result).toEqual({ ok: true, value: address })
    })

    it('accepts short addresses', () => {
      const result = validateTrustScoreAddress('GA...')
      expect(result).toEqual({ ok: true, value: 'GA...' })
    })

    it('trims whitespace from addresses', () => {
      const result = validateTrustScoreAddress('  GA...  ')
      expect(result).toEqual({ ok: true, value: 'GA...' })
    })

    it('accepts addresses at maximum length', () => {
      const longAddress = 'G'.repeat(TRUST_SCORE_ADDRESS_MAX_LENGTH)
      const result = validateTrustScoreAddress(longAddress)
      expect(result).toEqual({ ok: true, value: longAddress })
    })

    it('rejects empty strings', () => {
      const result = validateTrustScoreAddress('')
      expect(result).toEqual({
        ok: false,
        message: 'Trust score address must not be empty.',
      })
    })

    it('rejects whitespace-only strings', () => {
      const result = validateTrustScoreAddress('   ')
      expect(result).toEqual({
        ok: false,
        message: 'Trust score address must not be empty.',
      })
    })

    it('rejects addresses exceeding maximum length', () => {
      const tooLong = 'G'.repeat(TRUST_SCORE_ADDRESS_MAX_LENGTH + 1)
      const result = validateTrustScoreAddress(tooLong)
      expect(result).toEqual({
        ok: false,
        message: `Trust score address must not exceed ${TRUST_SCORE_ADDRESS_MAX_LENGTH} characters.`,
      })
    })

    it('rejects non-string values - number', () => {
      const result = validateTrustScoreAddress(12345)
      expect(result).toEqual({
        ok: false,
        message: 'Trust score address must be a string.',
      })
    })

    it('rejects non-string values - null', () => {
      const result = validateTrustScoreAddress(null)
      expect(result).toEqual({
        ok: false,
        message: 'Trust score address must be a string.',
      })
    })

    it('rejects non-string values - undefined', () => {
      const result = validateTrustScoreAddress(undefined)
      expect(result).toEqual({
        ok: false,
        message: 'Trust score address must be a string.',
      })
    })

    it('rejects non-string values - object', () => {
      const result = validateTrustScoreAddress({})
      expect(result).toEqual({
        ok: false,
        message: 'Trust score address must be a string.',
      })
    })

    it('rejects non-string values - array', () => {
      const result = validateTrustScoreAddress(['GA...'])
      expect(result).toEqual({
        ok: false,
        message: 'Trust score address must be a string.',
      })
    })

    it('rejects non-string values - boolean', () => {
      const result = validateTrustScoreAddress(true)
      expect(result).toEqual({
        ok: false,
        message: 'Trust score address must be a string.',
      })
    })
  })

  describe('constants', () => {
    it('defines sensible bond amount bounds', () => {
      expect(BOND_AMOUNT_MIN_USDC).toBe(10)
      expect(BOND_AMOUNT_MAX_USDC).toBe(1_000_000)
      expect(BOND_AMOUNT_MIN_USDC).toBeLessThan(BOND_AMOUNT_MAX_USDC)
    })

    it('defines sensible trust score address length bound', () => {
      expect(TRUST_SCORE_ADDRESS_MAX_LENGTH).toBe(128)
      expect(TRUST_SCORE_ADDRESS_MAX_LENGTH).toBeGreaterThan(56) // Stellar addresses are 56 chars
    })
  })
})
