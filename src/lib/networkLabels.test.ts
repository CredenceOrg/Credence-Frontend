import { describe, it, expect } from 'vitest'
import { NETWORK_LABELS, getNetworkLabel } from './networkLabels'

describe('networkLabels', () => {
  it('defines labels for both public and test networks', () => {
    expect(NETWORK_LABELS).toEqual({
      public: 'Public (Mainnet)',
      test: 'Test (Testnet)',
    })
  })

  it('returns the public network label from getNetworkLabel', () => {
    expect(getNetworkLabel('public')).toBe('Public (Mainnet)')
  })

  it('returns the test network label from getNetworkLabel', () => {
    expect(getNetworkLabel('test')).toBe('Test (Testnet)')
  })
})
