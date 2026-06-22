import { describe, it, expect } from 'vitest'
import {
  formatUsdc,
  normalizeUSDC,
  formatUSDC,
  formatUSDCDisplay,
  sanitizeUSDCInput,
} from './format'

describe('formatUsdc', () => {
  it('formats numeric USDC amounts with suffix', () => {
    expect(formatUsdc(1234.5)).toBe('1,234.5 USDC')
    expect(formatUsdc(0)).toBe('0 USDC')
    expect(formatUsdc(1e7)).toBe('10,000,000 USDC')
    expect(formatUsdc(1000.01)).toBe('1,000.01 USDC')
  })

  it('handles decimal precision correctly', () => {
    expect(formatUsdc(1234.567)).toBe('1,234.57 USDC')
    expect(formatUsdc(0.001)).toBe('0 USDC')
    expect(formatUsdc(0.01)).toBe('0.01 USDC')
  })

  it('pins the current display behavior for non-finite numeric inputs', () => {
    expect(formatUsdc(Number.NaN)).toBe('NaN USDC')
    expect(formatUsdc(Number.POSITIVE_INFINITY)).toBe('∞ USDC')
  })
})

describe('normalizeUSDC', () => {
  it('normalizes valid numeric strings to 2 decimal places', () => {
    expect(normalizeUSDC('100')).toBe('100.00')
    expect(normalizeUSDC('1,234.5')).toBe('1234.50')
    expect(normalizeUSDC('1234.567')).toBe('1234.57')
  })

  it('returns empty string for invalid input', () => {
    expect(normalizeUSDC('')).toBe('')
    expect(normalizeUSDC('not a number')).toBe('')
    expect(normalizeUSDC('abc123')).toBe('')
  })

  it('clamps negative values to 0', () => {
    expect(normalizeUSDC('-100')).toBe('0.00')
    expect(normalizeUSDC('-1.5')).toBe('0.00')
  })

  it('handles whitespace', () => {
    expect(normalizeUSDC(' 100 ')).toBe('100.00')
    expect(normalizeUSDC('   ')).toBe('')
  })

  it('handles large values', () => {
    expect(normalizeUSDC('1000000')).toBe('1000000.00')
    expect(normalizeUSDC('1,000,000')).toBe('1000000.00')
    expect(normalizeUSDC('1000000000')).toBe('1000000000.00')
  })

  it('handles empty values', () => {
    expect(normalizeUSDC('')).toBe('')
    expect(normalizeUSDC('0')).toBe('0.00')
  })

  it('rejects non-finite numeric strings', () => {
    expect(normalizeUSDC('Infinity')).toBe('')
    expect(normalizeUSDC('-Infinity')).toBe('')
    expect(normalizeUSDC('NaN')).toBe('')
  })
})

describe('formatUSDC', () => {
  it('formats display values with thousand separators', () => {
    expect(formatUSDC('1234.5')).toBe('1,234.50')
    expect(formatUSDC('1000')).toBe('1,000.00')
    expect(formatUSDC('1000000')).toBe('1,000,000.00')
  })

  it('returns invalid text unchanged for manual correction', () => {
    expect(formatUSDC('abc')).toBe('abc')
    expect(formatUSDC('123abc')).toBe('123abc')
  })

  it('handles empty strings', () => {
    expect(formatUSDC('')).toBe('')
    expect(formatUSDC('   ')).toBe('')
  })

  it('handles values with commas', () => {
    expect(formatUSDC('1,234.5')).toBe('1,234.50')
    expect(formatUSDC('1,000,000')).toBe('1,000,000.00')
  })

  it('handles various numeric cases', () => {
    expect(formatUSDC('0')).toBe('0.00')
    expect(formatUSDC('0.01')).toBe('0.01')
    expect(formatUSDC('1')).toBe('1.00')
    expect(formatUSDC('1000')).toBe('1,000.00')
    expect(formatUSDC('1000000')).toBe('1,000,000.00')
    expect(formatUSDC('1000000000')).toBe('1,000,000,000.00')
  })

  it('keeps non-finite and empty input available for manual correction', () => {
    expect(formatUSDC('Infinity')).toBe('Infinity')
    expect(formatUSDC('-Infinity')).toBe('-Infinity')
    expect(formatUSDC('NaN')).toBe('NaN')
    expect(formatUSDC('')).toBe('')
  })
})

describe('formatUSDCDisplay', () => {
  it('formats USDC amounts for UI display', () => {
    expect(formatUSDCDisplay('1234.5')).toBe('1,234.50')
    expect(formatUSDCDisplay('1000')).toBe('1,000.00')
    expect(formatUSDCDisplay('1000000')).toBe('1,000,000.00')
  })

  it('behaves identically to formatUSDC', () => {
    const testCases = ['1234.5', '1000', '0.01', '1000000', 'abc', '', 'Infinity', 'NaN']
    testCases.forEach((testCase) => {
      expect(formatUSDCDisplay(testCase)).toBe(formatUSDC(testCase))
    })
  })
})

describe('sanitizeUSDCInput', () => {
  it('passes through valid decimal strings', () => {
    expect(sanitizeUSDCInput('123.45')).toBe('123.45')
    expect(sanitizeUSDCInput('0.5')).toBe('0.5')
  })

  it('strips non-numeric, non-dot characters', () => {
    expect(sanitizeUSDCInput('abc123')).toBe('123')
    expect(sanitizeUSDCInput('$100.00')).toBe('100.00')
    expect(sanitizeUSDCInput('1,000.50')).toBe('1000.50')
    expect(sanitizeUSDCInput('USD 500.00')).toBe('500.00')
  })

  it('truncates fractions to two decimal places', () => {
    expect(sanitizeUSDCInput('12.345')).toBe('12.34')
    expect(sanitizeUSDCInput('99.999')).toBe('99.99')
    expect(sanitizeUSDCInput('0.123')).toBe('0.12')
  })

  it('normalizes leading zeroes while preserving decimal input', () => {
    expect(sanitizeUSDCInput('00123')).toBe('123')
    expect(sanitizeUSDCInput('00')).toBe('0')
    expect(sanitizeUSDCInput('0.5')).toBe('0.5')
    expect(sanitizeUSDCInput('000.50')).toBe('0.50')
  })

  it('handles currency symbols and commas', () => {
    expect(sanitizeUSDCInput('$1,000.50')).toBe('1000.50')
    expect(sanitizeUSDCInput('€500.00')).toBe('500.00')
    expect(sanitizeUSDCInput('£250.75')).toBe('250.75')
  })

  it('handles multiple decimals by using first one', () => {
    expect(sanitizeUSDCInput('12.34.56')).toBe('12.34')
    expect(sanitizeUSDCInput('100..00')).toBe('100.00')
  })

  it('preserves a trailing decimal while users are still typing', () => {
    expect(sanitizeUSDCInput('100.')).toBe('100.')
    expect(sanitizeUSDCInput('.50')).toBe('0.50')
  })

  it('handles negative values by stripping minus sign', () => {
    expect(sanitizeUSDCInput('-100')).toBe('100')
    expect(sanitizeUSDCInput('-50.25')).toBe('50.25')
  })

  it('handles empty and whitespace values', () => {
    expect(sanitizeUSDCInput('')).toBe('')
    expect(sanitizeUSDCInput('   ')).toBe('')
    expect(sanitizeUSDCInput(' 123 ')).toBe('123')
  })
})
