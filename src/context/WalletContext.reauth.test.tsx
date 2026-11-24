import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletProvider, useWalletContext, type WalletContextValue } from './WalletContext'
import type { UseWalletState } from '../hooks/useWallet'
import { fetchFreighterAddress, requestFreighterAccess } from '../lib/freighterClient'

const h = vi.hoisted(() => ({
  wallet: null as unknown as UseWalletState,
  idle: [] as Array<{ onIdle: () => void }>,
  addToast: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ addToast: h.addToast }) }))
vi.mock('../api', () => ({ advanceIdentityEpoch: vi.fn() }))
vi.mock('../lib/clearAppLocalStorage', () => ({ clearAppLocalStorage: vi.fn() }))
vi.mock('./SettingsContext', () => ({ useSettings: () => ({ network: 'public' }) }))
vi.mock('../hooks/useWallet', () => ({ useWallet: () => h.wallet }))
vi.mock('../hooks/useIdleTimeout', () => ({
  useIdleTimeout: (options: { onIdle: () => void }) => h.idle.push(options),
}))
vi.mock('../lib/walletAudit', () => ({
  emitWalletSessionEvent: vi.fn(),
  generateCorrelationId: () => 'test-correlation',
}))
vi.mock('../components/SessionTimeoutDialog', () => ({
  default: () => null,
}))
vi.mock('../hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }))
vi.mock('../hooks/useScrollPreserver', () => ({ useScrollPreserver: vi.fn() }))
vi.mock('../lib/freighterClient', () => ({
  fetchFreighterAddress: vi.fn(),
  requestFreighterAccess: vi.fn(),
}))

let wallet: WalletContextValue

function Consumer() {
  wallet = useWalletContext()
  return (
    <>
      <span data-testid="reauth-time">{wallet.lastReauthTime ?? 'null'}</span>
      <span data-testid="reauth-required">{String(wallet.isReauthRequired())}</span>
    </>
  )
}

function renderProvider() {
  return render(
    <WalletProvider>
      <Consumer />
    </WalletProvider>
  )
}

function makeWallet(overrides: Partial<UseWalletState> = {}): UseWalletState {
  return {
    address: 'GSESSION',
    isConnected: true,
    isConnecting: false,
    error: null,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(() => {
      h.wallet.isConnected = false
      h.wallet.address = ''
    }),
    network: 'public',
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-19T10:00:00Z'))
  h.wallet = makeWallet()
  h.idle = []
  h.addToast.mockReset()
  vi.mocked(requestFreighterAccess).mockReset()
  vi.mocked(fetchFreighterAddress).mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('WalletProvider re-authentication', () => {
  it('opens the prompt and refreshes the session after Freighter verifies the same account', async () => {
    renderProvider()
    const originalTime = wallet.lastReauthTime
    vi.setSystemTime(Date.now() + 16 * 60_000)
    vi.mocked(requestFreighterAccess).mockResolvedValue({ ok: true, address: 'GSESSION' })
    vi.mocked(fetchFreighterAddress).mockResolvedValue('GSESSION')

    let result!: Promise<boolean>
    act(() => {
      result = wallet.requestReauth()
    })

    expect(screen.getByRole('dialog', { name: /re-?authenticate/i })).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconnect wallet/i }))
      expect(await result).toBe(true)
    })

    expect(wallet.lastReauthTime).toBe(Date.now())
    expect(wallet.lastReauthTime).toBeGreaterThan(originalTime!)
    expect(wallet.isReauthRequired()).toBe(false)
  })

  it('keeps the gate and timestamp unchanged when Freighter rejects the prompt', async () => {
    renderProvider()
    const originalTime = wallet.lastReauthTime
    vi.setSystemTime(Date.now() + 16 * 60_000)
    vi.mocked(requestFreighterAccess).mockResolvedValue({
      ok: false,
      code: 'rejected',
      message: 'Request rejected',
    })

    let result!: Promise<boolean>
    act(() => {
      result = wallet.requestReauth()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconnect wallet/i }))
      expect(await result).toBe(false)
    })

    expect(wallet.lastReauthTime).toBe(originalTime)
    expect(wallet.isReauthRequired()).toBe(true)
  })

  it('does not refresh the timestamp when direct reauth is rejected while connected', async () => {
    renderProvider()
    const originalTime = wallet.lastReauthTime
    vi.setSystemTime(Date.now() + 16 * 60_000)
    vi.mocked(requestFreighterAccess).mockResolvedValue({
      ok: false,
      code: 'rejected',
      message: 'Request rejected',
    })

    await act(async () => {
      expect(await wallet.reauth()).toBe(false)
    })

    expect(wallet.lastReauthTime).toBe(originalTime)
    expect(wallet.isReauthRequired()).toBe(true)
  })

  it('invalidates an in-flight reauth when idle logout occurs', async () => {
    renderProvider()
    const originalTime = wallet.lastReauthTime
    let resolveAccess!: (value: Awaited<ReturnType<typeof requestFreighterAccess>>) => void
    vi.mocked(requestFreighterAccess).mockReturnValue(
      new Promise((resolve) => {
        resolveAccess = resolve
      })
    )
    vi.mocked(fetchFreighterAddress).mockResolvedValue('GSESSION')

    let result!: Promise<boolean>
    act(() => {
      result = wallet.reauth()
    })
    act(() => h.idle.slice(-2)[0].onIdle())
    act(() => h.idle.slice(-2)[1].onIdle())
    expect(wallet.lastReauthTime).toBeNull()

    await act(async () => {
      resolveAccess({ ok: true, address: 'GSESSION' })
      expect(await result).toBe(false)
    })

    expect(wallet.lastReauthTime).toBeNull()
    expect(wallet.lastReauthTime).not.toBe(originalTime)
  })

  it('disconnects the session if Freighter reports a different account', async () => {
    const disconnect = vi.fn(() => {
      h.wallet.isConnected = false
      h.wallet.address = ''
    })
    h.wallet = makeWallet({ disconnect })
    renderProvider()
    vi.setSystemTime(Date.now() + 16 * 60_000)
    vi.mocked(requestFreighterAccess).mockResolvedValue({ ok: true, address: 'GOTHER' })
    vi.mocked(fetchFreighterAddress).mockResolvedValue('GOTHER')

    await act(async () => {
      expect(await wallet.reauth()).toBe(false)
    })

    expect(disconnect).toHaveBeenCalledOnce()
    expect(h.wallet.isConnected).toBe(false)
  })
})
