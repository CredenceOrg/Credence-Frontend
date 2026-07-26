import { describe, expect, it, vi } from 'vitest'
import {
  ApiRateLimiter,
  DEFAULT_API_RATE_LIMIT,
  readApiRateLimitOverrides,
  type ApiRateLimiterOptions,
} from './rateLimit'

function makeLimiter(
  overrides: Partial<ApiRateLimiterOptions> = {},
  now: () => number = () => Date.now()
): ApiRateLimiter {
  return new ApiRateLimiter({ now, ...overrides })
}

describe('ApiRateLimiter', () => {
  describe('defaults', () => {
    it('exposes the documented defaults', () => {
      expect(DEFAULT_API_RATE_LIMIT).toEqual({
        maxRequests: 20,
        windowMs: 5_000,
        enabled: true,
      })
    })

    it('applies defaults when constructed with no options', () => {
      const limiter = new ApiRateLimiter()
      expect(limiter.config.maxRequests).toBe(DEFAULT_API_RATE_LIMIT.maxRequests)
      expect(limiter.config.windowMs).toBe(DEFAULT_API_RATE_LIMIT.windowMs)
      expect(limiter.config.enabled).toBe(true)
    })
  })

  describe('happy path', () => {
    it('permits up to maxRequests calls in a single instant', () => {
      const limiter = makeLimiter({ maxRequests: 3 })

      expect(limiter.acquire()).toEqual({ allowed: true, retryAfterMs: 0 })
      expect(limiter.acquire()).toEqual({ allowed: true, retryAfterMs: 0 })
      expect(limiter.acquire()).toEqual({ allowed: true, retryAfterMs: 0 })
    })

    it('rejects the call immediately after maxRequests', () => {
      const limiter = makeLimiter({ maxRequests: 2, windowMs: 1000 })

      limiter.acquire()
      limiter.acquire()
      const decision = limiter.acquire()

      expect(decision.allowed).toBe(false)
      expect(decision.retryAfterMs).toBeGreaterThan(0)
      expect(decision.retryAfterMs).toBeLessThanOrEqual(1000)
    })

    it('reports retryAfterMs as the time until the oldest slot frees', () => {
      let nowMs = 1_000
      const limiter = makeLimiter(
        { maxRequests: 1, windowMs: 1_000 },
        () => nowMs
      )

      limiter.acquire() // t=1000
      nowMs = 1_400
      const decision = limiter.acquire() // t=1400 — should retry at 2000

      expect(decision.allowed).toBe(false)
      expect(decision.retryAfterMs).toBe(600)
    })
  })

  describe('sliding window', () => {
    it('frees capacity once timestamps fall outside the window', () => {
      let nowMs = 0
      const limiter = makeLimiter(
        { maxRequests: 2, windowMs: 1_000 },
        () => nowMs
      )

      limiter.acquire() // t=0
      nowMs = 100
      limiter.acquire() // t=100 - bucket full (2 / 2)
      expect(limiter.acquire().allowed).toBe(false) // t=100 — blocked

      // t=1050 -> windowStart=50 -> prune ts=0. ts=[100], 1 < 2 -> ALLOWED.
      nowMs = 1_050
      expect(limiter.acquire().allowed).toBe(true)

      // ts=[100, 1050] - bucket full again - blocked
      expect(limiter.acquire().allowed).toBe(false)

      // t=1200 -> windowStart=200 -> prune both (0 dropped earlier, 100 < 200, 1050 stays!)
      // Actually 1050 > 200 so it stays. ts=[1050], 1 < 2 -> ALLOWED again.
      nowMs = 1_200
      expect(limiter.acquire().allowed).toBe(true)

      // t=2150 -> windowStart=1150 -> 1050 ≤ 1150 dropped; ts=[1200]
      // 1 < 2, so still allowed.
      nowMs = 2_150
      expect(limiter.acquire().allowed).toBe(true)
    })

    it('reports retryAfterMs ≥ 1 for blocked decisions', () => {
      const limiter = makeLimiter({ maxRequests: 1, windowMs: 1_000 })
      limiter.acquire()
      const decision = limiter.acquire()

      expect(decision.allowed).toBe(false)
      expect(decision.retryAfterMs).toBeGreaterThanOrEqual(1)
    })
  })

  describe('enabled toggle', () => {
    it('is a no-op when disabled', () => {
      const limiter = makeLimiter({
        maxRequests: 1,
        windowMs: 10_000,
        enabled: false,
      })

      for (let i = 0; i < 50; i++) {
        expect(limiter.acquire()).toEqual({ allowed: true, retryAfterMs: 0 })
      }
    })
  })

  describe('clock injection', () => {
    it('uses the injected clock rather than Date.now()', () => {
      const fixedNow = vi.fn(() => 5_000)
      const limiter = new ApiRateLimiter({
        maxRequests: 1,
        windowMs: 100,
        now: fixedNow,
      })

      limiter.acquire()
      fixedNow.mockReturnValueOnce(5_050) // still within window
      expect(limiter.acquire().allowed).toBe(false)
      fixedNow.mockReturnValueOnce(5_101) // just past window
      expect(limiter.acquire().allowed).toBe(true)
    })
  })

  describe('reset', () => {
    it('clears the bucket so blocked calls succeed again', () => {
      const limiter = makeLimiter({ maxRequests: 1, windowMs: 10_000 })
      limiter.acquire()
      expect(limiter.acquire().allowed).toBe(false)

      limiter.reset()
      expect(limiter.acquire().allowed).toBe(true)
    })
  })

  describe('configure', () => {
    it('lowers maxRequests live and reuses stale timestamps until they age out', () => {
      let nowMs = 0
      const limiter = makeLimiter({ maxRequests: 5, windowMs: 1_000 }, () => nowMs)

      // Saturate the wide cap with 5 acquisitions spread across 50ms.
      for (let i = 0; i < 5; i++) {
        nowMs = (i + 1) * 10
        expect(limiter.acquire().allowed).toBe(true)
      }
      expect(limiter.acquire().allowed).toBe(false)

      // Shrink the cap below the current log length — documented caveat: the
      // stale timestamps continue blocking until each one ages out. Callers
      // who need clean state must additionally call reset().
      limiter.configure({ maxRequests: 1 })

      nowMs = 60 // windowStart=-940, all 5 timestamps still valid
      expect(limiter.acquire().allowed).toBe(false)

      // Advance past every existing timestamp so they fall outside the window.
      nowMs = 1_100 // windowStart=100, drops all earlier timestamps
      expect(limiter.acquire().allowed).toBe(true) // 0 < 1, push 1100
      // Now log=[1100], 1 < 1 is false → blocked again at the new cap.
      expect(limiter.acquire().allowed).toBe(false)

      // Reset clears the log so the new cap takes effect immediately. This
      // locks in the documented contract that callers pair `configure(...)`
      // with `reset()` when they want a clean break.
      limiter.reset()
      expect(limiter.acquire().allowed).toBe(true)
    })

    it('raises maxRequests live to allow additional calls within the same window', () => {
      let nowMs = 0
      const limiter = makeLimiter({ maxRequests: 1, windowMs: 1_000 }, () => nowMs)
      nowMs = 100
      limiter.acquire()
      expect(limiter.acquire().allowed).toBe(false)

      limiter.configure({ maxRequests: 3 })
      // Stale ts=[100] is still in window; with cap=3, 1 < 3, allow.
      expect(limiter.acquire().allowed).toBe(true)
      expect(limiter.acquire().allowed).toBe(true)
      expect(limiter.acquire().allowed).toBe(false)
    })

    it('rejects non-positive values', () => {
      const limiter = makeLimiter({ maxRequests: 2 })
      expect(() => limiter.configure({ maxRequests: 0 })).toThrow(RangeError)
      expect(() => limiter.configure({ windowMs: -1 })).toThrow(RangeError)
    })
  })

  describe('validation', () => {
    it('rejects non-positive maxRequests', () => {
      expect(() => new ApiRateLimiter({ maxRequests: 0 })).toThrow(RangeError)
      expect(() => new ApiRateLimiter({ maxRequests: -5 })).toThrow(RangeError)
      expect(() => new ApiRateLimiter({ maxRequests: Number.NaN })).toThrow(RangeError)
    })

    it('rejects non-positive windowMs', () => {
      expect(() => new ApiRateLimiter({ windowMs: 0 })).toThrow(RangeError)
      expect(() => new ApiRateLimiter({ windowMs: -1 })).toThrow(RangeError)
      expect(() => new ApiRateLimiter({ windowMs: Number.POSITIVE_INFINITY })).toThrow(RangeError)
    })
  })
})

