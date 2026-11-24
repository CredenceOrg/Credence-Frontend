import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseTtlEnv, QUERY_CACHE_DEFAULTS } from './queryCache'

describe('parseTtlEnv helper', () => {
  const DEFAULT_VAL = 60_000

  it('returns default value when envValue is undefined', () => {
    expect(parseTtlEnv(undefined, DEFAULT_VAL)).toBe(DEFAULT_VAL)
  })

  it('returns default value when envValue is empty string or whitespace', () => {
    expect(parseTtlEnv('', DEFAULT_VAL)).toBe(DEFAULT_VAL)
    expect(parseTtlEnv('   ', DEFAULT_VAL)).toBe(DEFAULT_VAL)
    expect(parseTtlEnv('\t\n', DEFAULT_VAL)).toBe(DEFAULT_VAL)
  })

  it('parses valid positive integer strings', () => {
    expect(parseTtlEnv('120000', DEFAULT_VAL)).toBe(120_000)
    expect(parseTtlEnv(' 45000 ', DEFAULT_VAL)).toBe(45_000)
    expect(parseTtlEnv('1000', DEFAULT_VAL)).toBe(1_000)
  })

  it('falls back to default for non-numeric strings (explicit failure mode)', () => {
    expect(parseTtlEnv('invalid', DEFAULT_VAL)).toBe(DEFAULT_VAL)
    expect(parseTtlEnv('12000ms', DEFAULT_VAL)).toBe(DEFAULT_VAL)
    expect(parseTtlEnv('abc', DEFAULT_VAL)).toBe(DEFAULT_VAL)
  })

  it('falls back to default for zero or negative values (explicit failure mode)', () => {
    expect(parseTtlEnv('0', DEFAULT_VAL)).toBe(DEFAULT_VAL)
    expect(parseTtlEnv('-5000', DEFAULT_VAL)).toBe(DEFAULT_VAL)
  })

  it('falls back to default for NaN and Infinity strings (explicit failure mode)', () => {
    expect(parseTtlEnv('NaN', DEFAULT_VAL)).toBe(DEFAULT_VAL)
    expect(parseTtlEnv('Infinity', DEFAULT_VAL)).toBe(DEFAULT_VAL)
    expect(parseTtlEnv('-Infinity', DEFAULT_VAL)).toBe(DEFAULT_VAL)
  })
})

describe('QUERY_CACHE_TTLS resolution precedence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  const getQueryCacheTtls = async () => {
    return ((await vi.importActual('./queryCache')) as typeof import('./queryCache'))
      .QUERY_CACHE_TTLS
  }

  it('uses default values when no environment variables are set', async () => {
    vi.stubEnv('VITE_QUERY_CACHE_DEFAULT_TTL_MS', undefined as unknown as string)
    vi.stubEnv('VITE_QUERY_CACHE_STALE_TIME_MS', undefined as unknown as string)
    vi.stubEnv('VITE_QUERY_CACHE_GC_TIME_MS', undefined as unknown as string)
    vi.stubEnv('VITE_QUERY_CACHE_ISSUER_TTL_MS', undefined as unknown as string)
    vi.stubEnv('VITE_QUERY_CACHE_VERIFIER_TTL_MS', undefined as unknown as string)

    const ttls = await getQueryCacheTtls()
    expect(ttls.DEFAULT_TTL_MS).toBe(QUERY_CACHE_DEFAULTS.DEFAULT_TTL_MS)
    expect(ttls.STALE_TIME_MS).toBe(QUERY_CACHE_DEFAULTS.STALE_TIME_MS)
    expect(ttls.GC_TIME_MS).toBe(QUERY_CACHE_DEFAULTS.GC_TIME_MS)
    expect(ttls.ISSUER_TTL_MS).toBe(QUERY_CACHE_DEFAULTS.ISSUER_TTL_MS)
    expect(ttls.VERIFIER_TTL_MS).toBe(QUERY_CACHE_DEFAULTS.VERIFIER_TTL_MS)
  })

  it('uses environment variable overrides when valid positive numbers are provided', async () => {
    vi.stubEnv('VITE_QUERY_CACHE_DEFAULT_TTL_MS', '90000')
    vi.stubEnv('VITE_QUERY_CACHE_STALE_TIME_MS', '15000')
    vi.stubEnv('VITE_QUERY_CACHE_GC_TIME_MS', '600000')
    vi.stubEnv('VITE_QUERY_CACHE_ISSUER_TTL_MS', '180000')
    vi.stubEnv('VITE_QUERY_CACHE_VERIFIER_TTL_MS', '240000')

    const ttls = await getQueryCacheTtls()
    expect(ttls.DEFAULT_TTL_MS).toBe(90_000)
    expect(ttls.STALE_TIME_MS).toBe(15_000)
    expect(ttls.GC_TIME_MS).toBe(600_000)
    expect(ttls.ISSUER_TTL_MS).toBe(180_000)
    expect(ttls.VERIFIER_TTL_MS).toBe(240_000)
  })

  it('falls back to default values when environment variables are invalid', async () => {
    vi.stubEnv('VITE_QUERY_CACHE_DEFAULT_TTL_MS', 'not-a-number')
    vi.stubEnv('VITE_QUERY_CACHE_STALE_TIME_MS', '-100')
    vi.stubEnv('VITE_QUERY_CACHE_GC_TIME_MS', '   ')
    vi.stubEnv('VITE_QUERY_CACHE_ISSUER_TTL_MS', '0')
    vi.stubEnv('VITE_QUERY_CACHE_VERIFIER_TTL_MS', 'NaN')

    const ttls = await getQueryCacheTtls()
    expect(ttls.DEFAULT_TTL_MS).toBe(QUERY_CACHE_DEFAULTS.DEFAULT_TTL_MS)
    expect(ttls.STALE_TIME_MS).toBe(QUERY_CACHE_DEFAULTS.STALE_TIME_MS)
    expect(ttls.GC_TIME_MS).toBe(QUERY_CACHE_DEFAULTS.GC_TIME_MS)
    expect(ttls.ISSUER_TTL_MS).toBe(QUERY_CACHE_DEFAULTS.ISSUER_TTL_MS)
    expect(ttls.VERIFIER_TTL_MS).toBe(QUERY_CACHE_DEFAULTS.VERIFIER_TTL_MS)
  })
})
