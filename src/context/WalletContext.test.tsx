import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletProvider, useWallet, useWalletContext } from './WalletContext'
import type { UseWalletState, WalletError } from '../hooks/useWallet'

/**
 * Shared, mutable mock surface. `vi.hoisted` runs before the module graph is
 * imported, so the `vi.mock` factories below can safely close over it.
 */
const h = vi.hoisted(() => ({
  state: {
    wallet: null as unknown as UseWalletState,
    settings: { network: 'public', reauthThresholdMinutes: 30 } as {
      network: string
      reauthThresholdMinutes: number
    },
    // Every render of WalletProvider invokes useIdleTimeout exactly twice
    // (session countdown, then warning countdown). Tests read the last two
    // entries to obtain the live options for the current render.
    idle: [] as Array<{
      timeoutMs: number
      onIdle: () => void
      onActivity?: () => void
    }>,
  },
  navigate: vi.fn(),
  addToast: vi.fn(),
  advanceIdentityEpoch: vi.fn(),
  clearAppLocalStorage: vi.fn(),
  emitWalletSessionEvent: vi.fn(),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ addToast: h.addToast }) }))
vi.mock('../api', () => ({
  advanceIdentityEpoch: (...args: unknown[]) => h.advanceIdentityEpoch(...args),
}))
vi.mock('../lib/clearAppLocalStorage', () => ({
  clearAppLocalStorage: () => h.clearAppLocalStorage(),
}))
vi.mock('./SettingsContext', () => ({ useSettings: () => h.state.settings }))
vi.mock('../hooks/useWallet', () => ({ useWallet: () => h.state.wallet }))
vi.mock('../hooks/useIdleTimeout', () => ({
  useIdleTimeout: (opts: {
    timeoutMs: number
    onIdle: () => void
    onActivity?: () => void
  }) => {
    h.state.idle.push(opts)
  },
}))
vi.mock('../lib/walletAudit', () => ({
  emitWalletSessionEvent: (...args: unknown[]) => h.emitWalletSessionEvent(...args),
  generateCorrelationId: () => 'corr-test',
}))
vi.mock('../components/SessionTimeoutDialog', () => ({
  default: ({
    open,
    onStayLoggedIn,
    onLogout,
    timeLeftSeconds,
  }: {
    open: boolean
    onStayLoggedIn: () => void
    onLogout: () => void
    timeLeftSeconds: number
  }) =>
    open ? (
      <div data-testid="session-dialog">
        <span data-testid="time-left">{timeLeftSeconds}</span>
        <button type="button" onClick={onStayLoggedIn}>
          stay
        </button>
        <button type="button" onClick={onLogout}>
          logout
        </button>
      </div>
    ) : null,
}))

function makeWallet(overrides: Partial<UseWalletState> = {}): UseWalletState {
  const wallet: UseWalletState = {
    address: '',
    isConnected: false,
    isConnecting: false,
    error: null as WalletError | null,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    network: 'public',
    ...overrides,
  }
  return wallet
}

/** The idle options for the current render: 0 = session, 1 = warning. */
function idle(phase: 0 | 1) {
  const last = h.state.idle.slice(-2)
  return last[phase]
}

function Consumer() {
  const wallet = useWalletContext()
  return (
    <div>
      <span data-testid="connected">{String(wallet.connected)}</span>
      <span data-testid="isConnected">{String(wallet.isConnected)}</span>
      <span data-testid="address">{wallet.address || 'none'}</span>
      <span data-testid="reauthTime">{wallet.lastReauthTime === null ? 'null' : 'set'}</span>
      <span data-testid="reauthRequired">{String(wallet.isReauthRequired())}</span>
      <button type="button" onClick={() => void wallet.connect()}>
        connect
      </button>
      <button type="button" onClick={() => wallet.disconnect()}>
        disconnect
      </button>
      <button type="button" onClick={() => void wallet.reauth()}>
        reauth
      </button>
    </div>
  )
}

function LegacyConsumer() {
  const wallet = useWallet()
  return <span data-testid="legacy-address">{wallet.address || 'none'}</span>
}

function Tree() {
  return (
    <WalletProvider>
      <Consumer />
    </WalletProvider>
  )
}

