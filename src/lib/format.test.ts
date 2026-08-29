import { describe, it, expect } from 'vitest'
import {
  formatUsdc,
  formatAmount,
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

  it('passes NaN and Infinity through toLocaleString (documents current behavior)', () => {
    // NOTE: formatUsdc does not guard against non-finite values;
    // toLocaleString('en-US') renders NaN as "NaN" and Infinity as "∞".
    // This test documents the current behavior — a future hardening PR
    // should return "0 USDC" or "" for these inputs instead.
    expect(formatUsdc(NaN)).toBe('NaN USDC')
    expect(formatUsdc(Infinity)).toBe('∞ USDC')
    expect(formatUsdc(-Infinity)).toBe('-∞ USDC')
  })

  it('documents negative-zero rendering (toLocaleString renders -0 as "-0")', () => {
    // BUG: toLocaleString('en-US') renders -0 as "-0", producing "-0 USDC".
    // Callers should ensure they never pass -0; a future hardening PR should
    // add a `|| 0` guard in formatUsdc to coerce -0 → 0 before formatting.
    expect(formatUsdc(-0)).toBe('-0 USDC')
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

  it('returns empty string for non-finite string representations', () => {
    // Number('Infinity') and Number('NaN') are non-finite → guarded by isFinite check.
    expect(normalizeUSDC('Infinity')).toBe('')
    expect(normalizeUSDC('-Infinity')).toBe('')
    expect(normalizeUSDC('NaN')).toBe('')
  })

  it('handles negative zero string edge case', () => {
    // '-0' parses to -0 which is finite; Math.max(0, -0) === 0.
    expect(normalizeUSDC('-0')).toBe('0.00')
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

  it('returns non-finite strings unchanged (invalid text path)', () => {
    // 'Infinity' → Number('Infinity') is not finite → returned unchanged.
    expect(formatUSDC('Infinity')).toBe('Infinity')
    expect(formatUSDC('NaN')).toBe('NaN')
  })

  it('handles negative values by formatting them (no clamping in formatUSDC)', () => {
    // formatUSDC does not clamp negatives; it just formats the number.
    expect(formatUSDC('-100')).toBe('-100.00')
    expect(formatUSDC('-1234.5')).toBe('-1,234.50')
  })
})

describe('formatUSDCDisplay', () => {
  it('formats USDC amounts for UI display', () => {
    expect(formatUSDCDisplay('1234.5')).toBe('1,234.50')
    expect(formatUSDCDisplay('1000')).toBe('1,000.00')
    expect(formatUSDCDisplay('1000000')).toBe('1,000,000.00')
  })

  it('behaves identically to formatUSDC', () => {
    const testCases = ['1234.5', '1000', '0.01', '1000000', 'abc', '']
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

  it('handles negative values by stripping minus sign', () => {
    expect(sanitizeUSDCInput('-100')).toBe('100')
    expect(sanitizeUSDCInput('-50.25')).toBe('50.25')
  })

  it('handles empty and whitespace values', () => {
    expect(sanitizeUSDCInput('')).toBe('')
    expect(sanitizeUSDCInput('   ')).toBe('')
    expect(sanitizeUSDCInput(' 123 ')).toBe('123')
  })

  it('handles a lone dot (no integer part)', () => {
    // Dot-only cleans to ".", dotIndex === 0, whole === "" → trimmedWhole → "0", fraction === ""
    expect(sanitizeUSDCInput('.')).toBe('0.')
  })

  it('handles input that is purely non-numeric', () => {
    expect(sanitizeUSDCInput('abc')).toBe('')
    expect(sanitizeUSDCInput('$€£')).toBe('')
  })

  it('truncates exactly 2 decimal places (boundary: exactly 2 digits)', () => {
    expect(sanitizeUSDCInput('1.23')).toBe('1.23') // at limit — unchanged
    expect(sanitizeUSDCInput('1.2')).toBe('1.2') // under limit — unchanged
    expect(sanitizeUSDCInput('1.230')).toBe('1.23') // over limit — truncated
  })
})

describe('formatAmount', () => {
  describe('valid finite amounts', () => {
    it('formats a standard positive amount with USDC suffix', () => {
      expect(formatAmount(1234.5)).toBe('1,234.5 USDC')
    })

    it('formats zero as "0 USDC"', () => {
      expect(formatAmount(0)).toBe('0 USDC')
    })

    it('formats a fractional amount with up to 2 decimal places', () => {
      expect(formatAmount(1234.567)).toBe('1,234.57 USDC')
    })

    it('formats amounts below 1 USDC', () => {
      expect(formatAmount(0.01)).toBe('0.01 USDC')
    })

    it('formats whole numbers without trailing decimals', () => {
      expect(formatAmount(100)).toBe('100 USDC')
    })

    it('formats large values with thousand separators', () => {
      expect(formatAmount(1e7)).toBe('10,000,000 USDC')
    })

    it('formats very large values with commas', () => {
      expect(formatAmount(1_000_000_000)).toBe('1,000,000,000 USDC')
    })
  })

  describe('minimum boundary values', () => {
    it('formats 0.001 as "0 USDC" (rounds down)', () => {
      expect(formatAmount(0.001)).toBe('0 USDC')
    })

    it('formats 0.005 as "0.01 USDC" (rounds up at half cent)', () => {
      expect(formatAmount(0.005)).toBe('0.01 USDC')
    })

    it('formats the smallest positive cent', () => {
      expect(formatAmount(0.009)).toBe('0.01 USDC')
    })
  })

  describe('near-overflow and MAX_SAFE_INTEGER', () => {
    it('formats Number.MAX_SAFE_INTEGER without precision loss', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER // 9007199254740991
      const result = formatAmount(maxSafe)
      expect(result).toBe('9,007,199,254,740,991 USDC')
    })

    it('clamps values exceeding MAX_SAFE_INTEGER to that boundary', () => {
      const result = formatAmount(Number.MAX_SAFE_INTEGER + 1)
      expect(result).toBe('9,007,199,254,740,991 USDC')
    })

    it('clamps extremely large values to MAX_SAFE_INTEGER', () => {
      const result = formatAmount(1e18)
      expect(result).toBe('9,007,199,254,740,991 USDC')
    })
  })

  describe('invalid and edge-case inputs', () => {
    it('returns "—" for undefined', () => {
      expect(formatAmount(undefined)).toBe('—')
    })

    it('returns "—" for null', () => {
      expect(formatAmount(null)).toBe('—')
    })

    it('returns "—" for NaN', () => {
      expect(formatAmount(NaN)).toBe('—')
    })

    it('returns "—" for positive Infinity', () => {
      expect(formatAmount(Infinity)).toBe('—')
    })

    it('returns "—" for negative Infinity', () => {
      expect(formatAmount(-Infinity)).toBe('—')
    })

    it('returns "—" for negative amounts', () => {
      expect(formatAmount(-1)).toBe('—')
    })

    it('normalizes -0 (negative zero) to "0 USDC"', () => {
      // -0 is finite and not < 0, so it is treated as a valid zero amount.
      // The || 0 in the implementation normalizes -0 → 0.
      expect(formatAmount(-0)).toBe('0 USDC')
    })

    it('returns "—" for very small negative values', () => {
      expect(formatAmount(-0.01)).toBe('—')
    })
  })

  describe('deterministic formatting', () => {
    it('produces consistent output for repeated calls', () => {
      const inputs = [0, 0.01, 100, 1234.56, 1e7, NaN, Infinity, null, undefined]
      for (const input of inputs) {
        const first = formatAmount(input as number)
        const second = formatAmount(input as number)
        expect(first).toBe(second)
      }
    })

    it('does not mutate the input number', () => {
      const value = 1234.56
      formatAmount(value)
      expect(value).toBe(1234.56)
    })
  })
})
