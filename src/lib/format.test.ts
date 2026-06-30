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
    expect(sanitizeUSDCInput('1.23')).toBe('1.23')   // at limit — unchanged
    expect(sanitizeUSDCInput('1.2')).toBe('1.2')     // under limit — unchanged
    expect(sanitizeUSDCInput('1.230')).toBe('1.23')  // over limit — truncated
  })
})

// ---------------------------------------------------------------------------
// Rounding modes
// ---------------------------------------------------------------------------

describe('formatUsdc — rounding modes', () => {
  it('rounds down when the third decimal digit is less than 5', () => {
    expect(formatUsdc(1.234)).toBe('1.23 USDC')
    expect(formatUsdc(9.994)).toBe('9.99 USDC')
    expect(formatUsdc(0.004)).toBe('0 USDC')
  })

  it('rounds up when the third decimal digit is greater than 5', () => {
    expect(formatUsdc(1.236)).toBe('1.24 USDC')
    expect(formatUsdc(9.997)).toBe('10 USDC')
    expect(formatUsdc(0.006)).toBe('0.01 USDC')
  })

  it('rounds up across the whole-number boundary', () => {
    expect(formatUsdc(0.999)).toBe('1 USDC')
    expect(formatUsdc(1.999)).toBe('2 USDC')
    expect(formatUsdc(99.999)).toBe('100 USDC')
  })

  it('does not round values already at two decimal places', () => {
    expect(formatUsdc(1.23)).toBe('1.23 USDC')
    expect(formatUsdc(0.01)).toBe('0.01 USDC')
    expect(formatUsdc(100.99)).toBe('100.99 USDC')
  })
})

describe('normalizeUSDC — rounding modes (toFixed half-away-from-zero)', () => {
  it('rounds down when the third decimal digit is less than 5', () => {
    expect(normalizeUSDC('1.234')).toBe('1.23')
    expect(normalizeUSDC('9.994')).toBe('9.99')
    expect(normalizeUSDC('0.004')).toBe('0.00')
  })

  it('rounds up when the third decimal digit is greater than 5', () => {
    expect(normalizeUSDC('1.236')).toBe('1.24')
    expect(normalizeUSDC('0.006')).toBe('0.01')
    expect(normalizeUSDC('9.997')).toBe('10.00')
  })

  it('rounds up across the whole-number boundary', () => {
    expect(normalizeUSDC('0.999')).toBe('1.00')
    expect(normalizeUSDC('1.999')).toBe('2.00')
  })
})

describe('sanitizeUSDCInput — truncates (does not round) to two decimal places', () => {
  it('truncates third digit instead of rounding up', () => {
    expect(sanitizeUSDCInput('1.236')).toBe('1.23')
    expect(sanitizeUSDCInput('9.999')).toBe('9.99')
    expect(sanitizeUSDCInput('0.009')).toBe('0.00')
  })

  it('truncates third digit instead of rounding down', () => {
    expect(sanitizeUSDCInput('1.231')).toBe('1.23')
    expect(sanitizeUSDCInput('0.001')).toBe('0.00')
  })
})

// ---------------------------------------------------------------------------
// Trailing-zero stripping
// ---------------------------------------------------------------------------

describe('formatUsdc — strips trailing zeros (minimumFractionDigits not set)', () => {
  it('strips both trailing zeros for whole-number values', () => {
    expect(formatUsdc(1)).toBe('1 USDC')
    expect(formatUsdc(1000)).toBe('1,000 USDC')
    expect(formatUsdc(0)).toBe('0 USDC')
  })

  it('strips one trailing zero when only the hundredths digit is zero', () => {
    expect(formatUsdc(1.1)).toBe('1.1 USDC')
    expect(formatUsdc(1.5)).toBe('1.5 USDC')
    expect(formatUsdc(100.9)).toBe('100.9 USDC')
  })

  it('retains both decimal digits when neither is zero', () => {
    expect(formatUsdc(1.23)).toBe('1.23 USDC')
    expect(formatUsdc(0.01)).toBe('0.01 USDC')
    expect(formatUsdc(99.99)).toBe('99.99 USDC')
  })

  it('strips trailing zero produced by rounding', () => {
    // 1.999 rounds to 2 — both decimal digits become .00 and are stripped
    expect(formatUsdc(1.999)).toBe('2 USDC')
  })
})

describe('formatUSDC — always retains two decimal places (minimumFractionDigits: 2)', () => {
  it('appends .00 to whole-number strings', () => {
    expect(formatUSDC('1')).toBe('1.00')
    expect(formatUSDC('0')).toBe('0.00')
    expect(formatUSDC('1000')).toBe('1,000.00')
  })

  it('appends a trailing zero when only one decimal place is given', () => {
    expect(formatUSDC('1.5')).toBe('1.50')
    expect(formatUSDC('100.1')).toBe('100.10')
    expect(formatUSDC('0.1')).toBe('0.10')
  })

  it('does not alter strings that already have two decimal places', () => {
    expect(formatUSDC('1.23')).toBe('1.23')
    expect(formatUSDC('9.99')).toBe('9.99')
    expect(formatUSDC('0.01')).toBe('0.01')
  })
})

