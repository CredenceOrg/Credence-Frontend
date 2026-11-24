import { describe, expect, it } from 'vitest'
import { DEFAULT_FALLBACK_ROUTE } from '../config/navigation'
import { safeNext } from './safeNext'

describe('safeNext', () => {
  it('allows valid same-origin relative paths', () => {
    expect(safeNext('/dashboard')).toBe('/dashboard')
    expect(safeNext('/bond')).toBe('/bond')
    expect(safeNext('/bond/new')).toBe('/bond/new')
    expect(safeNext('/bond/123?tab=history#top')).toBe('/bond/123?tab=history#top')
    expect(safeNext('/settings?section=network')).toBe('/settings?section=network')
  })

  it('trims surrounding whitespace on valid relative paths', () => {
    expect(safeNext('  /transactions  ')).toBe('/transactions')
  })

  it('falls back to DEFAULT_FALLBACK_ROUTE for missing or empty values', () => {
    expect(safeNext(null)).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext(undefined)).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('   ')).toBe(DEFAULT_FALLBACK_ROUTE)
  })

  it('supports a custom fallback route', () => {
    expect(safeNext(null, '/trust')).toBe('/trust')
    expect(safeNext('https://evil.com', '/trust')).toBe('/trust')
  })

  it('rejects external URLs and non-relative schemes', () => {
    expect(safeNext('https://evil.com')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('https://evil.com/dashboard')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('http://evil.com')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('javascript:alert(1)')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('data:text/html,<script>alert(1)</script>')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('dashboard')).toBe(DEFAULT_FALLBACK_ROUTE)
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeNext('//evil.com')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('//evil.com/path')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('///evil.com')).toBe(DEFAULT_FALLBACK_ROUTE)
  })

  it('rejects backslash-based open-redirect bypasses', () => {
    expect(safeNext('/\\evil.com')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('/bond\\..\\evil')).toBe(DEFAULT_FALLBACK_ROUTE)
  })

  it('rejects paths with control characters', () => {
    expect(safeNext('/dashboard\nLocation: https://evil.com')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('/bond\r\n')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('/settings\u0000')).toBe(DEFAULT_FALLBACK_ROUTE)
  })

  it('prevents redirect loops back to /signin', () => {
    expect(safeNext('/signin')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('/signin/')).toBe(DEFAULT_FALLBACK_ROUTE)
    expect(safeNext('/signin?next=/bond')).toBe(DEFAULT_FALLBACK_ROUTE)
  })
})
