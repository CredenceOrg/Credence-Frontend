/**
 * @file HeaderWallet.test.tsx
 *
 * Acceptance-criteria tests for the HeaderWallet container component.
 *
 * All hooks that touch real Freighter / Horizon / localStorage are mocked
 * so tests run deterministically in JSDOM without any browser extensions or
 * network access.
 *
 * Acceptance criteria (from issue #832):
 *  AC1 – Disconnected: renders "Connect wallet" button; clicking it opens the
 *        dialog (role="dialog"); after 1 s the demo address never appears.
 *  AC2 – isConnecting: true → aria-busy/connecting label is rendered.
 *  AC3 – Connected with balance 250.5 → shows friendly address & "250.5 USDC";
 *        "128.4 XLM" never appears.
 *  AC4 – Connected with balance status error → no balance text rendered.
 *  AC5 – Opening the menu and choosing Disconnect calls disconnect exactly once.
 *  AC6 – Settings network "test" → explorer link href contains
 *        "/explorer/testnet/account/".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import HeaderWallet from './HeaderWallet'
import { formatUsdc } from '../lib/format'
import { formatAddressForDisplay } from '../lib/stellar'
import * as WalletContextModule from '../context/WalletContext'
import * as SettingsContextModule from '../context/SettingsContext'
import * as UsdcBalanceModule from '../hooks/useUsdcBalance'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: vi.fn(),
}))

vi.mock('../hooks/useUsdcBalance', () => ({
  useUsdcBalance: vi.fn(),
}))

// Mock ConnectWalletDialog so we can assert it without pulling in the real
// Freighter / portal / focus-trap machinery.
vi.mock('./ConnectWalletDialog', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="Connect wallet dialog" data-testid="connect-wallet-dialog">
        <button onClick={onClose}>Close dialog</button>
      </div>
    ) : null,
}))

// ---------------------------------------------------------------------------
// Constants for tests
// ---------------------------------------------------------------------------

/** Real-looking Stellar address used across tests. */
const TEST_ADDRESS = 'GAABC123DEF456GAABC123DEF456GAABC123DEF456GAABC123DEFGHI'

const DEFAULT_DISCONNECT = vi.fn()

// ---------------------------------------------------------------------------
// Default mock implementations (overridden per suite where needed)
// ---------------------------------------------------------------------------

function mockDisconnected() {
  vi.mocked(WalletContextModule.useWallet).mockReturnValue({
    address: '',
    isConnected: false,
    isConnecting: false,
    error: null,
    connect: vi.fn(async () => {}),
    disconnect: DEFAULT_DISCONNECT,
    network: null,
    connected: false,
    lastReauthTime: null,
    reauth: vi.fn(async () => {}),
    isReauthRequired: vi.fn(() => false),
  })
}

function mockConnecting() {
  vi.mocked(WalletContextModule.useWallet).mockReturnValue({
    address: '',
    isConnected: false,
    isConnecting: true,
    error: null,
    connect: vi.fn(async () => {}),
    disconnect: DEFAULT_DISCONNECT,
    network: null,
    connected: false,
    lastReauthTime: null,
    reauth: vi.fn(async () => {}),
    isReauthRequired: vi.fn(() => false),
  })
}

function mockConnected(address = TEST_ADDRESS) {
  vi.mocked(WalletContextModule.useWallet).mockReturnValue({
    address,
    isConnected: true,
    isConnecting: false,
    error: null,
    connect: vi.fn(async () => {}),
    disconnect: DEFAULT_DISCONNECT,
    network: 'public',
    connected: true,
    lastReauthTime: Date.now(),
    reauth: vi.fn(async () => {}),
    isReauthRequired: vi.fn(() => false),
  })
}

function mockSettingsPublic() {
  vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
    network: 'public',
    themeMode: 'system',
    addressDisplay: 'friendly',
    toastsEnabled: true,
    autoDismiss: '5s',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    setThemeMode: vi.fn(),
    setNetwork: vi.fn(),
    setAddressDisplay: vi.fn(),
    setToastsEnabled: vi.fn(),
    setAutoDismiss: vi.fn(),
    setQuietHoursEnabled: vi.fn(),
    setQuietHoursStart: vi.fn(),
    setQuietHoursEnd: vi.fn(),
    saveSettings: vi.fn(),
    resetToDefaults: vi.fn(),
    cancelSettings: vi.fn(),
    hasUnsavedChanges: false,
  })
}

