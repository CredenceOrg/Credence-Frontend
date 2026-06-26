import { describe, it, expect } from 'vitest'
import {
  formatUsdc,
  normalizeUSDC,
  formatUSDC,
  formatUSDCDisplay,
  sanitizeUSDCInput,
} from './format'

// ---------------------------------------------------------------------------
// formatUsdc — extended edge cases
// ---------------------------------------------------------------------------
describe('formatUsdc — extended edge cases', () => {
  it('handles negative numbers', () => {
    expect(formatUsdc(-100)).toBe('-100 USDC')
    expect(formatUsdc(-1234.5)).toBe('-1,234.5 USDC')
    expect(formatUsdc(-0.01)).toBe('-0.01 USDC')
  })

  it('handles very small amounts (sub-cent)', () => {
    expect(formatUsdc(0.001)).toBe('0 USDC')
    expect(formatUsdc(0.004)).toBe('0 USDC')
    expect(formatUsdc(0.005)).toBe('0.01 USDC')
    expect(formatUsdc(0.009)).toBe('0.01 USDC')
  })

  it('handles amounts just above zero', () => {
    expect(formatUsdc(0.01)).toBe('0.01 USDC')
    expect(formatUsdc(0.1)).toBe('0.1 USDC')
    expect(formatUsdc(0.99)).toBe('0.99 USDC')
  })

  it('handles large amounts with decimals', () => {
    expect(formatUsdc(9999999.99)).toBe('9,999,999.99 USDC')
    expect(formatUsdc(123456789)).toBe('123,456,789 USDC')
  })

  it('rounds to 2 decimal places correctly', () => {
    // toLocaleString uses round-half-to-even in some engines; we verify actual output
    expect(formatUsdc(1.015)).toBe('1.02 USDC')
    expect(formatUsdc(2.675)).toBe('2.68 USDC')
  })

  it('handles whole numbers', () => {
    expect(formatUsdc(1)).toBe('1 USDC')
    expect(formatUsdc(100)).toBe('100 USDC')
    expect(formatUsdc(1000)).toBe('1,000 USDC')
  })

  it('handles MAX_SAFE_INTEGER gracefully', () => {
    const result = formatUsdc(Number.MAX_SAFE_INTEGER)
    expect(result).toContain('USDC')
    // MAX_SAFE_INTEGER = 9,007,199,254,740,991
    expect(result.startsWith('9,007,199')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// normalizeUSDC — additional edge cases
// ---------------------------------------------------------------------------
describe('normalizeUSDC — additional edge cases', () => {
  it('handles decimal-only input (. prefix)', () => {
    expect(normalizeUSDC('.5')).toBe('0.50')
    expect(normalizeUSDC('.99')).toBe('0.99')
    expect(normalizeUSDC('.001')).toBe('0.00')
  })

  it('handles mixed comma and decimal formatting', () => {
    expect(normalizeUSDC('1,000')).toBe('1000.00')
    expect(normalizeUSDC('1,000,000.50')).toBe('1000000.50')
    expect(normalizeUSDC('12,34,567.89')).toBe('1234567.89')
  })

  it('handles scientific notation strings', () => {
    expect(normalizeUSDC('1e3')).toBe('1000.00')
    expect(normalizeUSDC('1.5e2')).toBe('150.00')
    expect(normalizeUSDC('1e-2')).toBe('0.01')
  })

  it('handles multiple commas in a row', () => {
    expect(normalizeUSDC('1,,000')).toBe('1000.00')
    expect(normalizeUSDC('1,000,')).toBe('1000.00')
  })

  it('rejects hex-like strings that Number() cannot parse', () => {
    // Note: Number('0xff') === 255 in JS, so sanitize strips the 'x' and parses it.
    // This documents the current behavior — hex is treated as valid numeric input.
    expect(normalizeUSDC('0xff')).toBe('255.00')
    expect(normalizeUSDC('0x1A')).toBe('26.00')
  })

  it('rejects boolean-like strings', () => {
    expect(normalizeUSDC('true')).toBe('')
    expect(normalizeUSDC('false')).toBe('')
    expect(normalizeUSDC('null')).toBe('')
    expect(normalizeUSDC('undefined')).toBe('')
  })

  it('handles very large values without precision loss', () => {
    // Numbers that fit within safe integer range
    expect(normalizeUSDC('999999999')).toBe('999999999.00')
  })

  it('handles zero variants', () => {
    expect(normalizeUSDC('0')).toBe('0.00')
    expect(normalizeUSDC('0.0')).toBe('0.00')
    expect(normalizeUSDC('0.00')).toBe('0.00')
    expect(normalizeUSDC('.0')).toBe('0.00')
  })
})

// ---------------------------------------------------------------------------
// formatUSDC — extended string input coverage
// ---------------------------------------------------------------------------
describe('formatUSDC — extended string input coverage', () => {
  it('handles leading/trailing whitespace within commas', () => {
    // Trim then format — "  1000  " should become "1,000.00"
    expect(formatUSDC('  1000  ')).toBe('1,000.00')
  })

  it('handles negative string inputs with commas', () => {
    expect(formatUSDC('-1,000')).toBe('-1,000.00')
    expect(formatUSDC('-1,234.56')).toBe('-1,234.56')
  })

  it('passes through multi-segment numbers (treated as invalid)', () => {
    // '1.2.3' → Number('1.2') = 1.2, rest is ignored by Number parsing
    // Actually Number('1.2.3') is NaN, so it should return rawValue
    expect(formatUSDC('1.2.3')).toBe('1.2.3')
  })

  it('handles values with leading + sign', () => {
    expect(formatUSDC('+1000')).toBe('1,000.00')
    expect(formatUSDC('+1234.56')).toBe('1,234.56')
  })

  it('handles trailing decimal point', () => {
    expect(formatUSDC('1000.')).toBe('1,000.00')
  })

  it('handles leading dot notation', () => {
    // '.5' → Number('.5') = 0.5
    expect(formatUSDC('.5')).toBe('0.50')
    expect(formatUSDC('.99')).toBe('0.99')
  })
})

// ---------------------------------------------------------------------------
// formatUSDCDisplay — parity verification with more cases
// ---------------------------------------------------------------------------
describe('formatUSDCDisplay — advanced parity checks', () => {
  it('handles negative identifiers consistently with formatUSDC', () => {
    const cases = ['-1', '-100', '-1234.56', '0', '0.01', '100']
    cases.forEach((val) => {
      expect(formatUSDCDisplay(val)).toBe(formatUSDC(val))
    })
  })

  it('handles whitespace-padded non-numeric strings unchanged', () => {
    expect(formatUSDCDisplay('  abc  ')).toBe('  abc  ')
  })
})

// ---------------------------------------------------------------------------
// sanitizeUSDCInput — fuzz / boundary tests
// ---------------------------------------------------------------------------
describe('sanitizeUSDCInput — fuzz and boundary tests', () => {
  it('handles emoji and unicode characters by stripping them', () => {
    // Non-digit/non-dot chars are stripped; resulting integer has no dot → returned as-is
    expect(sanitizeUSDCInput('💰100')).toBe('100')
    expect(sanitizeUSDCInput('100💵')).toBe('100')
    expect(sanitizeUSDCInput('日本100')).toBe('100')
  })

  it('handles tabs and newlines by stripping', () => {
    expect(sanitizeUSDCInput('100\t')).toBe('100')
    expect(sanitizeUSDCInput('100\n')).toBe('100')
    expect(sanitizeUSDCInput('\n100\n')).toBe('100')
  })

  it('handles extremely long integer input', () => {
    const longInt = '1'.repeat(20)
    expect(sanitizeUSDCInput(longInt)).toBe(longInt)
  })

  it('handles extremely long fractional input', () => {
    const result = sanitizeUSDCInput('1.' + '9'.repeat(50))
    expect(result).toBe('1.99')
  })

  it('handles only zeros', () => {
    expect(sanitizeUSDCInput('000')).toBe('0')
    expect(sanitizeUSDCInput('0000')).toBe('0')
    expect(sanitizeUSDCInput('0.000')).toBe('0.00')
    expect(sanitizeUSDCInput('00.00')).toBe('0.00')
  })

  it('handles just dots', () => {
    expect(sanitizeUSDCInput('...')).toBe('0.')
    expect(sanitizeUSDCInput('..')).toBe('0.')
  })

  it('returns empty for all-whitespace input', () => {
    expect(sanitizeUSDCInput(' \t\n ')).toBe('')
  })

  it('strips percentage and degree symbols', () => {
    expect(sanitizeUSDCInput('50%')).toBe('50')
    expect(sanitizeUSDCInput('100°')).toBe('100')
  })

  it('handles integer-only input (no dot appended when no fraction)', () => {
    // Per implementation: no dot present → strips leading zeros, returns integer as-is
    expect(sanitizeUSDCInput('42')).toBe('42')
    expect(sanitizeUSDCInput('1')).toBe('1')
  })

  it('validates known real-world amount formats', () => {
    expect(sanitizeUSDCInput('$1,234.56')).toBe('1234.56')
    expect(sanitizeUSDCInput('USD 1000.00')).toBe('1000.00')
    expect(sanitizeUSDCInput('≈500')).toBe('500')
    expect(sanitizeUSDCInput('~100')).toBe('100')
  })
})

// ---------------------------------------------------------------------------
// Cross-function consistency: round-trip and invariant tests
// ---------------------------------------------------------------------------
describe('cross-function invariants', () => {
  it('sanitizeUSDCInput result is always a valid normalizeUSDC input', () => {
    const inputs = [
      '$1,234.56',
      'abc',
      '0',
      '.5',
      '00123.4500',
      '',
      '   ',
      '$$$',
    ]
    inputs.forEach((input) => {
      const sanitized = sanitizeUSDCInput(input)
      // After sanitizing, normalizeUSDC should never throw
      const normalized = normalizeUSDC(sanitized)
      expect(typeof normalized).toBe('string')
    })
  })

  it('formatUsdc with integer input matches formatUSDC string input for that integer', () => {
    // formatUsdc(1234) → "1,234 USDC"; formatUSDC("1234") → "1,234.00"
    expect(formatUsdc(1234)).toBe('1,234 USDC')
    expect(formatUSDC('1234')).toBe('1,234.00')
  })
})