const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const WARNING_THRESHOLD_MS = 60 * 1000
const THRESHOLD_MINUTES = 30

describe('WalletProvider', () => {
  beforeEach(() => {
    h.state.wallet = makeWallet()
    h.state.settings = { network: 'public', reauthThresholdMinutes: THRESHOLD_MINUTES }
    h.state.idle = []
    h.navigate.mockReset()
    h.addToast.mockReset()
    h.advanceIdentityEpoch.mockReset()
    h.clearAppLocalStorage.mockReset()
    h.emitWalletSessionEvent.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('exposes the default disconnected state with the legacy connected alias', () => {
    render(<Tree />)

    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('isConnected')).toHaveTextContent('false')
    expect(screen.getByTestId('address')).toHaveTextContent('none')
    expect(screen.getByTestId('reauthTime')).toHaveTextContent('null')
    expect(screen.getByTestId('reauthRequired')).toHaveTextContent('true')
    expect(screen.queryByTestId('session-dialog')).toBeNull()
  })

  it('reflects a connected wallet and derives lastReauthTime from the connection', () => {
    h.state.wallet = makeWallet({ address: 'GABC', isConnected: true })

    render(<Tree />)

    expect(screen.getByTestId('connected')).toHaveTextContent('true')
    expect(screen.getByTestId('address')).toHaveTextContent('GABC')
    expect(screen.getByTestId('reauthTime')).toHaveTextContent('set')
    // Freshly connected — the configured threshold has not elapsed.
    expect(screen.getByTestId('reauthRequired')).toHaveTextContent('false')
  })

  it('flips isReauthRequired only once the configured threshold is reached', () => {
    const now = vi.spyOn(Date, 'now')
    const t0 = 1_000_000
    now.mockReturnValue(t0)
    h.state.wallet = makeWallet({ address: 'GABC', isConnected: true })

    const { rerender } = render(<Tree />)
    expect(screen.getByTestId('reauthRequired')).toHaveTextContent('false')

    // One millisecond before the threshold — still valid.
    now.mockReturnValue(t0 + THRESHOLD_MINUTES * 60_000 - 1)
    rerender(<Tree />)
    expect(screen.getByTestId('reauthRequired')).toHaveTextContent('false')

    // Exactly at the threshold — reauth is now required (boundary is inclusive).
    now.mockReturnValue(t0 + THRESHOLD_MINUTES * 60_000)
    rerender(<Tree />)
    expect(screen.getByTestId('reauthRequired')).toHaveTextContent('true')
  })

  it('reauth reconnects the wallet and refreshes the reauth timestamp', async () => {
    const wallet = makeWallet({
      connect: vi.fn(async () => {
        // Simulate a successful wallet handshake on the same object.
        h.state.wallet.isConnected = true
        h.state.wallet.address = 'GRECONNECTED'
      }),
    })
    h.state.wallet = wallet

    const { rerender } = render(<Tree />)
    expect(screen.getByTestId('reauthTime')).toHaveTextContent('null')

    await act(async () => {
      screen.getByRole('button', { name: 'reauth' }).click()
    })
    rerender(<Tree />)

    expect(wallet.connect).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('reauthTime')).toHaveTextContent('set')
    expect(screen.getByTestId('address')).toHaveTextContent('GRECONNECTED')
    expect(screen.getByTestId('reauthRequired')).toHaveTextContent('false')
  })

  it('disconnect clears the connection and the reauth timestamp', () => {
    const wallet = makeWallet({
      address: 'GABC',
      isConnected: true,
      disconnect: vi.fn(() => {
        h.state.wallet.isConnected = false
        h.state.wallet.address = ''
      }),
    })
    h.state.wallet = wallet

    const { rerender } = render(<Tree />)
    expect(screen.getByTestId('isConnected')).toHaveTextContent('true')

    act(() => {
      screen.getByRole('button', { name: 'disconnect' }).click()
    })
    rerender(<Tree />)

    expect(wallet.disconnect).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('isConnected')).toHaveTextContent('false')
    expect(screen.getByTestId('address')).toHaveTextContent('none')
    expect(screen.getByTestId('reauthTime')).toHaveTextContent('null')
    expect(screen.getByTestId('reauthRequired')).toHaveTextContent('true')
  })

  it('bounds the two idle timers by connection and warning state', () => {
    h.state.wallet = makeWallet({ address: 'GABC', isConnected: true })
    render(<Tree />)

    // Session countdown runs for the full window minus the warning window.
    expect(idle(0).timeoutMs).toBe(IDLE_TIMEOUT_MS - WARNING_THRESHOLD_MS)
    // The warning countdown is disarmed until the warning is shown.
    expect(idle(1).timeoutMs).toBe(0)

    act(() => idle(0).onIdle())

    // After the warning appears the final countdown is armed for 60s.
    expect(idle(1).timeoutMs).toBe(WARNING_THRESHOLD_MS)
  })

  it('never arms the idle timers while disconnected', () => {
    render(<Tree />)
    expect(idle(0).timeoutMs).toBe(0)
    expect(idle(1).timeoutMs).toBe(0)
  })

  it('does not raise the warning dialog when a disconnected wallet idles', () => {
    render(<Tree />)

    act(() => idle(0).onIdle())

    expect(screen.queryByTestId('session-dialog')).toBeNull()
  })

  it('shows the warning on idle and dismisses it on user activity', () => {
    h.state.wallet = makeWallet({ address: 'GABC', isConnected: true })
    render(<Tree />)

    act(() => idle(0).onIdle())
    expect(screen.getByTestId('session-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('time-left')).toHaveTextContent('60')

    act(() => idle(0).onActivity?.())
    expect(screen.queryByTestId('session-dialog')).toBeNull()
  })

  it('stays logged in when the user chooses to extend the session', () => {
    h.state.wallet = makeWallet({ address: 'GABC', isConnected: true })
    render(<Tree />)

    act(() => idle(0).onIdle())
    act(() => {
      screen.getByRole('button', { name: 'stay' }).click()
    })

    expect(screen.queryByTestId('session-dialog')).toBeNull()
    expect(h.advanceIdentityEpoch).not.toHaveBeenCalled()
    expect(h.clearAppLocalStorage).not.toHaveBeenCalled()
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('logs out on the final idle timeout: disconnects, clears storage, navigates, and toasts', () => {
    const wallet = makeWallet({
      address: 'GABC',
      isConnected: true,
      disconnect: vi.fn(() => {
        h.state.wallet.isConnected = false
        h.state.wallet.address = ''
      }),
    })
    h.state.wallet = wallet
    render(<Tree />)

    act(() => idle(0).onIdle())
    expect(screen.getByTestId('session-dialog')).toBeInTheDocument()

    act(() => idle(1).onIdle())

    expect(h.advanceIdentityEpoch).toHaveBeenCalledTimes(1)
    expect(wallet.disconnect).toHaveBeenCalledTimes(1)
    // Regression guard: clearAppLocalStorage must be imported and wired into
    // the logout path (previously referenced but never imported).
    expect(h.clearAppLocalStorage).toHaveBeenCalledTimes(1)
    expect(h.navigate).toHaveBeenCalledWith('/signin')
    expect(h.addToast).toHaveBeenCalledWith('warning', 'Logged out due to inactivity.')
    expect(h.emitWalletSessionEvent).toHaveBeenCalledWith(
      'session_expired',
      expect.objectContaining({
        // `reason` lives in the event metadata, not at the payload root.
        metadata: expect.objectContaining({ reason: 'inactivity' }),
      })
    )
  })

  it('exposes the same value through the legacy useWallet alias inside a provider', () => {
    h.state.wallet = makeWallet({ address: 'GABC', isConnected: true })

    render(
      <WalletProvider>
        <LegacyConsumer />
      </WalletProvider>
    )

    expect(screen.getByTestId('legacy-address')).toHaveTextContent('GABC')
  })

  it('returns the safe default state when consumed outside a provider', () => {
    render(<Consumer />)

    expect(screen.getByTestId('connected')).toHaveTextContent('false')
    expect(screen.getByTestId('address')).toHaveTextContent('none')
    expect(screen.getByTestId('reauthRequired')).toHaveTextContent('false')
  })
})
