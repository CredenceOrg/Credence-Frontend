import { describe, expect, it } from 'vitest'
import { formatUSDC, normalizeUSDC, sanitizeUSDCInput } from '@/lib/format'

describe('AmountInput formatting helpers', () => {
  describe('sanitizeUSDCInput', () => {
    it('passes through a valid decimal string', () => {
      expect(sanitizeUSDCInput('123.45')).toBe('123.45')
    })

    it('strips non-numeric, non-dot characters', () => {
      expect(sanitizeUSDCInput('abc123')).toBe('123')
      expect(sanitizeUSDCInput('$100.00')).toBe('100.00')
      expect(sanitizeUSDCInput('1,000.50')).toBe('1000.50')
    })

    it('truncates fractions to two decimal places', () => {
      expect(sanitizeUSDCInput('12.345')).toBe('12.34')
    })

    it('normalizes leading zeroes while preserving decimal input', () => {
      expect(sanitizeUSDCInput('00123')).toBe('123')
      expect(sanitizeUSDCInput('00')).toBe('0')
      expect(sanitizeUSDCInput('0.5')).toBe('0.5')
    })
  })

  describe('normalizeUSDC', () => {
    it('returns fixed two-decimal values for finite amounts', () => {
      expect(normalizeUSDC('100')).toBe('100.00')
      expect(normalizeUSDC('1,234.5')).toBe('1234.50')
    })

    it('drops invalid or empty values', () => {
      expect(normalizeUSDC('')).toBe('')
      expect(normalizeUSDC('not a number')).toBe('')
    })
  })

  describe('formatUSDC', () => {
    it('formats display values with grouping and two decimals', () => {
      expect(formatUSDC('1234.5')).toBe('1,234.50')
    })

    it('returns invalid text unchanged for manual correction', () => {
      expect(formatUSDC('abc')).toBe('abc')
    })
  })

  it('keeps leading zero before a decimal point', () => {
    expect(sanitizeUSDCInput('0.5')).toBe('0.5')
  })
})

// Export for manual testing in browser console
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).testAmountInput = {
    sanitizeUSDCInput,
    formatUSDC,
    normalizeUSDC,
  }
  console.log('Test functions available as window.testAmountInput')
}
