import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as freighter from '../test/__mocks__/freighter-api.stub'
import { resetFreighterModuleCache } from '../lib/freighterClient'
import { resetWalletAuditTrail, subscribeWalletSessionEvents } from '../lib/walletAudit'
import { useWallet } from './useWallet'

const A = 'GACCOUNT_A'
const B = 'GACCOUNT_B'
const KEY = 'credence:wallet-session'
type WalletUpdate = { address: string; network: string }
let notify: (state: WalletUpdate) => void

function persisted() {
  return JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
}

async function connect(settings = 'public') {
  const hook = renderHook(({ n }) => useWallet(n), { initialProps: { n: settings } })
  await act(async () => {
    await hook.result.current.connect()
  })
  return hook
}

describe('useWallet network and account synchronization', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetFreighterModuleCache()
    resetWalletAuditTrail()
    vi.spyOn(freighter, 'isConnected').mockResolvedValue({ isConnected: true })
    vi.spyOn(freighter, 'isAllowed').mockResolvedValue({ isAllowed: false })
    vi.spyOn(freighter, 'requestAccess').mockResolvedValue({ address: A, error: null })
    vi.spyOn(freighter, 'getAddress').mockResolvedValue({ address: A, error: null })
    vi.spyOn(freighter, 'getNetwork').mockResolvedValue({ network: 'PUBLIC', error: null })
    vi.spyOn(freighter.WatchWalletChanges.prototype, 'watch').mockImplementation((cb) => {
      notify = cb as typeof notify
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    window.localStorage.clear()
    resetWalletAuditTrail()
  })

  it('connects on testnet after settings change from public to test', async () => {
    vi.mocked(freighter.getNetwork).mockResolvedValue({ network: 'TESTNET', error: null })
    const hook = renderHook(({ n }) => useWallet(n), { initialProps: { n: 'public' } })
    hook.rerender({ n: 'test' })
    await act(async () => {
      await hook.result.current.connect()
    })
    expect(hook.result.current.isConnected).toBe(true)
    expect(hook.result.current.error).toBeNull()
    expect(persisted()).toMatchObject({ address: A, network: 'test' })
  })

  it('rejects testnet after settings change from test to public', async () => {
    vi.mocked(freighter.getNetwork).mockResolvedValue({ network: 'TESTNET', error: null })
    const hook = renderHook(({ n }) => useWallet(n), { initialProps: { n: 'test' } })
    hook.rerender({ n: 'public' })
    await act(async () => {
      await hook.result.current.connect()
    })
    expect(hook.result.current.error?.code).toBe('network_mismatch')
    expect(hook.result.current.isConnected).toBe(false)
  })

  it('persists watcher account changes and restores the new account after remount', async () => {
    const hook = await connect()
    act(() => notify({ address: B, network: 'PUBLIC' }))
    expect(persisted().address).toBe(B)
    hook.unmount()
    vi.mocked(freighter.isAllowed).mockResolvedValue({ isAllowed: true })
    vi.mocked(freighter.getAddress).mockResolvedValue({ address: B, error: null })
    const restored = renderHook(() => useWallet('public'))
    await waitFor(() => expect(restored.result.current.address).toBe(B))
    expect(restored.result.current.error).toBeNull()
  })

  it('keeps the address on watcher mismatch and clears the error when networks match again', async () => {
    const hook = await connect()
    act(() => notify({ address: A, network: 'TESTNET' }))
    expect(hook.result.current.error?.code).toBe('network_mismatch')
    expect(hook.result.current.address).toBe(A)
    expect(persisted()).toMatchObject({ address: A, network: 'test' })
    act(() => notify({ address: A, network: 'PUBLIC' }))
    expect(hook.result.current.error).toBeNull()
    expect(persisted().network).toBe('public')
  })

  it('revalidates settings changes immediately without reconnecting or restarting the watcher', async () => {
    const hook = await connect()
    hook.rerender({ n: 'test' })
    expect(hook.result.current.error?.code).toBe('network_mismatch')
    expect(hook.result.current.address).toBe(A)
    hook.rerender({ n: 'public' })
    expect(hook.result.current.error).toBeNull()
    expect(freighter.requestAccess).toHaveBeenCalledTimes(1)
    expect(freighter.WatchWalletChanges.prototype.watch).toHaveBeenCalledTimes(1)
  })

  it('restores the currently allowed account and live network instead of stale storage', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, address: A, network: 'test' }))
    vi.mocked(freighter.isAllowed).mockResolvedValue({ isAllowed: true })
    vi.mocked(freighter.getAddress).mockResolvedValue({ address: B, error: null })
    const hook = renderHook(() => useWallet('public'))
    await waitFor(() => expect(hook.result.current.address).toBe(B))
    expect(hook.result.current.error).toBeNull()
    expect(persisted()).toMatchObject({ address: B, network: 'public' })
  })

  it('uses current settings when an asynchronous restore completes', async () => {
    let resolveNetwork!: (value: { network: string; error: null }) => void
    vi.mocked(freighter.isAllowed).mockResolvedValue({ isAllowed: true })
    vi.mocked(freighter.getNetwork).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNetwork = resolve
        })
    )
    const hook = renderHook(({ n }) => useWallet(n), { initialProps: { n: 'public' } })
    await waitFor(() => expect(freighter.getNetwork).toHaveBeenCalled())
    hook.rerender({ n: 'test' })
    await act(async () => {
      resolveNetwork({ network: 'TESTNET', error: null })
    })
    expect(hook.result.current.address).toBe(A)
    expect(hook.result.current.error).toBeNull()
  })

  it('preserves a restored address on mismatch so switching settings recovers it', async () => {
    vi.mocked(freighter.isAllowed).mockResolvedValue({ isAllowed: true })
    const hook = renderHook(({ n }) => useWallet(n), { initialProps: { n: 'test' } })
    await waitFor(() => expect(hook.result.current.error?.code).toBe('network_mismatch'))
    expect(hook.result.current.address).toBe(A)
    hook.rerender({ n: 'public' })
    expect(hook.result.current.error).toBeNull()
  })

  it('refreshes and persists both account and network on focus and clears a resolved mismatch', async () => {
    const hook = await connect()
    vi.mocked(freighter.isAllowed).mockResolvedValue({ isAllowed: true })
    vi.mocked(freighter.getAddress).mockResolvedValue({ address: B, error: null })
    vi.mocked(freighter.getNetwork).mockResolvedValue({ network: 'TESTNET', error: null })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(hook.result.current.address).toBe(B)
    expect(hook.result.current.error?.code).toBe('network_mismatch')
    expect(persisted()).toMatchObject({ address: B, network: 'test' })
    vi.mocked(freighter.getNetwork).mockResolvedValue({ network: 'PUBLIC', error: null })
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(hook.result.current.error).toBeNull()
    expect(persisted().network).toBe('public')
  })

  it('persists changes before emitting account and network audit events, without duplicates', async () => {
    await connect()
    const observed: { type: string; session: unknown }[] = []
    const unsubscribe = subscribeWalletSessionEvents((event) => {
      if (event.type === 'account_changed' || event.type === 'network_changed') {
        observed.push({ type: event.type, session: persisted() })
      }
    })
    act(() => notify({ address: B, network: 'TESTNET' }))
    act(() => notify({ address: B, network: 'TESTNET' }))
    unsubscribe()
    expect(observed).toMatchObject([
      { type: 'account_changed', session: { address: B, network: 'test' } },
      { type: 'network_changed', session: { address: B, network: 'test' } },
    ])
  })
})