function mockSettingsTestnet() {
  vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
    network: 'test',
    themeMode: 'system',
    addressDisplay: 'friendly',
    toastsEnabled: true,
    autoDismiss: '5s',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    setThemeMode: vi.fn(),
    setNetwork: vi.fn(),
    setAddressDisplay: vi.fn(),
    setToastsEnabled: vi.fn(),
    setAutoDismiss: vi.fn(),
    setQuietHoursEnabled: vi.fn(),
    setQuietHoursStart: vi.fn(),
    setQuietHoursEnd: vi.fn(),
    saveSettings: vi.fn(),
    resetToDefaults: vi.fn(),
    cancelSettings: vi.fn(),
    hasUnsavedChanges: false,
  })
}

function mockBalanceReady(balance: number) {
  vi.mocked(UsdcBalanceModule.useUsdcBalance).mockReturnValue({
    balance,
    status: 'ready',
    error: null,
    refetch: vi.fn(),
    isReauthRequired: false,
  })
}

function mockBalanceLoading() {
  vi.mocked(UsdcBalanceModule.useUsdcBalance).mockReturnValue({
    balance: 0,
    status: 'loading',
    error: null,
    refetch: vi.fn(),
    isReauthRequired: false,
  })
}

function mockBalanceError() {
  vi.mocked(UsdcBalanceModule.useUsdcBalance).mockReturnValue({
    balance: 0,
    status: 'error',
    error: new Error('Horizon fetch failed'),
    refetch: vi.fn(),
    isReauthRequired: false,
  })
}

