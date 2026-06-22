import { describe, it, expect } from 'vitest'
import { normalizeUSDC, formatUSDC, sanitizeUSDCInput } from './AmountInput'

// --- sanitizeUSDCInput ---
describe('sanitizeUSDCInput', () => {
  it('keeps valid decimal input unchanged', () => {
    expect(sanitizeUSDCInput('123.45')).toBe('123.45')
  })

  it('removes non-digit characters', () => {
    expect(sanitizeUSDCInput('abc123')).toBe('123')
    expect(sanitizeUSDCInput('$100.00')).toBe('100.00')
    expect(sanitizeUSDCInput('1,000.50')).toBe('1000.50')
  })

  it('truncates fraction to 2 decimals', () => {
    expect(sanitizeUSDCInput('12.345')).toBe('12.34')
    expect(sanitizeUSDCInput('0.567')).toBe('0.56')
  })

  it('removes leading zeros', () => {
    expect(sanitizeUSDCInput('00123')).toBe('123')
    expect(sanitizeUSDCInput('00')).toBe('0')
  })

  it('keeps leading zero for decimal values', () => {
    expect(sanitizeUSDCInput('0.5')).toBe('0.5')
  })

  it('handles multiple decimal points', () => {
    expect(sanitizeUSDCInput('12.34.56')).toBe('12.34')
  })

  it('handles empty string', () => {
    expect(sanitizeUSDCInput('')).toBe('')
  })

  it('handles single zero', () => {
    expect(sanitizeUSDCInput('0')).toBe('0')
  })
})

// --- formatUSDC ---
describe('formatUSDC', () => {
  it('adds thousands separators', () => {
    expect(formatUSDC('1234.56')).toBe('1,234.56')
    expect(formatUSDC('1234567.89')).toBe('1,234,567.89')
  })

  it('adds decimal places when missing', () => {
    expect(formatUSDC('100')).toBe('100.00')
    expect(formatUSDC('0.5')).toBe('0.50')
  })

  it('keeps already formatted values', () => {
    expect(formatUSDC('1,234.56')).toBe('1,234.56')
  })

  it('handles empty string', () => {
    expect(formatUSDC('')).toBe('')
  })

  it('returns invalid strings as-is', () => {
    expect(formatUSDC('abc')).toBe('abc')
  })
})

// --- normalizeUSDC ---
describe('normalizeUSDC', () => {
  it('rounds to 2 decimal places', () => {
    expect(normalizeUSDC('123.456')).toBe('123.46')
    expect(normalizeUSDC('123.4')).toBe('123.40')
  })

  it('removes commas', () => {
    expect(normalizeUSDC('1,234.56')).toBe('1234.56')
  })

  it('clamps negative values to 0', () => {
    expect(normalizeUSDC('-100')).toBe('0.00')
    expect(normalizeUSDC('-1.50')).toBe('0.00')
  })

  it('handles zero', () => {
    expect(normalizeUSDC('0')).toBe('0.00')
  })

  it('handles empty string', () => {
    expect(normalizeUSDC('')).toBe('')
  })

  it('returns empty string for invalid input', () => {
    expect(normalizeUSDC('abc')).toBe('')
  })

  it('handles large numbers', () => {
    expect(normalizeUSDC('999999.99')).toBe('999999.99')
  })
})
