import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compareNetworkMismatch, useNetworkMismatch } from './useNetworkMismatch'

let mockSettingsNetwork: 'public' | 'test' = 'public'
let mockWalletNetwork: 'public' | 'test' | null = 'public'
let mockIsConnected = true

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    network: mockSettingsNetwork,
  }),
}))

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    isConnected: mockIsConnected,
    network: mockWalletNetwork,
  }),
}))

beforeEach(() => {
  mockSettingsNetwork = 'public'
  mockWalletNetwork = 'public'
  mockIsConnected = true
})

describe('compareNetworkMismatch', () => {
  it('marks matching networks as aligned', () => {
    expect(compareNetworkMismatch('public', 'public')).toEqual({
      mismatch: false,
      expected: 'Public (Mainnet)',
      actual: 'Public (Mainnet)',
    })
  })

  it('returns no mismatch when the wallet has not reported a network yet', () => {
    expect(compareNetworkMismatch('test', null)).toEqual({
      mismatch: false,
      expected: 'Test (Testnet)',
      actual: '',
    })
  })

  it('flags differing networks as a mismatch', () => {
    expect(compareNetworkMismatch('public', 'test')).toEqual({
      mismatch: true,
      expected: 'Public (Mainnet)',
      actual: 'Test (Testnet)',
    })
  })
})

describe('useNetworkMismatch', () => {
  it('does not report a mismatch while disconnected', () => {
    mockIsConnected = false
    mockWalletNetwork = 'test'

    const { result } = renderHook(() => useNetworkMismatch())

    expect(result.current).toEqual({
      mismatch: false,
      expected: 'Public (Mainnet)',
      actual: '',
    })
  })

  it('reports a mismatch when settings and wallet networks differ', () => {
    mockWalletNetwork = 'test'

    const { result } = renderHook(() => useNetworkMismatch())

    expect(result.current).toEqual({
      mismatch: true,
      expected: 'Public (Mainnet)',
      actual: 'Test (Testnet)',
    })
  })

  it('updates when the selected settings network changes', () => {
    const { result, rerender } = renderHook(() => useNetworkMismatch())

    expect(result.current).toEqual({
      mismatch: false,
      expected: 'Public (Mainnet)',
      actual: 'Public (Mainnet)',
    })

    mockSettingsNetwork = 'test'
    rerender()

    expect(result.current).toEqual({
      mismatch: true,
      expected: 'Test (Testnet)',
      actual: 'Public (Mainnet)',
    })
  })
})
