import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { MAX_INT64, USDC_SCALE, parseAmount } from './amount'

const RUNS = { numRuns: 200 }

/** Generates plain unsigned decimal strings with up to `maxFrac` fractional digits. */
const plainDecimal = (maxFrac: number) =>
  fc
    .tuple(
      fc.bigInt({ min: 0n, max: 10n ** 15n }).map((n) => n.toString()),
      fc.option(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: maxFrac }),
        { nil: undefined }
      )
    )
    .map(([whole, frac]) => (frac ? `${whole}.${frac.join('')}` : whole))

/** Expected scaled integer value of a plain decimal, padded/truncated to USDC_SCALE digits. */
const expectedScaled = (input: string): bigint => {
  const [whole, frac = ''] = input.split('.')
  const fracPadded = (frac + '0'.repeat(USDC_SCALE)).slice(0, USDC_SCALE)
  return BigInt(whole + fracPadded)
}

describe('amount property tests', () => {
  it('accepts any plain decimal within scale and canonicalizes to exactly USDC_SCALE digits', () => {
    fc.assert(
      fc.property(plainDecimal(USDC_SCALE), (input) => {
        const out = parseAmount(input)
        expect(out).toMatch(/^\d+\.\d{2}$/)
        // Idempotent: re-parsing the canonical form yields the same string.
        expect(parseAmount(out)).toBe(out)
        // Numeric value preserved exactly.
        expect(BigInt(out.replace('.', ''))).toBe(expectedScaled(input))
      }),
      RUNS
    )
  })

  it('rejects any amount whose scaled integer exceeds int64', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: MAX_INT64 / 100n + 1n, max: 10n ** 30n }),
        (n) => {
          expect(() => parseAmount(n.toString())).toThrow()
        }
      ),
      RUNS
    )
  })

  it('never returns a non-decimal string for accepted inputs', () => {
    fc.assert(
      fc.property(plainDecimal(USDC_SCALE), (input) => {
        expect(parseAmount(input)).not.toMatch(/[eE+\-,\s]/)
      }),
      RUNS
    )
  })
})
