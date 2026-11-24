import { describe, expect, it } from 'vitest'
import {
  AmountError,
  compareAmounts,
  parseAmount,
  resolveAmountRules,
  tryParseAmount,
} from './amount'

/**
 * Independent oracle implementations.
 *
 * These deliberately re-derive the expected results with *different*
 * algorithms than `src/api/amount.ts` (pure string digit walking instead of
 * BigInt concatenation; char-loop grammar checking instead of regex) so the
 * property tests below prove the production rules against an independent
 * implementation rather than against themselves.
 */

/** Oracle grammar check: plain unsigned decimal, written as a char walk. */
function oracleGrammarAccepts(raw: string): boolean {
  const s = raw.trim()
  if (s.length === 0) return false
  let dots = 0
  let digitsBeforeDot = 0
  let digitsAfterDot = 0
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      if (dots === 0) digitsBeforeDot++
      else digitsAfterDot++
      continue
    }
    if (ch === '.') {
      dots++
      if (dots > 1) return false
      continue
    }
    return false
  }
  if (dots === 0) return digitsBeforeDot > 0
  return digitsBeforeDot > 0 && digitsAfterDot > 0
}

/** Oracle canonicalization: leading-zero strip + fraction pad, string-only. */
function oracleCanonical(decimal: string, scale: number): string {
  const [rawWhole, rawFrac = ''] = decimal.split('.')
  let whole = ''
  let seenNonZero = false
  for (const ch of rawWhole) {
    if (ch === '0' && !seenNonZero) continue
    seenNonZero = true
    whole += ch
  }
  if (whole === '') whole = '0'
  const fraction = (rawFrac + '0'.repeat(scale)).slice(0, scale)
  return scale === 0 ? whole : `${whole}.${fraction}`
}

/** Oracle scaled integer: BigInt(whole) * 10^scale + BigInt(frac). */
function oracleScaled(decimal: string, scale: number): bigint {
  const [whole, frac = ''] = decimal.split('.')
  return BigInt(whole || '0') * 10n ** BigInt(scale) + BigInt(frac.padEnd(scale, '0') || '0')
}

