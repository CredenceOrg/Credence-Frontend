import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Home from './Home'

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  return {
    mockApiFetch: vi.fn(),
    mockRefetchTrust: vi.fn(),
    mockRefetchBalance: vi.fn(),
    walletState: {
      address: '',
      isConnected: false,
      isConnecting: false,
      error: null as Error | null,
    },
    trustState: {
      data: null as { address: string; score: number; tier: string } | null,
      isLoading: false,
      error: null as { message: string; status: number } | null,
    },
    balanceState: {
      balance: 0,
      status: 'idle' as 'idle' | 'loading' | 'ready' | 'error',
      error: null as Error | null,
    },
  }
})

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    ...mocks.walletState,
  }),
}))

vi.mock('../hooks/useUsdcBalance', () => ({
  useUsdcBalance: () => ({
    ...mocks.balanceState,
    refetch: mocks.mockRefetchBalance,
  }),
}))

vi.mock('../hooks/useTrustScore', () => ({
  useTrustScore: (_address: string) => ({
    ...mocks.trustState,
    refetch: mocks.mockRefetchTrust,
  }),
}))

vi.mock('../api/client', () => ({
  apiFetch: mocks.mockApiFetch,
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'ApiError'
      this.status = status
    }
  },
}))

// Mock @/lib/stellar so we don't need valid 56-char Stellar addresses
vi.mock('@/lib/stellar', () => ({
  isValidStellarAddress: (addr: string) => typeof addr === 'string' && addr.length > 0,
  formatAddressForDisplay: (addr: string, mode: string) => {
    if (!addr) return ''
    if (mode === 'friendly') return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
    if (mode === 'short') return addr.length > 20 ? `${addr.slice(0, 12)}...${addr.slice(-8)}` : addr
    return addr
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual }
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ADDR_A = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
const ADDR_B = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setDisconnected() {
  mocks.walletState.address = ''
  mocks.walletState.isConnected = false
  mocks.walletState.isConnecting = false
  mocks.trustState.data = null
  mocks.trustState.isLoading = false
  mocks.trustState.error = null
  mocks.balanceState.balance = 0
  mocks.balanceState.status = 'idle'
  mocks.balanceState.error = null
}

function setConnected(address = ADDR_A) {
  mocks.walletState.address = address
  mocks.walletState.isConnected = true
  mocks.walletState.isConnecting = false
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Home page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDisconnected()
  })

  // ── AC1: Disconnected view ─────────────────────────────────────────────

  describe('disconnected state', () => {
    it('renders the marketing hero heading', () => {
      renderHome()
      expect(
        screen.getByRole('heading', { name: /Credence — Economic Trust/i })
      ).toBeInTheDocument()
    })

    it('"Create bond" link navigates to /bond and has role link, not button', () => {
      renderHome()
      const link = screen.getByRole('link', { name: /create bond/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/bond')
      // Must NOT have role="button"
      expect(link).not.toHaveAttribute('role', 'button')
    })

    it('"View trust score" link navigates to /trust and has role link, not button', () => {
      renderHome()
      const link = screen.getByRole('link', { name: /view trust score/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/trust')
      expect(link).not.toHaveAttribute('role', 'button')
    })

    it('does not render the dashboard preview', () => {
      renderHome()
      expect(screen.queryByText(/connected wallet/i)).not.toBeInTheDocument()
    })

    it('does not render the wallet chip or stat grid', () => {
      renderHome()
      expect(screen.queryByText(/view transaction history/i)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/account overview/i)).not.toBeInTheDocument()
    })
  })

  // ── AC2: Connected, happy path ─────────────────────────────────────────

  describe('connected state — trust resolves { score: 610, tier: "gold" }, balance 1234.5', () => {
    beforeEach(() => {
      setConnected(ADDR_A)
      mocks.trustState.data = { address: ADDR_A, score: 610, tier: 'gold' }
      mocks.trustState.isLoading = false
      mocks.trustState.error = null
      mocks.balanceState.balance = 1234.5
      mocks.balanceState.status = 'ready'
      mocks.balanceState.error = null
    })

    it('shows the trust score number', () => {
      renderHome()
      expect(screen.getByText('610')).toBeInTheDocument()
    })

    it('shows the Gold badge', () => {
      renderHome()
      // Badge renders the tier label with first-letter uppercased
      expect(screen.getByText(/gold/i)).toBeInTheDocument()
    })

    it('shows the USDC balance formatted correctly', () => {
      renderHome()
      // formatUsdc(1234.5) → "1,234.5 USDC"
      expect(screen.getByText('1,234.5 USDC')).toBeInTheDocument()
    })

    it('calls useTrustScore refetch on mount (apiFetch wired via hook)', () => {
      renderHome()
      // useTrustScore.refetch was called in useEffect keyed on address
      expect(mocks.mockRefetchTrust).toHaveBeenCalledTimes(1)
    })

    it('shows the wallet chip with "Connected wallet" label', () => {
      renderHome()
      expect(screen.getByText(/connected wallet/i)).toBeInTheDocument()
    })

    it('shows the "View transaction history" footer link', () => {
      renderHome()
      const link = screen.getByRole('link', { name: /view transaction history/i })
      expect(link).toHaveAttribute('href', '/transactions')
    })

    it('shows a "View details" link pointing to /trust?address=', () => {
      renderHome()
      const link = screen.getByRole('link', { name: /view details/i })
      expect(link.getAttribute('href')).toContain('/trust?address=')
      expect(link.getAttribute('href')).toContain(encodeURIComponent(ADDR_A))
    })
  })

  // ── AC3: Trust error — balance still visible ───────────────────────────

  describe('connected state — trust request rejects', () => {
    beforeEach(() => {
      setConnected(ADDR_A)
      mocks.trustState.data = null
      mocks.trustState.isLoading = false
      mocks.trustState.error = { message: 'Network error', status: 0 }
      mocks.balanceState.balance = 999.0
      mocks.balanceState.status = 'ready'
      mocks.balanceState.error = null
    })

    it('shows "Try again" retry button in the trust card', () => {
      renderHome()
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('still shows the USDC balance in the balance card', () => {
      renderHome()
      expect(screen.getByText('999 USDC')).toBeInTheDocument()
    })

    it('calls refetchTrust when "Try again" is clicked', async () => {
      const user = userEvent.setup()
      renderHome()
      await user.click(screen.getByRole('button', { name: /try again/i }))
      // once from mount effect + once from click
      expect(mocks.mockRefetchTrust).toHaveBeenCalledTimes(2)
    })
  })

  // ── AC4: Address change A→B ────────────────────────────────────────────

  describe('address change A → B', () => {
    it('triggers a second trust refetch when address changes', async () => {
      setConnected(ADDR_A)
      mocks.trustState.data = { address: ADDR_A, score: 610, tier: 'gold' }
      mocks.trustState.isLoading = false
      mocks.trustState.error = null
      mocks.balanceState.balance = 100
      mocks.balanceState.status = 'ready'

      const { rerender } = render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      expect(mocks.mockRefetchTrust).toHaveBeenCalledTimes(1)

      // Switch to address B
      await act(async () => {
        mocks.walletState.address = ADDR_B
        mocks.trustState.data = null // cleared between address switch
        rerender(
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        )
      })

      await waitFor(() => {
        expect(mocks.mockRefetchTrust).toHaveBeenCalledTimes(2)
      })
    })

    it('does not show A score after switching to B', async () => {
      setConnected(ADDR_A)
      mocks.trustState.data = { address: ADDR_A, score: 610, tier: 'gold' }
      mocks.trustState.isLoading = false
      mocks.trustState.error = null
      mocks.balanceState.status = 'ready'

      const { rerender } = render(
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      )

      // Switch to B with cleared data
      await act(async () => {
        mocks.walletState.address = ADDR_B
        mocks.trustState.data = null
        mocks.trustState.isLoading = true
        rerender(
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        )
      })

      // Score 610 should no longer be visible
      expect(screen.queryByText('610')).not.toBeInTheDocument()
    })
  })

  // ── AC5: Balance loading → skeleton ───────────────────────────────────

  describe('balance loading state', () => {
    beforeEach(() => {
      setConnected(ADDR_A)
      mocks.trustState.data = null
      mocks.trustState.isLoading = false
      mocks.trustState.error = null
      mocks.balanceState.balance = 0
      mocks.balanceState.status = 'loading'
      mocks.balanceState.error = null
    })

    it('renders a loading skeleton in the balance card while balance is loading', () => {
      renderHome()
      // LoadingSkeleton renders role="status" with aria-label="Loading"
      const skeletons = screen.getAllByRole('status', { name: /loading/i })
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('does not show a USDC amount when balance is loading', () => {
      renderHome()
      // The formatted balance value (e.g. "0 USDC") should not be rendered —
      // only the skeleton placeholder. The label text "USDC balance" is fine.
      expect(screen.queryByText(/^\d[\d,.]* USDC$/)).not.toBeInTheDocument()
    })
  })
})
