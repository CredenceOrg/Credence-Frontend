import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUsdcBalance } from './useUsdcBalance'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  class MockHorizonError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'HorizonError'
      this.status = status
    }
  }

  return {
    MockHorizonError,
    mockFetchUsdcBalance: vi.fn<(address: string, network: string, signal?: AbortSignal) => Promise<number>>(),
    mockUseWallet: vi.fn(),
    mockUseSettings: vi.fn(),
  }
})

vi.mock('../lib/horizon', () => ({
  fetchUsdcBalance: mocks.mockFetchUsdcBalance,
  HorizonError: mocks.MockHorizonError,
}))

vi.mock('../context/WalletContext', () => ({
  useWallet: mocks.mockUseWallet,
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: mocks.mockUseSettings,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setConnected(address = TEST_ADDRESS, network: 'public' | 'test' = 'public') {
  mocks.mockUseWallet.mockReturnValue({
    address,
    isConnected: Boolean(address),
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    network,
  })
  mocks.mockUseSettings.mockReturnValue({
    network,
  })
}

function setDisconnected() {
  mocks.mockUseWallet.mockReturnValue({
    address: '',
    isConnected: false,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    network: null,
  })
  mocks.mockUseSettings.mockReturnValue({
    network: 'public',
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUsdcBalance', () => {
  beforeEach(() => {
    mocks.mockFetchUsdcBalance.mockReset()
    setConnected()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns idle status with balance 0 when disconnected', () => {
    setDisconnected()

    const { result } = renderHook(() => useUsdcBalance())

    expect(result.current.balance).toBe(0)
    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })

  it('does not fetch when disconnected', async () => {
    setDisconnected()

    renderHook(() => useUsdcBalance())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mocks.mockFetchUsdcBalance).not.toHaveBeenCalled()
  })

  it('auto-fetches on mount when connected', async () => {
    mocks.mockFetchUsdcBalance.mockResolvedValueOnce(1234.5)

    const { result } = renderHook(() => useUsdcBalance())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.balance).toBe(1234.5)
    expect(result.current.error).toBeNull()
    expect(mocks.mockFetchUsdcBalance).toHaveBeenCalledWith(
      TEST_ADDRESS,
      'public',
      expect.any(AbortSignal)
    )
  })

  it('shows loading status while fetching', async () => {
    const pending = deferred<number>()
    mocks.mockFetchUsdcBalance.mockReturnValueOnce(pending.promise)

    const { result } = renderHook(() => useUsdcBalance())

    expect(result.current.status).toBe('loading')
    expect(result.current.balance).toBe(0)

    await act(async () => {
      pending.resolve(500)
      await pending.promise
    })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.balance).toBe(500)
  })

  it('returns error status on Horizon failure', async () => {
    mocks.mockFetchUsdcBalance.mockRejectedValueOnce(new mocks.MockHorizonError(500, 'Server error'))

    const { result } = renderHook(() => useUsdcBalance())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    expect(result.current.balance).toBe(0)
    expect(result.current.error).toBeInstanceOf(mocks.MockHorizonError)
  })

  it('returns balance 0 when account has no USDC trustline', async () => {
    mocks.mockFetchUsdcBalance.mockResolvedValueOnce(0)

    const { result } = renderHook(() => useUsdcBalance())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.balance).toBe(0)
    expect(result.current.error).toBeNull()
  })

  it('retries via refetch after error', async () => {
    mocks.mockFetchUsdcBalance
      .mockRejectedValueOnce(new mocks.MockHorizonError(500, 'Server error'))
      .mockResolvedValueOnce(750)

    const { result } = renderHook(() => useUsdcBalance())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.balance).toBe(750)
    expect(result.current.error).toBeNull()
    expect(mocks.mockFetchUsdcBalance).toHaveBeenCalledTimes(2)
  })

  it('aborts in-flight request on unmount', async () => {
    const pending = deferred<number>()
    mocks.mockFetchUsdcBalance.mockReturnValueOnce(pending.promise)

    const { unmount } = renderHook(() => useUsdcBalance())

    const signal = mocks.mockFetchUsdcBalance.mock.calls[0]?.[2] as AbortSignal
    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })

  it('re-fetches when address changes', async () => {
    mocks.mockFetchUsdcBalance.mockResolvedValueOnce(100)

    const { result, rerender } = renderHook(() => useUsdcBalance())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(mocks.mockFetchUsdcBalance).toHaveBeenCalledTimes(1)

    const NEW_ADDRESS = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
    mocks.mockFetchUsdcBalance.mockResolvedValueOnce(200)
    setConnected(NEW_ADDRESS)

    rerender()

    await waitFor(() => {
      expect(result.current.balance).toBe(200)
    })

    expect(mocks.mockFetchUsdcBalance).toHaveBeenCalledTimes(2)
    expect(mocks.mockFetchUsdcBalance).toHaveBeenCalledWith(
      NEW_ADDRESS,
      'public',
      expect.any(AbortSignal)
    )
  })

  it('re-fetches when network changes', async () => {
    mocks.mockFetchUsdcBalance.mockResolvedValueOnce(100)

    const { result, rerender } = renderHook(() => useUsdcBalance())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    mocks.mockFetchUsdcBalance.mockResolvedValueOnce(300)
    setConnected(TEST_ADDRESS, 'test')

    rerender()

    await waitFor(() => {
      expect(result.current.balance).toBe(300)
    })

    expect(mocks.mockFetchUsdcBalance).toHaveBeenCalledWith(
      TEST_ADDRESS,
      'test',
      expect.any(AbortSignal)
    )
  })

  it('does not call refetch when disconnected', async () => {
    setDisconnected()

    const { result } = renderHook(() => useUsdcBalance())

    await act(async () => {
      result.current.refetch()
    })

    expect(mocks.mockFetchUsdcBalance).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('wraps unexpected thrown values in Error', async () => {
    mocks.mockFetchUsdcBalance.mockRejectedValueOnce('unexpected')

    const { result } = renderHook(() => useUsdcBalance())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Unexpected error while fetching USDC balance')
  })
})
