import { describe, it, expect } from 'vitest'
import { suggestRoute } from './suggestRoute'

/**
 * Canonical app routes, mirroring the entries the 404 page passes in
 * (see `src/config/routes.ts`). Kept local so the cases read like real
 * navigations rather than synthetic strings.
 */
const ROUTES = ['/dashboard', '/bond', '/transactions', '/settings', '/attestations']

describe('suggestRoute', () => {
  describe('exact matches', () => {
    it('returns full confidence and no suggestion when the path already matches', () => {
      const result = suggestRoute('/dashboard', ROUTES)

      expect(result).toEqual({ confidence: 1 })
      expect(result.suggestion).toBeUndefined()
    })

    it('treats a case-different path as an exact match', () => {
      // Comparison is lower-cased on both sides, so "/DashBoard" is the same
      // route as "/dashboard" and there is nothing to suggest.
      const result = suggestRoute('/DashBoard', ROUTES)

      expect(result).toEqual({ confidence: 1 })
    })
  })

  describe('typo matches', () => {
    const cases: Array<{ attempted: string; expected: string; confidence: number }> = [
      { attempted: '/bondz', expected: '/bond', confidence: 1 - 1 / 6 },
      { attempted: '/dashboardd', expected: '/dashboard', confidence: 1 - 1 / 11 },
      { attempted: '/transactons', expected: '/transactions', confidence: 1 - 1 / 13 },
      { attempted: '/setings', expected: '/settings', confidence: 1 - 1 / 9 },
    ]

    it.each(cases)('suggests $expected for $attempted', ({ attempted, expected, confidence }) => {
      const result = suggestRoute(attempted, ROUTES)

      expect(result.suggestion).toBe(expected)
      expect(result.confidence).toBeCloseTo(confidence, 10)
    })

    it('picks the closest route when several are plausible', () => {
      // "/bond" is one edit from "/bondz"; "/bond/123" is further but still
      // resolves to the same canonical route.
      const result = suggestRoute('/bondz', ['/dashboard', '/bond', '/transactions'])

      expect(result.suggestion).toBe('/bond')
    })
  })

  describe('no good match', () => {
    it('omits the suggestion when confidence is at or below the cutoff', () => {
      const result = suggestRoute('/zzzzzzzz', ROUTES)

      expect(result.suggestion).toBeUndefined()
      expect(result.confidence).toBeLessThanOrEqual(0.5)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
    })

    it('returns zero confidence when there are no routes to compare against', () => {
      const result = suggestRoute('/dashboard', [])

      expect(result).toEqual({ confidence: 0 })
      expect(result.suggestion).toBeUndefined()
    })
  })

  describe('input normalization', () => {
    it('suggests a route for an empty path without a false positive', () => {
      const result = suggestRoute('', ROUTES)

      expect(result.suggestion).toBeUndefined()
      expect(result.confidence).toBe(0)
    })

    it('ignores leading and trailing whitespace', () => {
      const result = suggestRoute('  /bondz  ', ROUTES)

      expect(result.suggestion).toBe('/bond')
    })

    it('accepts a path with a missing leading slash', () => {
      const result = suggestRoute('dashboardd', ROUTES)

      expect(result.suggestion).toBe('/dashboard')
      // Two edits: add the leading slash, drop the duplicated trailing "d".
      expect(result.confidence).toBeCloseTo(1 - 2 / 10, 10)
    })

    it('is case-insensitive when scoring a typo', () => {
      const result = suggestRoute('/BONDZ', ROUTES)

      expect(result.suggestion).toBe('/bond')
    })

    it('does not mutate the caller-supplied route list', () => {
      const routes = [...ROUTES]
      suggestRoute('/bondz', routes)

      expect(routes).toEqual(ROUTES)
    })
  })

  describe('confidence', () => {
    it('is always within [0, 1] for realistic navigations', () => {
      const attempts = [
        '/',
        '',
        '/bond',
        '/bondz',
        '/transactionsx',
        '/settings/notifications',
        '/attestations/new',
        '/completely-unrelated-path',
        '   ',
        '/DASHBOARD',
      ]

      for (const attempted of attempts) {
        const { confidence } = suggestRoute(attempted, ROUTES)

        expect(Number.isFinite(confidence)).toBe(true)
        expect(confidence).toBeGreaterThanOrEqual(0)
        expect(confidence).toBeLessThanOrEqual(1)
      }
    })

    it('is deterministic across repeated calls', () => {
      const first = suggestRoute('/transactons', ROUTES)
      const second = suggestRoute('/transactons', ROUTES)

      expect(second).toEqual(first)
    })
  })
})
