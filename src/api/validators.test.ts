import { describe, expect, it } from 'vitest'
import { ApiError, ApiResponseShapeError } from './client'
import { validateTransactionList, validateTrustScore } from './validators'

const VALID_TRUST_SCORE = {
  address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
  score: 840,
  tier: 'gold' as const,
  attestations: 12,
  updatedAt: '2026-06-29T10:00:00Z',
}

const VALID_TRANSACTION = {
  id: 'tx-1',
  type: 'bond' as const,
  amountUsdc: 500.25,
  timestamp: '2026-06-29T10:00:00Z',
  status: 'confirmed' as const,
  hash: 'b6d396a84d41bf162d05f32a51f8a846b0a6fb2abccedb441f71f11e9f1a2380',
}

describe('validateTrustScore', () => {
  it('accepts a valid TrustScore payload', () => {
    expect(validateTrustScore(VALID_TRUST_SCORE)).toEqual(VALID_TRUST_SCORE)
  })

  it('accepts zero score and zero attestations across all tiers', () => {
    for (const tier of ['bronze', 'silver', 'gold', 'platinum'] as const) {
      const payload = { ...VALID_TRUST_SCORE, score: 0, attestations: 0, tier }
      expect(validateTrustScore(payload)).toEqual(payload)
    }
  })

  it('rejects non-object payloads with ApiResponseShapeError', () => {
    for (const input of [null, undefined, 'string', 42, []]) {
      let caught: unknown
      try {
        validateTrustScore(input)
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(ApiResponseShapeError)
      expect(caught).toBeInstanceOf(ApiError)
      const shapeErr = caught as ApiResponseShapeError
      expect(shapeErr.status).toBe(502)
      expect(shapeErr.code).toBe('invalid_response_shape')
      expect(shapeErr.retryable).toBe(true)
      expect(shapeErr.issues).toEqual([{ path: '', message: 'expected an object' }])
    }
  })

  it('rejects missing required fields', () => {
    for (const field of ['address', 'score', 'tier', 'attestations', 'updatedAt'] as const) {
      const malformed: Record<string, unknown> = { ...VALID_TRUST_SCORE }
      delete malformed[field]
      expect(() => validateTrustScore(malformed)).toThrow(ApiResponseShapeError)
    }
  })

  it('rejects wrong types and out-of-range values', () => {
    const invalidCases: Array<[string, Record<string, unknown>]> = [
      ['empty address', { ...VALID_TRUST_SCORE, address: '   ' }],
      ['numeric address', { ...VALID_TRUST_SCORE, address: 123 }],
      ['string score', { ...VALID_TRUST_SCORE, score: '840' }],
      ['negative score', { ...VALID_TRUST_SCORE, score: -1 }],
      ['non-integer score', { ...VALID_TRUST_SCORE, score: 840.5 }],
      ['unknown tier', { ...VALID_TRUST_SCORE, tier: 'diamond' }],
      ['non-string tier', { ...VALID_TRUST_SCORE, tier: 2 }],
      ['negative attestations', { ...VALID_TRUST_SCORE, attestations: -3 }],
      ['non-integer attestations', { ...VALID_TRUST_SCORE, attestations: 1.5 }],
      ['invalid updatedAt', { ...VALID_TRUST_SCORE, updatedAt: 'not-a-date' }],
      ['numeric updatedAt', { ...VALID_TRUST_SCORE, updatedAt: 1719655200000 }],
    ]

    for (const [, payload] of invalidCases) {
      expect(() => validateTrustScore(payload)).toThrow(ApiResponseShapeError)
    }
  })
})

describe('validateTransactionList', () => {
  it('accepts an empty transaction list without nextCursor', () => {
    expect(validateTransactionList({ items: [] })).toEqual({ items: [] })
  })

  it('accepts a valid list with items, optional amountUsdc, and nextCursor', () => {
    const withoutAmount = {
      id: 'tx-2',
      type: 'attestation' as const,
      timestamp: '2026-06-29T10:05:00Z',
      status: 'pending' as const,
      hash: 'a'.repeat(64),
    }
    const payload = {
      items: [VALID_TRANSACTION, withoutAmount],
      nextCursor: 'cursor-page-2',
    }
    expect(validateTransactionList(payload)).toEqual(payload)
  })

  it('rejects non-object payloads', () => {
    for (const input of [null, undefined, [], 'bad', 123]) {
      expect(() => validateTransactionList(input)).toThrow(ApiResponseShapeError)
    }
  })

  it('rejects missing or non-array items', () => {
    expect(() => validateTransactionList({})).toThrow(ApiResponseShapeError)
    expect(() => validateTransactionList({ items: 'not-an-array' })).toThrow(ApiResponseShapeError)
  })

  it('rejects non-object transaction items', () => {
    expect(() => validateTransactionList({ items: [null] })).toThrow(ApiResponseShapeError)
    expect(() => validateTransactionList({ items: ['tx'] })).toThrow(ApiResponseShapeError)
  })

  it('rejects missing required transaction fields', () => {
    for (const field of ['id', 'type', 'timestamp', 'status', 'hash'] as const) {
      const malformed: Record<string, unknown> = { ...VALID_TRANSACTION }
      delete malformed[field]
      expect(() => validateTransactionList({ items: [malformed] })).toThrow(ApiResponseShapeError)
    }
  })

  it('rejects invalid amountUsdc values using src/api/amount.ts rules', () => {
    const invalidAmounts: unknown[] = [
      '500.00', // string amount
      -10, // negative
      Number.NaN, // non-finite
      Number.POSITIVE_INFINITY, // non-finite
      12.345, // excess fractional precision (> 2 decimals)
      0.1 + 0.2, // float drift
      1e20, // overflow beyond int64 scaled bound
      null,
      true,
    ]

    for (const amountUsdc of invalidAmounts) {
      expect(() =>
        validateTransactionList({ items: [{ ...VALID_TRANSACTION, amountUsdc }] })
      ).toThrow(ApiResponseShapeError)
    }
  })

  it('rejects invalid nextCursor values', () => {
    for (const nextCursor of ['', '   ', null, 123, {}]) {
      expect(() => validateTransactionList({ items: [], nextCursor })).toThrow(
        ApiResponseShapeError
      )
    }
  })

  it('rejects invalid transaction enum values and timestamps', () => {
    expect(() =>
      validateTransactionList({ items: [{ ...VALID_TRANSACTION, type: 'slash' }] })
    ).toThrow(ApiResponseShapeError)
    expect(() =>
      validateTransactionList({ items: [{ ...VALID_TRANSACTION, status: 'unknown' }] })
    ).toThrow(ApiResponseShapeError)
    expect(() =>
      validateTransactionList({ items: [{ ...VALID_TRANSACTION, timestamp: 'invalid-date' }] })
    ).toThrow(ApiResponseShapeError)
  })
})
