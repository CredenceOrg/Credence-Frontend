import { describe, expect, it } from 'vitest'
import { ALL_NAV_LINKS } from '../config/navLinks'
import { NAV_LINKS, ROUTE_LABELS, SUGGESTION_ROUTES } from '../config/navigation'
import { suggestRoute } from './suggestRoute'

describe('shared route suggestions', () => {
  it('uses unique canonical navigation destinations', () => {
    expect(SUGGESTION_ROUTES).toEqual(ALL_NAV_LINKS.map(({ to }) => to))
    expect(new Set(SUGGESTION_ROUTES).size).toBe(SUGGESTION_ROUTES.length)
    expect(NAV_LINKS.find(({ to }) => to === '/dashboard')?.label).toBe('Dashboard')
    expect(ROUTE_LABELS['/']).toBe('Home page')
    expect(ROUTE_LABELS['/dashboard']).toBe('Dashboard page')
  })

  it.each([
    ['/dashbord', '/dashboard'],
    ['/transactons', '/transactions'],
    ['/attestaton', '/attestations'],
    ['/setings', '/settings'],
  ])('suggests %s from the shared candidates', (attempted, expected) => {
    expect(suggestRoute(attempted, SUGGESTION_ROUTES).suggestion).toBe(expected)
  })

  it('accepts immutable caller-provided candidates', () => {
    expect(suggestRoute('/custm', ['/custom'] as const).suggestion).toBe('/custom')
  })

  it('does not suggest an exact match, unrelated input, or an empty candidate list', () => {
    expect(suggestRoute('/dashboard', SUGGESTION_ROUTES).suggestion).toBeUndefined()
    expect(suggestRoute('/zzzzzzzzzzzz', SUGGESTION_ROUTES).suggestion).toBeUndefined()
    expect(suggestRoute('/dashboard', [])).toEqual({ confidence: 0 })
  })
})