/** Oracle exponent expansion: char-array point shifting. */
function oracleExpandNumberString(str: string): string {
  if (!/[eE]/.test(str)) return str
  const [mantissa, expPart] = str.split(/[eE]/)
  const exponent = Number(expPart)
  const [intPart = '', fracPart = ''] = mantissa.split('.')
  const digits = [...intPart, ...fracPart]
  const point = intPart.length + exponent
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits.join('')}`
  if (point >= digits.length) return `${digits.join('')}${'0'.repeat(point - digits.length)}`
  return `${digits.slice(0, point).join('')}.${digits.slice(point).join('')}`
}

/** int64 bound used by the oracle, written as a literal (not imported). */
const ORACLE_MAX_SCALED = 9223372036854775807n

/** Deterministic seeded PRNG (mulberry32) so property tests never flake. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function expectAmountError(fn: () => unknown, code: string): AmountError {
  let thrown: unknown
  try {
    fn()
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(AmountError)
  const err = thrown as AmountError
  expect(err.code).toBe(code)
  expect(err.name).toBe('AmountError')
  expect(err.message).toBeTruthy()
  return err
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical serialization (normal conditions)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseAmount — canonical serialization', () => {
  it.each([
    ['1000', '1000.00'],
    ['1000.00', '1000.00'],
    ['1000.5', '1000.50'],
    ['1000.55', '1000.55'],
    ['007', '7.00'],
    ['000', '0.00'],
    ['0000.10', '0.10'],
    ['  100.5  ', '100.50'],
    ['\t12.34\n', '12.34'],
    ['0.1', '0.10'],
    ['0.01', '0.01'],
    ['1', '1.00'],
  ])('canonicalizes %p → %p', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it('accepts finite non-negative numbers via their shortest round-trip string', () => {
    expect(parseAmount(1000)).toBe('1000.00')
    expect(parseAmount(1000.5)).toBe('1000.50')
    expect(parseAmount(0.1)).toBe('0.10')
    expect(parseAmount(0)).toBe('0.00')
    // IEEE-754 negative zero compares equal to zero and String(-0) === '0'.
    expect(parseAmount(-0)).toBe('0.00')
  })

  it('accepts non-negative bigints directly', () => {
    expect(parseAmount(1000n)).toBe('1000.00')
    expect(parseAmount(0n)).toBe('0.00')
  })

  it('rejects excess precision instead of rounding or truncating', () => {
    // The UI helper normalizeUSDC would ROUND '1000.005' to '1000.01' via
    // toFixed(2); the boundary must reject it instead.
    expectAmountError(() => parseAmount('1000.005'), 'INVALID_SCALE')
    expectAmountError(() => parseAmount('1000.505'), 'INVALID_SCALE')
    expectAmountError(() => parseAmount(1000.005), 'INVALID_SCALE')
    // Trailing zeros still count as scale: '1.500' has 3 fractional digits.
    expectAmountError(() => parseAmount('1.500'), 'INVALID_SCALE')
  })

  it('is idempotent: canonicalizing a canonical amount is a no-op', () => {
    for (const value of ['0', '0.01', '7', '1000.5', '92233720368547758.07']) {
      const once = parseAmount(value)
      expect(parseAmount(once)).toBe(once)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Required boundary values: zero, minimum, maximum, near-overflow, fractional
// ─────────────────────────────────────────────────────────────────────────────

describe('parseAmount — boundary values', () => {
  it('accepts zero under default rules and rejects it under a positive minimum', () => {
    expect(parseAmount('0')).toBe('0.00')
    expect(parseAmount('0.00')).toBe('0.00')
    expect(parseAmount('0.0')).toBe('0.00')
    expect(parseAmount(0)).toBe('0.00')
    expect(parseAmount(0n)).toBe('0.00')

    expect(parseAmount('0.01', { min: '0.01' })).toBe('0.01')
    expectAmountError(() => parseAmount('0', { min: '0.01' }), 'BELOW_MIN')
    expectAmountError(() => parseAmount('0.00', { min: '0.01' }), 'BELOW_MIN')
  })

  it('enforces an inclusive custom minimum', () => {
    expect(parseAmount('5.00', { min: '5.00' })).toBe('5.00')
    expect(parseAmount('5.01', { min: '5.00' })).toBe('5.01')
    expectAmountError(() => parseAmount('4.99', { min: '5.00' }), 'BELOW_MIN')
  })

  it('accepts the exact int64 scaled-integer maximum at scale 2', () => {
    // 92233720368547758.07 × 100 = 9223372036854775807 = 2^63 - 1.
    expect(parseAmount('92233720368547758.07')).toBe('92233720368547758.07')
  })

  it('rejects near-overflow values just above the int64 bound', () => {
    expectAmountError(() => parseAmount('92233720368547758.08'), 'OVERFLOW')
    expectAmountError(() => parseAmount('92233720368547758.1'), 'OVERFLOW')
    expectAmountError(() => parseAmount('92233720368547759'), 'OVERFLOW')
    expectAmountError(() => parseAmount('9223372036854775808'), 'OVERFLOW') // 2^63
  })

  it('accepts near-overflow values just below the bound', () => {
    expect(parseAmount('92233720368547758.06')).toBe('92233720368547758.06')
    expect(parseAmount('92233720368547758')).toBe('92233720368547758.00')
    expect(parseAmount('92233720368547757.99')).toBe('92233720368547757.99')
  })

  it('enforces the int64 bound at scale 0 and scale 7 (Stellar precision)', () => {
    expect(parseAmount('9223372036854775807', { scale: 0 })).toBe('9223372036854775807')
    expectAmountError(() => parseAmount('9223372036854775808', { scale: 0 }), 'OVERFLOW')

    expect(parseAmount('922337203685.4775807', { scale: 7 })).toBe('922337203685.4775807')
    expectAmountError(() => parseAmount('922337203685.4775808', { scale: 7 }), 'OVERFLOW')
    expect(parseAmount('922337203685.4775806', { scale: 7 })).toBe('922337203685.4775806')
  })

  it('enforces an inclusive custom maximum', () => {
    expect(parseAmount('100', { max: '100' })).toBe('100.00')
    expectAmountError(() => parseAmount('100.01', { max: '100' }), 'OVERFLOW')
  })

  it('handles fractional values exactly at the scale boundary', () => {
    expect(parseAmount('0.01')).toBe('0.01')
    expect(parseAmount('0.99')).toBe('0.99')
    expectAmountError(() => parseAmount('0.001'), 'INVALID_SCALE')
    expectAmountError(() => parseAmount('0.999'), 'INVALID_SCALE')
    // Scale 0 rejects any fractional part.
    expect(parseAmount('5', { scale: 0 })).toBe('5')
    expectAmountError(() => parseAmount('5.0', { scale: 0 }), 'INVALID_SCALE')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Conversion boundaries (number → decimal)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseAmount — number conversion boundaries', () => {
  it('catches binary floating-point drift as a scale rejection', () => {
    // 0.1 + 0.2 === 0.30000000000000004 — the classic silent-corruption case.
    expectAmountError(() => parseAmount(0.1 + 0.2), 'INVALID_SCALE')
    expectAmountError(() => parseAmount(1.005), 'INVALID_SCALE')
  })

  it('accepts Number.MAX_SAFE_INTEGER and 2^53 exactly', () => {
    expect(parseAmount(Number.MAX_SAFE_INTEGER)).toBe('9007199254740991.00')
    expect(parseAmount(2 ** 53)).toBe('9007199254740992.00')
  })

  it('expands exponential number notation exactly, then applies the rules', () => {
    expect(parseAmount(1.5e2)).toBe('150.00') // String(150) === '150'
    expect(parseAmount(1e16)).toBe('10000000000000000.00')
    expectAmountError(() => parseAmount(1e17), 'OVERFLOW')
    expectAmountError(() => parseAmount(1e21), 'OVERFLOW') // String → '1e+21'
    expectAmountError(() => parseAmount(1e-7), 'INVALID_SCALE') // → 0.0000001
    expectAmountError(() => parseAmount(1.5e-3), 'INVALID_SCALE') // → 0.0015
    expect(parseAmount(1.5e-1)).toBe('0.15') // → 0.15
    expect(parseAmount(1e-2)).toBe('0.01')
  })

  it('rejects non-finite numbers (JSON.stringify would emit null)', () => {
    expectAmountError(() => parseAmount(Number.NaN), 'NOT_FINITE')
    expectAmountError(() => parseAmount(Number.POSITIVE_INFINITY), 'NOT_FINITE')
    expectAmountError(() => parseAmount(Number.NEGATIVE_INFINITY), 'NOT_FINITE')
  })

  it('rejects bigint values beyond the int64 bound', () => {
    expect(parseAmount(10n ** 16n)).toBe('10000000000000000.00')
    expectAmountError(() => parseAmount(10n ** 17n), 'OVERFLOW')
    expectAmountError(() => parseAmount(2n ** 63n), 'OVERFLOW')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sign, format, type, and emptiness rejection
// ─────────────────────────────────────────────────────────────────────────────

describe('parseAmount — sign, format, type, and emptiness rejection', () => {
  it('rejects negative values across all input types', () => {
    expectAmountError(() => parseAmount('-1'), 'NEGATIVE')
    expectAmountError(() => parseAmount('-0.00'), 'NEGATIVE')
    expectAmountError(() => parseAmount(-1), 'NEGATIVE')
    expectAmountError(() => parseAmount(-0.01), 'NEGATIVE')
    expectAmountError(() => parseAmount(-1n), 'NEGATIVE')
  })

  it('rejects malformed decimal strings', () => {
    const invalid = [
      'abc',
      '1.2.3',
      '.',
      '..',
      '1.',
      '.5',
      '+1',
      '+1.00',
      '1e3',
      '1E3',
      '0x10',
      '1,000',
      '1 000',
      '−1', // U+2212 minus sign
      '١٠٠', // Arabic-Indic digits
      '  1000.00.00',
      '1.5e-3',
    ]
    for (const value of invalid) {
      expect(() => parseAmount(value)).toThrow(AmountError)
    }
    // Spot-check codes for representative shapes.
    expectAmountError(() => parseAmount('1e3'), 'INVALID_FORMAT')
    expectAmountError(() => parseAmount('+1'), 'INVALID_FORMAT')
    expectAmountError(() => parseAmount('.5'), 'INVALID_FORMAT')
    expectAmountError(() => parseAmount('1.'), 'INVALID_FORMAT')
    expectAmountError(() => parseAmount('1,000'), 'INVALID_FORMAT')
  })

  it('rejects empty and whitespace-only strings', () => {
    expectAmountError(() => parseAmount(''), 'EMPTY')
    expectAmountError(() => parseAmount('   '), 'EMPTY')
    expectAmountError(() => parseAmount('\t\n'), 'EMPTY')
  })

  it('rejects non-amount types instead of coercing them', () => {
    expectAmountError(() => parseAmount(null as unknown as string), 'INVALID_TYPE')
    expectAmountError(() => parseAmount(undefined as unknown as string), 'INVALID_TYPE')
    expectAmountError(() => parseAmount(true as unknown as string), 'INVALID_TYPE')
    expectAmountError(() => parseAmount({ amount: 1 } as unknown as string), 'INVALID_TYPE')
    expectAmountError(() => parseAmount([1] as unknown as string), 'INVALID_TYPE')
    expectAmountError(() => parseAmount(Symbol('1') as unknown as string), 'INVALID_TYPE')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Rules validation
// ─────────────────────────────────────────────────────────────────────────────

describe('parseAmount — rules validation', () => {
  it('rejects invalid scale configuration', () => {
    expectAmountError(() => parseAmount('1', { scale: -1 }), 'INVALID_RULES')
    expectAmountError(() => parseAmount('1', { scale: 1.5 }), 'INVALID_RULES')
    expectAmountError(() => parseAmount('1', { scale: 19 }), 'INVALID_RULES')
    expectAmountError(() => parseAmount('1', { scale: Number.NaN }), 'INVALID_RULES')
    expectAmountError(() => parseAmount('1', { scale: '2' as unknown as number }), 'INVALID_RULES')
  })

  it('rejects unparsable or scale-incompatible bounds', () => {
    expectAmountError(() => parseAmount('1', { min: 'abc' }), 'INVALID_RULES')
    expectAmountError(() => parseAmount('1', { min: '0.001' }), 'INVALID_RULES')
    expectAmountError(() => parseAmount('1', { min: -1 }), 'INVALID_RULES')
    expectAmountError(() => parseAmount('1', { max: '0.005' }), 'INVALID_RULES')
    expectAmountError(() => parseAmount('1', { min: '10', max: '5' }), 'INVALID_RULES')
  })

  it('resolves the documented defaults', () => {
    expect(resolveAmountRules()).toEqual({
      scale: 2,
      minScaled: 0n,
      maxScaled: 9223372036854775807n,
    })
  })

  it('accepts pre-resolved rules for hot paths', () => {
    const resolved = resolveAmountRules({ min: '1.00', max: '10.00' })
    expect(parseAmount('5', resolved)).toBe('5.00')
    expectAmountError(() => parseAmount('0.50', resolved), 'BELOW_MIN')
    expectAmountError(() => parseAmount('10.01', resolved), 'OVERFLOW')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// tryParseAmount / compareAmounts
// ─────────────────────────────────────────────────────────────────────────────

describe('tryParseAmount', () => {
  it('returns ok results without throwing', () => {
    expect(tryParseAmount('1000.5')).toEqual({ ok: true, value: '1000.50' })
  })

  it('returns the typed error for invalid input', () => {
    const result = tryParseAmount(-1)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(AmountError)
      expect(result.error.code).toBe('NEGATIVE')
    }
  })
})

describe('compareAmounts', () => {
  it('compares exactly on scaled integers', () => {
    expect(compareAmounts('1.00', '1.0')).toBe(0)
    expect(compareAmounts('1.00', '0.99')).toBe(1)
    expect(compareAmounts('0.01', '0.02')).toBe(-1)
    expect(compareAmounts('1000', '999.99')).toBe(1)
  })

  it('throws when either side is invalid', () => {
    expect(() => compareAmounts('abc', '1')).toThrow(AmountError)
    expect(() => compareAmounts('1', -1)).toThrow(AmountError)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property tests vs the independent oracle (seeded, deterministic)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseAmount — property tests against an independent oracle', () => {
  const rand = mulberry32(0xc0ffee)
  const ITERATIONS = 300

  function randomDecimal(maxScale: number): string {
    const wholeLength = 1 + Math.floor(rand() * 4)
    let whole = ''
    for (let i = 0; i < wholeLength; i++) whole += String(Math.floor(rand() * 10))
    const fractionLength = Math.floor(rand() * (maxScale + 1))
    let fraction = ''
    for (let i = 0; i < fractionLength; i++) fraction += String(Math.floor(rand() * 10))
    const leadingZeros = rand() < 0.3 ? '0'.repeat(1 + Math.floor(rand() * 2)) : ''
    return `${leadingZeros}${whole}${fraction ? `.${fraction}` : ''}`
  }

  it('canonicalization always matches the string-op oracle', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const input = randomDecimal(2)
      expect(parseAmount(input)).toBe(oracleCanonical(input, 2))
    }
  })

  it('canonicalization is idempotent for random inputs', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const input = randomDecimal(2)
      const once = parseAmount(input)
      expect(parseAmount(once)).toBe(once)
    }
  })

  it('number inputs agree with the oracle on accept AND reject paths', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const decimal = randomDecimal(2)
      const asNumber = Number(decimal)
      if (!Number.isFinite(asNumber)) continue

      // Independent expectation: expand String(n) exactly, then apply rules.
      const expanded = oracleExpandNumberString(String(asNumber))
      const fraction = expanded.includes('.') ? expanded.split('.')[1] : ''
      const result = tryParseAmount(asNumber)

      if (fraction.length > 2) {
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe('INVALID_SCALE')
      } else if (oracleScaled(expanded, 2) > ORACLE_MAX_SCALED) {
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe('OVERFLOW')
      } else {
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value).toBe(oracleCanonical(expanded, 2))
      }
    }
  })

  it('comparison always matches the BigInt-scaled oracle', () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const a = randomDecimal(2)
      const b = randomDecimal(2)
      const difference = oracleScaled(a, 2) - oracleScaled(b, 2)
      const expected = difference < 0n ? -1 : difference > 0n ? 1 : 0
      expect(compareAmounts(a, b)).toBe(expected)
    }
  })

  it('arbitrary junk is accepted iff the char-walk grammar oracle accepts it', () => {
    const junkCharset = 'abcXYZ+-.,eE0159 \t$#@!'
    for (let i = 0; i < ITERATIONS; i++) {
      const length = 1 + Math.floor(rand() * 8)
      let candidate = ''
      for (let j = 0; j < length; j++) {
        candidate += junkCharset[Math.floor(rand() * junkCharset.length)]
      }
      const result = tryParseAmount(candidate)
      if (oracleGrammarAccepts(candidate)) {
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.value).toBe(oracleCanonical(candidate.trim(), 2))
      } else {
        expect(result.ok).toBe(false)
      }
    }
  })
})
