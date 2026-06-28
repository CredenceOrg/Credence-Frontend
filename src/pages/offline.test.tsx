import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Layout from '../components/Layout'
import Bond from './Bond'
import TrustScore from './TrustScore'

// ── shared mocks ──────────────────────────────────────────────────────────────

vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }))
vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ network: 'public', setNetwork: vi.fn() }),
}))

let mockIsConnected = true
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    isConnected: mockIsConnected,
    address: mockIsConnected ? 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' : '',
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnecting: false,
    error: null,
    network: 'public',
  }),
}))
vi.mock('../hooks/useNetworkMismatch', () => ({
  useNetworkMismatch: () => ({ mismatch: false, expected: 'Public (Mainnet)', actual: '' }),
}))
vi.mock('../hooks/useTrustScore', () => ({
  useTrustScore: () => ({ data: null, isLoading: false, error: null, refetch: vi.fn() }),
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})
// AmountInput has a pre-existing bug (min is not defined) – stub it to avoid test contamination
vi.mock('../components/AmountInput', () => ({
  default: ({ disabled }: { disabled?: boolean }) => (
    <input data-testid="amount-input" disabled={disabled} />
  ),
}))

// ── helpers ───────────────────────────────────────────────────────────────────

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

function goOffline() {
  setOnline(false)
  act(() => { window.dispatchEvent(new Event('offline')) })
}

function goOnline() {
  setOnline(true)
  act(() => { window.dispatchEvent(new Event('online')) })
}

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div>Home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

function renderTrustScore() {
  return render(
    <MemoryRouter initialEntries={['/trust']}>
      <Routes>
        <Route path="/trust" element={<TrustScore />} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Layout offline banner ─────────────────────────────────────────────────────

describe('Layout offline banner', () => {
  beforeEach(() => {
    mockIsConnected = true
    setOnline(true)
  })

  it('does not show the offline banner when online', () => {
    renderLayout()
    expect(screen.queryByText(/network connection lost/i)).not.toBeInTheDocument()
  })

  it('shows the offline banner when the browser goes offline', () => {
    renderLayout()
    goOffline()
    expect(screen.getByText(/network connection lost/i)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('removes the offline banner when the browser comes back online', () => {
    renderLayout()
    goOffline()
    expect(screen.getByText(/network connection lost/i)).toBeInTheDocument()

    goOnline()
    expect(screen.queryByText(/network connection lost/i)).not.toBeInTheDocument()
  })
})

// ── Bond page ─────────────────────────────────────────────────────────────────

describe('Bond page when offline', () => {
  beforeEach(() => {
    mockIsConnected = true
    setOnline(true)
  })

  it('disables Create bond button when offline', () => {
    render(<Bond />)
    goOffline()
    const createBtn = screen.getByRole('button', { name: /create bond/i })
    expect(createBtn).toBeDisabled()
  })

  it('re-enables Create bond button when back online', () => {
    render(<Bond />)
    goOffline()
    goOnline()
    const createBtn = screen.getByRole('button', { name: /create bond/i })
    expect(createBtn).not.toBeDisabled()
  })

  it('disables Withdraw buttons when offline', () => {
    render(<Bond />)
    goOffline()
    const withdrawBtns = screen.getAllByRole('button', { name: /withdraw/i })
    withdrawBtns.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('shows offline banner on Bond page', () => {
    render(<Bond />)
    goOffline()
    expect(screen.getByText(/bond and withdrawal actions are disabled/i)).toBeInTheDocument()
  })
})

// ── TrustScore page ───────────────────────────────────────────────────────────

describe('TrustScore page when offline', () => {
  beforeEach(() => {
    // Use disconnected wallet so button disabled state depends only on isOnline
    // (disabled = networkMismatch || !isOnline || (connected ? !valid : false))
    mockIsConnected = false
    setOnline(true)
  })

  it('disables lookup button when offline', () => {
    renderTrustScore()
    goOffline()
    // disconnected + offline: button shows "Connect wallet to continue" and is disabled
    const btn = screen.getByRole('button', { name: /connect wallet to continue/i })
    expect(btn).toBeDisabled()
  })

  it('re-enables lookup button when back online', () => {
    renderTrustScore()
    goOffline()
    goOnline()
    // disconnected + online: button enabled (offline gate lifted)
    const btn = screen.getByRole('button', { name: /connect wallet to continue/i })
    expect(btn).not.toBeDisabled()
  })

  it('shows offline banner on TrustScore page', () => {
    renderTrustScore()
    goOffline()
    expect(screen.getByText(/trust score lookup is disabled/i)).toBeInTheDocument()
  })
})
