import { describe, it, expect } from 'vitest'

function normalizeUSDC(rawValue: string) {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return ''

  const clamped = Math.max(0, numericValue)
  return clamped.toFixed(2)
}

function formatUSDC(rawValue: string) {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return rawValue

  const numberFormatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return numberFormatter.format(numericValue)
}

function sanitizeUSDCInput(nextValue: string) {
  const cleaned = nextValue.replace(/[^\d.]/g, '')
  const [whole = '', fraction = ''] = cleaned.split('.')
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '')
  const trimmedFraction = fraction.slice(0, 2)

  if (cleaned.includes('.')) return `${trimmedWhole || '0'}.${trimmedFraction}`
  return trimmedWhole
}

describe('AmountInput Utilities', () => {
  describe('sanitizeUSDCInput Tests', () => {
    const sanitizeTests = [
      { input: '123.45', expected: '123.45', description: 'Valid decimal' },
      { input: 'abc123', expected: '123', description: 'Letters removed' },
      { input: '12.345', expected: '12.34', description: 'Fraction truncated to 2 decimals' },
      { input: '00123', expected: '123', description: 'Leading zeros removed' },
      { input: '0.5', expected: '0.5', description: 'Leading zero kept for decimal' },
      { input: '12.34.56', expected: '12.34', description: 'Multiple decimals handled' },
      { input: '$100.00', expected: '100.00', description: 'Currency symbol removed' },
      { input: '1,000.50', expected: '1000.50', description: 'Comma removed' },
      { input: '', expected: '', description: 'Empty string' },
      { input: '0', expected: '0', description: 'Single zero' },
      { input: '00', expected: '0', description: 'Multiple zeros' },
    ]

    sanitizeTests.forEach(({ input, expected, description }) => {
      it(description, () => {
        expect(sanitizeUSDCInput(input)).toBe(expected)
      })
    })
  })

  describe('formatUSDC Tests', () => {
    const formatTests = [
      { input: '1234.56', expected: '1,234.56', description: 'Thousands separator' },
      { input: '100', expected: '100.00', description: 'Add decimal places' },
      { input: '1234567.89', expected: '1,234,567.89', description: 'Multiple thousands separators' },
      { input: '0.5', expected: '0.50', description: 'Single decimal to two decimals' },
      { input: '1,234.56', expected: '1,234.56', description: 'Already formatted' },
      { input: '', expected: '', description: 'Empty string' },
      { input: 'abc', expected: 'abc', description: 'Invalid string returned as-is' },
    ]

    formatTests.forEach(({ input, expected, description }) => {
      it(description, () => {
        expect(formatUSDC(input)).toBe(expected)
      })
    })
  })

  describe('normalizeUSDC Tests', () => {
    const normalizeTests = [
      { input: '123.456', expected: '123.46', description: 'Round to 2 decimals' },
      { input: '123.4', expected: '123.40', description: 'Pad to 2 decimals' },
      { input: '1,234.56', expected: '1234.56', description: 'Remove comma' },
      { input: '-100', expected: '0.00', description: 'Negative values clamped to 0' },
      { input: '0', expected: '0.00', description: 'Zero formatted' },
      { input: '', expected: '', description: 'Empty string' },
      { input: 'abc', expected: '', description: 'Invalid string returns empty' },
      { input: '999999.99', expected: '999999.99', description: 'Large number' },
    ]

    normalizeTests.forEach(({ input, expected, description }) => {
      it(description, () => {
        expect(normalizeUSDC(input)).toBe(expected)
      })
    })
  })
})
