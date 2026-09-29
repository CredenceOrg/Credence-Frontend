import { describe, it, expect } from 'vitest'
import { getFeatureFlags } from './featureFlags'

describe('getFeatureFlags', () => {
  it('returns all flags off when no search params are present', () => {
    const flags = getFeatureFlags('')
    expect(flags).toEqual({
      debug: false,
      newDashboard: false,
      betaChart: false,
      newTransactionList: false,
    })
  })

  it('returns all flags off for a non-matching search string', () => {
    const flags = getFeatureFlags('?foo=bar')
    expect(flags.debug).toBe(false)
    expect(flags.newDashboard).toBe(false)
  })

  it('enables debug when ?debug=1 is present', () => {
    const flags = getFeatureFlags('?debug=1')
    expect(flags.debug).toBe(true)
  })

  it('enables debug when ?debug=true is present', () => {
    const flags = getFeatureFlags('?debug=true')
    expect(flags.debug).toBe(true)
  })

  it('enables debug when ?debug=TRUE is present (case-insensitive)', () => {
    const flags = getFeatureFlags('?debug=TRUE')
    expect(flags.debug).toBe(true)
  })

  it('does not enable debug when ?debug=0 is present', () => {
    const flags = getFeatureFlags('?debug=0')
    expect(flags.debug).toBe(false)
  })

  it('enables individual flags via URL params', () => {
    const flags = getFeatureFlags('?newDashboard=1&betaChart=1')
    expect(flags.newDashboard).toBe(true)
    expect(flags.betaChart).toBe(true)
    expect(flags.newTransactionList).toBe(false)
    expect(flags.debug).toBe(true) // implicit because another flag is on
  })

  it('enables all flags when all params are set', () => {
    const flags = getFeatureFlags('?debug=1&newDashboard=1&betaChart=1&newTransactionList=1')
    expect(flags.debug).toBe(true)
    expect(flags.newDashboard).toBe(true)
    expect(flags.betaChart).toBe(true)
    expect(flags.newTransactionList).toBe(true)
  })

  it('parses multiple params correctly with mixed values', () => {
    const flags = getFeatureFlags('?debug=1&newDashboard=0&betaChart=true&newTransactionList=0')
    expect(flags.debug).toBe(true)
    expect(flags.newDashboard).toBe(false)
    expect(flags.betaChart).toBe(true)
    expect(flags.newTransactionList).toBe(false)
  })
})