function mockBalanceIdle() {
  vi.mocked(UsdcBalanceModule.useUsdcBalance).mockReturnValue({
    balance: 0,
    status: 'idle',
    error: null,
    refetch: vi.fn(),
    isReauthRequired: false,
  })
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('HeaderWallet', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    DEFAULT_DISCONNECT.mockReset()
    // Set up sane defaults; individual tests override as needed
    mockDisconnected()
    mockSettingsPublic()
    mockBalanceIdle()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // AC1 — Disconnected state
  // -------------------------------------------------------------------------
  describe('AC1 – disconnected state', () => {
    it('renders a "Connect wallet" button', () => {
      render(<HeaderWallet />)
      expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
    })

    it('clicking Connect opens the dialog (role="dialog")', () => {
      render(<HeaderWallet />)
      fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('demo address never appears after 1 s in disconnected state', async () => {
      render(<HeaderWallet />)
      fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
      // The demo address from the old uncontrolled path must not appear
      expect(screen.queryByText(/GBRPYHIL/i)).not.toBeInTheDocument()
      // The dialog is still open (wallet context not actually connected)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render the demo balance "128.4 XLM"', () => {
      render(<HeaderWallet />)
      expect(screen.queryByText(/128\.4 XLM/)).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // AC2 — Connecting state
  // -------------------------------------------------------------------------
  describe('AC2 – connecting state', () => {
    it('renders a disabled button with connecting label when isConnecting=true', () => {
      mockConnecting()
      render(<HeaderWallet />)
      const btn = screen.getByRole('button', { name: /connecting/i })
      expect(btn).toBeDisabled()
    })

    it('does not open the dialog automatically when isConnecting', () => {
      mockConnecting()
      render(<HeaderWallet />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // AC3 — Connected with balance 250.5
  // -------------------------------------------------------------------------
  describe('AC3 – connected with balance', () => {
    beforeEach(() => {
      mockConnected(TEST_ADDRESS)
      mockBalanceReady(250.5)
    })

    it('shows the friendly-format address', () => {
      render(<HeaderWallet />)
      const friendly = formatAddressForDisplay(TEST_ADDRESS, 'friendly')
      expect(screen.getByText(friendly)).toBeInTheDocument()
    })

    it('shows the real USDC balance (250.5 USDC)', () => {
      render(<HeaderWallet />)
      const expectedBalance = formatUsdc(250.5)
      expect(screen.getByText(expectedBalance)).toBeInTheDocument()
    })

    it('"128.4 XLM" never appears when balance is real', () => {
      render(<HeaderWallet />)
      expect(screen.queryByText(/128\.4 XLM/)).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // AC4 — Connected with balance status error → no balance text
  // -------------------------------------------------------------------------
  describe('AC4 – connected with balance error', () => {
    beforeEach(() => {
      mockConnected(TEST_ADDRESS)
      mockBalanceError()
    })

    it('does not render any balance text when balance status is error', () => {
      render(<HeaderWallet />)
      // No USDC balance shown
      expect(screen.queryByText(/USDC/)).not.toBeInTheDocument()
    })

    it('"128.4 XLM" does not appear when balance has errored', () => {
      render(<HeaderWallet />)
      expect(screen.queryByText(/128\.4 XLM/)).not.toBeInTheDocument()
    })

    it('address is still shown even when balance errors', () => {
      render(<HeaderWallet />)
      const friendly = formatAddressForDisplay(TEST_ADDRESS, 'friendly')
      expect(screen.getByText(friendly)).toBeInTheDocument()
    })
  })

  // Also cover loading state — balance should not be shown
  describe('balance loading state', () => {
    beforeEach(() => {
      mockConnected(TEST_ADDRESS)
      mockBalanceLoading()
    })

    it('does not render balance text while loading', () => {
      render(<HeaderWallet />)
      expect(screen.queryByText(/USDC/)).not.toBeInTheDocument()
    })

    it('"128.4 XLM" does not appear while balance is loading', () => {
      render(<HeaderWallet />)
      expect(screen.queryByText(/128\.4 XLM/)).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // AC5 — Disconnect calls disconnect exactly once
  // -------------------------------------------------------------------------
  describe('AC5 – disconnect calls the real disconnect exactly once', () => {
    beforeEach(() => {
      mockConnected(TEST_ADDRESS)
      mockBalanceReady(250.5)
    })

    it('clicking Disconnect in the menu calls disconnect exactly once', () => {
      render(<HeaderWallet />)

      // Open the connected pill menu
      const trigger = screen.getByTestId('wallet-connected-trigger')
      fireEvent.click(trigger)

      // Click the Disconnect menu item
      const disconnectItem = screen.getByRole('menuitem', { name: /disconnect/i })
      fireEvent.click(disconnectItem)

      expect(DEFAULT_DISCONNECT).toHaveBeenCalledTimes(1)
    })

    it('does not call disconnect more than once on a single click', () => {
      render(<HeaderWallet />)

      fireEvent.click(screen.getByTestId('wallet-connected-trigger'))
      fireEvent.click(screen.getByRole('menuitem', { name: /disconnect/i }))

      expect(DEFAULT_DISCONNECT).not.toHaveBeenCalledTimes(2)
    })
  })

  // -------------------------------------------------------------------------
  // AC6 — Settings network "test" → explorer link uses testnet path
  // -------------------------------------------------------------------------
  describe('AC6 – settings network=test uses testnet explorer URL', () => {
    beforeEach(() => {
      mockConnected(TEST_ADDRESS)
      mockSettingsTestnet()
      mockBalanceReady(100)
    })

    it('explorer link href contains /explorer/testnet/account/', () => {
      render(<HeaderWallet />)

      // Open the menu to reveal the explorer link
      fireEvent.click(screen.getByTestId('wallet-connected-trigger'))

      const explorerLink = screen.getByRole('menuitem', { name: /view on explorer/i })
      expect(explorerLink).toHaveAttribute('href', expect.stringContaining('/explorer/testnet/account/'))
    })
  })

  // Also assert public network explorer URL
  describe('settings network=public uses public explorer URL', () => {
    beforeEach(() => {
      mockConnected(TEST_ADDRESS)
      mockSettingsPublic()
      mockBalanceReady(100)
    })

    it('explorer link href contains /explorer/public/account/', () => {
      render(<HeaderWallet />)

      fireEvent.click(screen.getByTestId('wallet-connected-trigger'))

      const explorerLink = screen.getByRole('menuitem', { name: /view on explorer/i })
      expect(explorerLink).toHaveAttribute('href', expect.stringContaining('/explorer/public/account/'))
    })
  })
})
