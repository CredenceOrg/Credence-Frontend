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

  it('flags mismatch in reverse — test settings with mainnet wallet', () => {
    expect(compareNetworkMismatch('test', 'public')).toEqual({
      mismatch: true,
      expected: 'Test (Testnet)',
      actual: 'Public (Mainnet)',
    })
  })

  it('marks matching testnet networks as aligned', () => {
    expect(compareNetworkMismatch('test', 'test')).toEqual({
      mismatch: false,
      expected: 'Test (Testnet)',
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

  it('reports mismatch in reverse — testnet settings with mainnet wallet', () => {
    mockSettingsNetwork = 'test'
    mockWalletNetwork = 'public'

    const { result } = renderHook(() => useNetworkMismatch())

    expect(result.current).toEqual({
      mismatch: true,
      expected: 'Test (Testnet)',
      actual: 'Public (Mainnet)',
    })
  })

  it('reports no mismatch when both sides are testnet', () => {
    mockSettingsNetwork = 'test'
    mockWalletNetwork = 'test'

    const { result } = renderHook(() => useNetworkMismatch())

    expect(result.current).toEqual({
      mismatch: false,
      expected: 'Test (Testnet)',
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

  it('updates when starting on testnet and switching to public settings', () => {
    mockSettingsNetwork = 'test'
    mockWalletNetwork = 'test'

    const { result, rerender } = renderHook(() => useNetworkMismatch())

    expect(result.current).toEqual({
      mismatch: false,
      expected: 'Test (Testnet)',
      actual: 'Test (Testnet)',
    })

    mockSettingsNetwork = 'public'
    rerender()

    expect(result.current).toEqual({
      mismatch: true,
      expected: 'Public (Mainnet)',
      actual: 'Test (Testnet)',
    })
  })
})
