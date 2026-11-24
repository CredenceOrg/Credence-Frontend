import { describe, expect, it } from 'vitest'
import { getNetworkPassphrase } from './networkLabels'

describe('getNetworkPassphrase', () => {
  it('returns the Stellar public network passphrase', () => {
    expect(getNetworkPassphrase('public')).toBe('Public Global Stellar Network ; September 2015')
  })

  it('returns the Stellar test network passphrase', () => {
    expect(getNetworkPassphrase('test')).toBe('Test SDF Network ; September 2015')
  })
})
