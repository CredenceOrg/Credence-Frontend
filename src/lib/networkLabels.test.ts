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
import { describe, it, expect } from 'vitest'
import { NETWORK_LABELS, getNetworkLabel } from './networkLabels'
describe('networkLabels', () => {
  it('defines labels for both public and test networks', () => {
    expect(NETWORK_LABELS).toEqual({
      public: 'Public (Mainnet)',
      test: 'Test (Testnet)',
    })
  it('returns the public network label from getNetworkLabel', () => {
    expect(getNetworkLabel('public')).toBe('Public (Mainnet)')
  it('returns the test network label from getNetworkLabel', () => {
    expect(getNetworkLabel('test')).toBe('Test (Testnet)')
