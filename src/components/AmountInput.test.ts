import { describe, it, expect } from 'vitest'
import { sanitizeUSDCInput, formatUSDC, normalizeUSDC } from './AmountInput'

describe('sanitizeUSDCInput', () => {
  it('passes through a valid decimal string', () => {
    expect(sanitizeUSDCInput('123.45')).toBe('123.45')
  })

  it('strips non-numeric, non-dot characters', () => {
    expect(sanitizeUSDCInput('abc123')).toBe('123')
    expect(sanitizeUSDCInput('$100.00')).toBe('100.00')
    expect(sanitizeUSDCInput('1,000.50')).toBe('1000.50')
  })

  it('truncates fraction to 2 decimal places', () => {
    expect(sanitizeUSDCInput('12.345')).toBe('12.34')
  })

  it('removes leading zeros from whole part', () => {
    expect(sanitizeUSDCInput('00123')).toBe('123')
    expect(sanitizeUSDCInput('00')).toBe('0')
  })

  it('keeps leading zero before a decimal point', () => {
    expect(sanitizeUSDCInput('0.5')).toBe('0.5')
  })

// Export for manual testing in browser console
if (typeof window !== 'undefined') {
  (window as Window & { testAmountInput?: unknown }).testAmountInput = {
    sanitizeUSDCInput,
    formatUSDC,
    normalizeUSDC,
    runTests,
  }
  console.log('Test functions available as window.testAmountInput')
}