describe('readApiRateLimitOverrides', () => {
  it('returns nulls when nothing is set', () => {
    expect(readApiRateLimitOverrides({})).toEqual({
      maxRequests: null,
      windowMs: null,
      enabled: null,
    })
  })

  it('parses positive integers', () => {
    expect(
      readApiRateLimitOverrides({
        VITE_API_RATE_LIMIT_MAX: '30',
        VITE_API_RATE_LIMIT_WINDOW_MS: '1500',
      })
    ).toEqual({ maxRequests: 30, windowMs: 1500, enabled: null })
  })

  it('parses booleans from common truthy / falsy strings', () => {
    expect(
      readApiRateLimitOverrides({ VITE_API_RATE_LIMIT_ENABLED: 'true' }).enabled
    ).toBe(true)
    expect(
      readApiRateLimitOverrides({ VITE_API_RATE_LIMIT_ENABLED: '1' }).enabled
    ).toBe(true)
    expect(
      readApiRateLimitOverrides({ VITE_API_RATE_LIMIT_ENABLED: 'false' }).enabled
    ).toBe(false)
    expect(
      readApiRateLimitOverrides({ VITE_API_RATE_LIMIT_ENABLED: '0' }).enabled
    ).toBe(false)
  })

  it('returns null for malformed values instead of throwing', () => {
    expect(
      readApiRateLimitOverrides({ VITE_API_RATE_LIMIT_MAX: 'abc' }).maxRequests
    ).toBeNull()
    expect(
      readApiRateLimitOverrides({ VITE_API_RATE_LIMIT_MAX: '-3' }).maxRequests
    ).toBeNull()
    expect(
      readApiRateLimitOverrides({ VITE_API_RATE_LIMIT_WINDOW_MS: '' }).windowMs
    ).toBeNull()
  })
})
