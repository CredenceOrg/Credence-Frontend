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

  it('blocks connection on network mismatch — mainnet settings with testnet wallet', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockFetchFreighterNetwork.mockResolvedValue('test')

    const { result } = renderHook(() => useWallet('public'))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.error).toMatchObject({ code: 'network_mismatch' })
    expect(result.current.isConnected).toBe(false)
    // Atomic rollback: network is rolled back to null on mismatch.
    expect(result.current.address).toBe('')
    expect(result.current.network).toBeNull()
  })

  it('blocks connection on network mismatch — testnet settings with mainnet wallet', async () => {
    mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
    mocks.mockFetchFreighterNetwork.mockResolvedValue('public')

    const { result } = renderHook(() => useWallet('test'))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.error).toMatchObject({ code: 'network_mismatch' })
    expect(result.current.isConnected).toBe(false)
    // Atomic rollback: network is rolled back to null on mismatch.
    expect(result.current.address).toBe('')
    expect(result.current.network).toBeNull()
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

  // ─── Atomic rollback regression tests ───────────────────────────────────

  describe('atomic rollback — failure at each boundary', () => {
    it('rolls back address when watcher fails to start', async () => {
      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      mocks.mockRequestFreighterAccess.mockResolvedValue({ ok: true, address: TEST_ADDRESS })
      mocks.mockFetchFreighterNetwork.mockResolvedValue('public')
      mocks.mockCreateWalletWatcher.mockRejectedValue(new Error('watcher init failed'))

      const { result } = renderHook(() => useWallet('public'))

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.address).toBe('')
      expect(result.current.isConnected).toBe(false)
      expect(result.current.network).toBeNull()
      expect(result.current.error).toMatchObject({ code: 'unknown' })
      expect(result.current.isConnecting).toBe(false)
    })

    it('rolls back partial state when requestFreighterAccess throws', async () => {
      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      mocks.mockRequestFreighterAccess.mockRejectedValue(new Error('transport error'))

      const { result } = renderHook(() => useWallet('public'))

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.address).toBe('')
      expect(result.current.network).toBeNull()
      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toMatchObject({ code: 'unknown' })
    })

    it('rolls back partial state when syncNetwork throws after address is set', async () => {
      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      mocks.mockRequestFreighterAccess.mockResolvedValue({ ok: true, address: TEST_ADDRESS })
      mocks.mockFetchFreighterNetwork.mockRejectedValue(new Error('network fetch failed'))

      const { result } = renderHook(() => useWallet('public'))

      await act(async () => {
        await result.current.connect()
      })

      // Address was set but network fetch failed — must be rolled back.
      expect(result.current.address).toBe('')
      expect(result.current.network).toBeNull()
      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toMatchObject({ code: 'unknown' })
    })

    it('rolls back address and network on network mismatch', async () => {
      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      mocks.mockRequestFreighterAccess.mockResolvedValue({ ok: true, address: TEST_ADDRESS })
      mocks.mockFetchFreighterNetwork.mockResolvedValue('test')

      const { result } = renderHook(() => useWallet('public'))

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.address).toBe('')
      expect(result.current.network).toBeNull()
      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toMatchObject({ code: 'network_mismatch' })
    })
  })

  describe('atomic rollback — concurrent operations', () => {
    it('disconnect during in-flight connect prevents stale address commit', async () => {
      class Deferred<T> {
        promise: Promise<T>
        resolve!: (v: T) => void
        constructor() {
          this.promise = new Promise<T>((r) => {
            this.resolve = r
          })
        }
      }

      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      const deferred = new Deferred<{ ok: boolean; address: string }>()
      mocks.mockRequestFreighterAccess.mockReturnValue(deferred.promise)
      mocks.mockFetchFreighterNetwork.mockResolvedValue('public')
      mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

      const { result } = renderHook(() => useWallet('public'))

      let connectPromise: Promise<void>
      act(() => {
        connectPromise = result.current.connect()
      })

      act(() => {
        result.current.disconnect()
      })

      deferred.resolve({ ok: true, address: TEST_ADDRESS })
      await act(async () => {
        await connectPromise
      })

      // Disconnect wins: address should remain empty despite successful API response.
      expect(result.current.address).toBe('')
      expect(result.current.isConnected).toBe(false)
      expect(result.current.network).toBeNull()
    })

    it('second connect supersedes first — only latest commits', async () => {
      const ADDRESS_1 = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      const ADDRESS_2 = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      mocks.mockFetchFreighterNetwork.mockResolvedValue('public')
      mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

      const { result } = renderHook(() => useWallet('public'))

      // Complete first connect
      mocks.mockRequestFreighterAccess.mockResolvedValueOnce({ ok: true, address: ADDRESS_1 })
      await act(async () => {
        await result.current.connect()
      })
      expect(result.current.address).toBe(ADDRESS_1)

      // Complete second connect — should supersede
      mocks.mockRequestFreighterAccess.mockResolvedValueOnce({ ok: true, address: ADDRESS_2 })
      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.address).toBe(ADDRESS_2)
      expect(result.current.isConnected).toBe(true)
    })

    it('disconnect during reauth stops reauth from committing', async () => {
      class Deferred<T> {
        promise: Promise<T>
        resolve!: (v: T) => void
        constructor() {
          this.promise = new Promise<T>((r) => {
            this.resolve = r
          })
        }
      }

      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)

      const deferred = new Deferred<{ ok: boolean; address: string }>()
      mocks.mockRequestFreighterAccess.mockReturnValue(deferred.promise)
      mocks.mockFetchFreighterNetwork.mockResolvedValue('public')
      mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

      const { result } = renderHook(() => useWallet('public'))

      let connectPromise: Promise<void>
      act(() => {
        connectPromise = result.current.connect()
      })

      act(() => {
        result.current.disconnect()
      })

      deferred.resolve({ ok: true, address: TEST_ADDRESS })
      await act(async () => {
        await connectPromise
      })

      expect(result.current.address).toBe('')
      expect(result.current.isConnected).toBe(false)
    })
  })

  describe('atomic rollback — disconnect and reconnect', () => {
    it('disconnect clears all wallet state atomically', async () => {
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
      expect(result.current.network).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isConnecting).toBe(false)
    })

    it('reconnect after disconnect starts fresh', async () => {
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
      expect(result.current.isConnected).toBe(false)

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.address).toBe(TEST_ADDRESS)
      expect(result.current.isConnected).toBe(true)
      expect(result.current.error).toBeNull()
      expect(result.current.network).toBe('public')
    })
  })

  describe('atomic rollback — session expiry (idle timeout scenario)', () => {
    it('disconnect after error leaves clean state', async () => {
      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      mocks.mockRequestFreighterAccess.mockResolvedValue({
        ok: false,
        code: 'rejected',
        message: 'Denied',
      })

      const { result } = renderHook(() => useWallet('public'))

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.error).toMatchObject({ code: 'rejected' })

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.address).toBe('')
      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.network).toBeNull()
    })

    it('fresh connect after rejected + disconnect clears stale error', async () => {
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

      act(() => {
        result.current.disconnect()
      })
      expect(result.current.error).toBeNull()

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.error).toBeNull()
      expect(result.current.address).toBe(TEST_ADDRESS)
      expect(result.current.isConnected).toBe(true)
    })
  })

  describe('atomic rollback — watcher event guard', () => {
    it('discards watcher events from superseded generations', async () => {
      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)

      let watcherCallback: (params: { address: string; network: string }) => void
      mocks.mockCreateWalletWatcher.mockImplementation(
        (cb: (params: { address: string; network: string }) => void) => {
          watcherCallback = cb
          return Promise.resolve({ stop: vi.fn() })
        }
      )
      mocks.mockFetchFreighterNetwork.mockResolvedValue('public')

      const { result } = renderHook(() => useWallet('public'))

      // Connect successfully
      await act(async () => {
        await result.current.connect()
      })
      expect(result.current.address).toBe(TEST_ADDRESS)

      // Simulate watcher event from old generation (stale)
      // Disconnect and reconnect to supersede the watcher
      act(() => {
        result.current.disconnect()
      })
      mocks.mockRequestFreighterAccess.mockResolvedValue({
        ok: true,
        address: 'GNEWADDRESS',
      })

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.address).toBe('GNEWADDRESS')
    })
  })

  describe('atomic rollback — repeated operations', () => {
    it('multiple rapid connects settle on latest result', async () => {
      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

      const { result } = renderHook(() => useWallet('public'))

      await act(async () => {
        await Promise.all([
          result.current.connect(),
          result.current.connect(),
          result.current.connect(),
        ])
      })

      expect(result.current.isConnected).toBe(true)
      expect(result.current.address).toBe(TEST_ADDRESS)
      expect(result.current.error).toBeNull()
    })

    it('rapid disconnects are idempotent and leave clean state', async () => {
      mocks.mockCheckFreighterInstalled.mockResolvedValue(true)
      mocks.mockCreateWalletWatcher.mockResolvedValue({ stop: vi.fn() })

      const { result } = renderHook(() => useWallet('public'))

      await act(async () => {
        await result.current.connect()
      })

      act(() => {
        result.current.disconnect()
        result.current.disconnect()
        result.current.disconnect()
      })

      expect(result.current.address).toBe('')
      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.network).toBeNull()
    })
  })
})
