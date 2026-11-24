import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BondList } from '../api/types'
import { clearApiQueryCache } from './useApiQuery'
import { useBonds } from './useBonds'

const apiFetchMock = vi.fn<typeof import('../api/client').apiFetch>()

let mockAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
let mockWalletNetwork: 'public' | 'test' | null = 'public'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => apiFetchMock(...args),
  }
})

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({ address: mockAddress, network: mockWalletNetwork }),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ network: 'public' }),
}))

const bondList = (id: string): BondList => ({
  items: [
    {
      id,
      borrower: mockAddress,
      amount: '100.00',
      asset: 'USDC',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
})

beforeEach(() => {
  apiFetchMock.mockReset()
  clearApiQueryCache()
  mockAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  mockWalletNetwork = 'public'
})

describe('useBonds', () => {
  it('fetches the typed bond list for the connected wallet', async () => {
    apiFetchMock.mockResolvedValueOnce(bondList('bond-1'))

    const { result } = renderHook(() => useBonds())

    await waitFor(() => expect(result.current.data).toHaveLength(1))

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/bonds?limit=100',
      expect.objectContaining({ identityEpoch: expect.any(Number) })
    )
    expect(result.current.data[0]?.id).toBe('bond-1')
  })

  it('does not expose cached data after the wallet identity changes', async () => {
    apiFetchMock
      .mockResolvedValueOnce(bondList('first-wallet-bond'))
      .mockResolvedValueOnce(bondList('second-wallet-bond'))

    const { result, rerender } = renderHook(() => useBonds())
    await waitFor(() => expect(result.current.data[0]?.id).toBe('first-wallet-bond'))

    act(() => {
      mockAddress = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
      rerender()
    })

    expect(result.current.data).toEqual([])
    await waitFor(() => expect(result.current.data[0]?.id).toBe('second-wallet-bond'))
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })
})