describe('formatUSDCDisplay — always retains two decimal places (same contract as formatUSDC)', () => {
  it('appends .00 to whole-number strings', () => {
    expect(formatUSDCDisplay('1')).toBe('1.00')
    expect(formatUSDCDisplay('0')).toBe('0.00')
    expect(formatUSDCDisplay('1000')).toBe('1,000.00')
  })

  it('appends a trailing zero when only one decimal place is given', () => {
    expect(formatUSDCDisplay('1.5')).toBe('1.50')
    expect(formatUSDCDisplay('0.1')).toBe('0.10')
  })
})

// ---------------------------------------------------------------------------
// Locale-specific thousand separators (en-US)
// ---------------------------------------------------------------------------

describe('formatUsdc — en-US comma thousand separators', () => {
  it('inserts a comma separator at every third digit from the right', () => {
    expect(formatUsdc(1_000)).toBe('1,000 USDC')
    expect(formatUsdc(10_000)).toBe('10,000 USDC')
    expect(formatUsdc(100_000)).toBe('100,000 USDC')
    expect(formatUsdc(1_000_000)).toBe('1,000,000 USDC')
  })

  it('places separators correctly for non-round values', () => {
    expect(formatUsdc(1_234_567.89)).toBe('1,234,567.89 USDC')
    expect(formatUsdc(9_999_999.99)).toBe('9,999,999.99 USDC')
  })

  it('does not insert a separator for values below 1000', () => {
    expect(formatUsdc(999)).toBe('999 USDC')
    expect(formatUsdc(100)).toBe('100 USDC')
    expect(formatUsdc(9.99)).toBe('9.99 USDC')
  })

  it('handles very large values with multiple separator groups', () => {
    expect(formatUsdc(1_234_567_890)).toBe('1,234,567,890 USDC')
  })
})

describe('formatUSDC — en-US comma thousand separators', () => {
  it('inserts a comma separator at every third digit from the right', () => {
    expect(formatUSDC('1000')).toBe('1,000.00')
    expect(formatUSDC('10000')).toBe('10,000.00')
    expect(formatUSDC('1000000')).toBe('1,000,000.00')
  })

  it('places separators correctly for non-round values', () => {
    expect(formatUSDC('1234567.89')).toBe('1,234,567.89')
    expect(formatUSDC('9999999.99')).toBe('9,999,999.99')
  })

  it('handles input that already contains thousand commas', () => {
    expect(formatUSDC('1,234,567.89')).toBe('1,234,567.89')
    expect(formatUSDC('1,000,000')).toBe('1,000,000.00')
  })

  it('does not insert a separator for values below 1000', () => {
    expect(formatUSDC('999')).toBe('999.00')
    expect(formatUSDC('100.50')).toBe('100.50')
  })
})

describe('normalizeUSDC — strips en-US thousand commas from input before normalizing', () => {
  it('removes a single thousands comma', () => {
    expect(normalizeUSDC('1,000')).toBe('1000.00')
    expect(normalizeUSDC('9,999')).toBe('9999.00')
  })

  it('removes multiple thousands commas', () => {
    expect(normalizeUSDC('1,000,000')).toBe('1000000.00')
    expect(normalizeUSDC('1,234,567.89')).toBe('1234567.89')
  })

  it('normalizes to two decimal places after stripping separators', () => {
    expect(normalizeUSDC('1,000.1')).toBe('1000.10')
    expect(normalizeUSDC('9,999,999')).toBe('9999999.00')
  })
})

// ---------------------------------------------------------------------------
// Property-style invariant tests (parametric / table-driven)
// ---------------------------------------------------------------------------

describe('property: formatUSDC output is always re-parseable as a finite number', () => {
  const validAmounts = ['0', '0.01', '0.99', '1', '100', '999', '1000', '1234.56', '999999.99', '1000000']

  it.each(validAmounts)(
    'formatUSDC("%s") produces a string whose numeric value matches the input',
    (input) => {
      const result = formatUSDC(input)
      const parsed = Number(result.replace(/,/g, ''))
      expect(Number.isFinite(parsed)).toBe(true)
      expect(parsed).toBeCloseTo(Number(input), 1)
    }
  )
})

describe('property: normalizeUSDC → formatUSDC round-trip preserves value', () => {
  const inputs = ['0', '1', '100', '1000', '1234.5', '9999.99', '1000000']

  it.each(inputs)(
    'formatUSDC(normalizeUSDC("%s")) produces a valid formatted string',
    (input) => {
      const normalized = normalizeUSDC(input)
      const formatted = formatUSDC(normalized)
      const parsed = Number(formatted.replace(/,/g, ''))
      expect(Number.isFinite(parsed)).toBe(true)
      expect(parsed).toBeCloseTo(Number(input), 1)
    }
  )
})

describe('property: formatUsdc output always ends with " USDC" for finite inputs', () => {
  const finiteAmounts = [0, 0.01, 1, 100, 1000, 1234.56, 1_000_000, 9_999_999.99]

  it.each(finiteAmounts)('formatUsdc(%s) ends with " USDC"', (amount) => {
    expect(formatUsdc(amount)).toMatch(/ USDC$/)
  })
})

describe('property: sanitizeUSDCInput output contains only digits, at most one dot, and at most two decimal digits', () => {
  const inputs = ['123', '1.5', '12.34', '1,000.50', '$100.99', '00123', '12.345', '1.2.3']

  it.each(inputs)('sanitizeUSDCInput("%s") matches the safe decimal pattern', (input) => {
    const result = sanitizeUSDCInput(input)
    if (result !== '') {
      expect(result).toMatch(/^\d+(\.\d{0,2})?$/)
    }
  })
})
