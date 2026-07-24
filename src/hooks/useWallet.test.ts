import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWallet } from './useWallet'

const mocks = vi.hoisted(() => ({
  mockCheckFreighterInstalled: vi.fn(),
  mockRequestFreighterAccess: vi.fn(),
  mockFetchFreighterAddress: vi.fn(),
  mockFetchFreighterNetwork: vi.fn(),
  mockCreateWalletWatcher: vi.fn(),
}))

vi.mock('../lib/freighterClient', () => ({
  checkFreighterInstalled: mocks.mockCheckFreighterInstalled,
  requestFreighterAccess: mocks.mockRequestFreighterAccess,
  fetchFreighterAddress: mocks.mockFetchFreighterAddress,
  fetchFreighterNetwork: mocks.mockFetchFreighterNetwork,
  createWalletWatcher: mocks.mockCreateWalletWatcher,
}))

const TEST_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

describe('useWallet', () => {
  beforeEach(() => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(false)
    mocks.mockRequestFreighterAccess.mockResolvedValue({ ok: true, address: TEST_ADDRESS })
    mocks.mockFetchFreighterAddress.mockResolvedValue(null)
    mocks.mockFetchFreighterNetwork.mockResolvedValue('public')
    mocks.mockCreateWalletWatcher.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts in disconnected state', async () => {
    const { result } = renderHook(() => useWallet('public'))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false)
    })

    expect(result.current.address).toBe('')
    expect(result.current.isConnecting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.network).toBeNull()
  })

  it('connect populates address and isConnected', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

    const { result } = renderHook(() => useWallet('public'))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.address).toBe(TEST_ADDRESS)
    expect(result.current.isConnected).toBe(true)
    expect(result.current.isConnecting).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('disconnect clears address and error', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

    const { result } = renderHook(() => useWallet('public'))

    await act(async () => {
      await result.current.connect()
    })
    expect(result.current.isConnected).toBe(true)

    act(() => {
      result.current.disconnect()
    })

    expect(result.current.address).toBe('')
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isConnecting).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('surfaces not_installed error when Freighter is absent', async () => {
    const { result } = renderHook(() => useWallet('public'))

    await act(async () => {
      await result.current.connect()
    })

    expect(mocks.mockCheckFreighterInstalled).toHaveBeenCalled()
    expect(result.current.error).toMatchObject({ code: 'not_installed' })
    expect(result.current.isConnected).toBe(false)
  })

  it('surfaces rejected error when user denies access', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockRequestFreighterAccess.mockResolvedValue({
      ok: false,
      code: 'rejected',
      message: 'Connection request was rejected.',
    })

    const { result } = renderHook(() => useWallet('public'))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.error).toMatchObject({ code: 'rejected' })
    expect(result.current.isConnected).toBe(false)
  })

  it('does not block connection on network mismatch and reports actual network', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockFetchFreighterNetwork.mockResolvedValue('test')

    const { result } = renderHook(() => useWallet('public'))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.isConnected).toBe(true)
    expect(result.current.address).toBe(TEST_ADDRESS)
    expect(result.current.network).toBe('test')
  })

  it('surfaces unknown error when client throws', async () => {
    const { result } = renderHook(() => useWallet('public'))

    await waitFor(() => {
      expect(mocks.mockCheckFreighterInstalled).toHaveBeenCalledTimes(1)
    })

    mocks.mockCheckFreighterInstalled.mockRejectedValue(new Error('Network down'))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.error).toMatchObject({ code: 'unknown' })
    expect(result.current.isConnected).toBe(false)
    expect(result.current.isConnecting).toBe(false)
  })

  it('connect while already connected is idempotent', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

    const { result } = renderHook(() => useWallet('public'))

    await act(async () => {
      await result.current.connect()
    })
    expect(result.current.isConnected).toBe(true)

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.isConnected).toBe(true)
    expect(result.current.address).toBe(TEST_ADDRESS)
    expect(mocks.mockRequestFreighterAccess).toHaveBeenCalledTimes(2)
  })

  it('disconnect while disconnected is idempotent', async () => {
    const { result } = renderHook(() => useWallet('public'))
    await waitFor(() => {
      expect(result.current.isConnected).toBe(false)
    })

    expect(() => {
      act(() => {
        result.current.disconnect()
      })
    }).not.toThrow()

    expect(result.current.address).toBe('')
    expect(result.current.isConnected).toBe(false)
  })

  it('clears error on retry after a rejection', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockRequestFreighterAccess
      .mockResolvedValueOnce({ ok: false, code: 'rejected', message: 'Denied' })
      .mockResolvedValueOnce({ ok: true, address: TEST_ADDRESS })
    mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

    const { result } = renderHook(() => useWallet('public'))

    await act(async () => {
      await result.current.connect()
    })
    expect(result.current.error).toMatchObject({ code: 'rejected' })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.isConnected).toBe(true)
    expect(result.current.address).toBe(TEST_ADDRESS)
  })

  it('reports network as test when settingsNetwork is test', async () => {
    const { result } = renderHook(() => useWallet('test'))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false)
    })

    expect(result.current.network).toBeNull()
  })

  it('restores prior session on mount when already connected', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockFetchFreighterAddress.mockResolvedValue(TEST_ADDRESS)
    mocks.mockFetchFreighterNetwork.mockResolvedValue('public')
    mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

    const { result } = renderHook(() => useWallet('public'))

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    expect(result.current.address).toBe(TEST_ADDRESS)
    expect(result.current.error).toBeNull()
  })
})
