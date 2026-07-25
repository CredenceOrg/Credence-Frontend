import { describe, expect, it } from 'vitest'
import { resolveSmartBackDestination } from './smartBack'

describe('resolveSmartBackDestination', () => {
  it('honours_prior_route_path_when_from_state_is_present', () => {
    const result = resolveSmartBackDestination({ from: '/trust' }, true)

    expect(result).toEqual({
      type: 'state',
      path: '/trust',
    })
  })

  it('trims_and_honours_prior_route_path_with_whitespace', () => {
    const result = resolveSmartBackDestination({ from: '  /settings  ' }, true)

    expect(result).toEqual({
      type: 'state',
      path: '/settings',
    })
  })

  it('uses_history_back_when_history_exists_and_from_state_is_missing', () => {
    const result = resolveSmartBackDestination(null, true)

    expect(result).toEqual({
      type: 'history',
    })
  })

  it('falls_back_to_dashboard_when_history_is_missing_and_from_state_is_missing', () => {
    const result = resolveSmartBackDestination(null, false)

    expect(result).toEqual({
      type: 'fallback',
      path: '/dashboard',
    })
  })

  it('uses_custom_fallback_route_when_provided_and_history_is_missing', () => {
    const result = resolveSmartBackDestination(null, false, '/bond')

    expect(result).toEqual({
      type: 'fallback',
      path: '/bond',
    })
  })

  it('prioritises_from_state_over_history_and_fallback', () => {
    const result = resolveSmartBackDestination({ from: '/attestations' }, true, '/custom-fallback')

    expect(result).toEqual({
      type: 'state',
      path: '/attestations',
    })
  })
})
