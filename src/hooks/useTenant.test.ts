import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTenant } from './useTenant'

// Mock useWallet
const mockUseWallet = vi.fn()

vi.mock('../context/WalletContext', () => ({
  useWallet: () => mockUseWallet(),
}))

describe('useTenant', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path: returns the tenant info when wallet is connected', () => {
    const mockAddress = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
    mockUseWallet.mockReturnValue({
      address: mockAddress,
      isConnected: true,
    })

    const { result } = renderHook(() => useTenant())

    expect(result.current).toEqual({
      tenantId: mockAddress,
    })
  })

  it('explicit failure mode: throws an error when wallet is disconnected', () => {
    mockUseWallet.mockReturnValue({
      address: '',
      isConnected: false,
    })

    expect(() => {
      renderHook(() => useTenant())
    }).toThrow('Tenant context requires a connected wallet')
  })
})
