import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Bond from './Bond'

const mockAddToast = vi.fn()
const mockConnect = vi.fn()
const mockNavigate = vi.fn()
const mockSetNetwork = vi.fn()

let mockConnected = true
let mockAppNetwork: 'public' | 'test' = 'public'
let mockWalletNetwork: 'public' | 'test' | null = 'public'
let mockNetworkMismatch = {
  mismatch: false,
  expected: 'Public (Mainnet)',
  actual: '',
}

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    network: mockAppNetwork,
    setNetwork: mockSetNetwork,
  }),
}))

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    isConnected: mockConnected,
    address: mockConnected ? 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' : '',
    connect: mockConnect,
    disconnect: vi.fn(),
    isConnecting: false,
    error: null,
    network: mockWalletNetwork,
  }),
}))

vi.mock('../hooks/useNetworkMismatch', () => ({
  useNetworkMismatch: () => mockNetworkMismatch,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to, style }: { children: React.ReactNode; to: string; style?: React.CSSProperties }) => (
    <a href={to} style={style}>
      {children}
    </a>
  ),
}))

vi.mock('../components/ConfirmDialog', () => ({
  default: vi.fn(() => null),
}))

describe('Bond Page', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
    mockConnect.mockClear()
    mockNavigate.mockClear()
    mockSetNetwork.mockClear()
    mockConnected = true
    mockAppNetwork = 'public'
    mockWalletNetwork = 'public'
    mockNetworkMismatch = {
      mismatch: false,
      expected: 'Public (Mainnet)',
      actual: '',
    }
  })

  it('renders the page header and description', () => {
    render(<Bond />)
    expect(screen.getByRole('heading', { name: /Bond USDC/i })).toBeInTheDocument()
    expect(screen.getByText(/Lock USDC into the Credence contract/i)).toBeInTheDocument()
  })

  it('renders seeded bond rows (locked, grace-period, active)', () => {
    render(<Bond />)
    expect(screen.getAllByText('1,000 USDC').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('500 USDC').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('750 USDC').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Show penalty buttons for locked and grace-period bonds only', () => {
    render(<Bond />)
    const penaltyBtns = screen.getAllByRole('button', { name: /show penalty/i })
    expect(penaltyBtns).toHaveLength(2)
  })

  it('shows No early-withdrawal penalty for the active bond', () => {
    render(<Bond />)
    expect(screen.getByText(/No early-withdrawal penalty/i)).toBeInTheDocument()
  })

  it('disclosure starts collapsed (aria-expanded=false)', () => {
    render(<Bond />)
    const [firstBtn] = screen.getAllByRole('button', { name: /show penalty/i })
    expect(firstBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles disclosure open and updates aria-expanded', async () => {
    const user = userEvent.setup()
    render(<Bond />)
    const [firstBtn] = screen.getAllByRole('button', { name: /show penalty/i })
    await user.click(firstBtn)
    expect(firstBtn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /hide penalty/i })).toBeInTheDocument()
  })

  it('disclosure panel is reachable via aria-controls', async () => {
    const user = userEvent.setup()
    render(<Bond />)
    const [firstBtn] = screen.getAllByRole('button', { name: /show penalty/i })
    const panelId = firstBtn.getAttribute('aria-controls')!
    await user.click(firstBtn)
    expect(document.getElementById(panelId)).toBeVisible()
  })

  it('locked bond breakdown shows 20% penalty and correct values', async () => {
    const user = userEvent.setup()
    render(<Bond />)
    // bond #1 is locked: 1000 USDC, 20% penalty → 200 USDC penalty, 800 USDC received
    const [lockedBtn] = screen.getAllByRole('button', { name: /show penalty/i })
    await user.click(lockedBtn)
    expect(screen.getByText('Penalty (20%)')).toBeInTheDocument()
    expect(screen.getByText(/− 200 USDC/i)).toBeInTheDocument()
    expect(screen.getAllByText('800 USDC').length).toBeGreaterThanOrEqual(1)
  })

  it('grace-period bond breakdown shows 10% penalty and correct values', async () => {
    const user = userEvent.setup()
    render(<Bond />)
    // bond #2 is grace-period: 500 USDC, 10% penalty → 50 USDC penalty, 450 USDC received
    const penaltyBtns = screen.getAllByRole('button', { name: /show penalty/i })
    await user.click(penaltyBtns[1])
    expect(screen.getByText('Penalty (10%)')).toBeInTheDocument()
    expect(screen.getByText(/− 50 USDC/i)).toBeInTheDocument()
    expect(screen.getAllByText('450 USDC').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the Create New Bond card with a create bond button when connected', () => {
    render(<Bond />)
    expect(screen.getByRole('button', { name: /^Create bond$/i })).toBeInTheDocument()
  })

  it('navigates to /bond/new when Create bond is clicked while connected', async () => {
    const user = userEvent.setup()
    render(<Bond />)
    await user.click(screen.getByRole('button', { name: /^Create bond$/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/bond/new')
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('calls connect when Create bond is clicked while disconnected', async () => {
    const user = userEvent.setup()
    mockConnected = false
    render(<Bond />)
    await user.click(screen.getByRole('button', { name: /connect wallet to continue/i }))
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows wallet gating banner when disconnected', () => {
    mockConnected = false
    render(<Bond />)
    expect(
      screen.getByText(/Create bond and withdraw actions require a connected Stellar wallet/i)
    ).toBeInTheDocument()
  })

  it('shows a warning banner and disables create bond when the wallet network differs', () => {
    mockWalletNetwork = 'test'
    mockNetworkMismatch = {
      mismatch: true,
      expected: 'Public (Mainnet)',
      actual: 'Test (Testnet)',
    }
    render(<Bond />)

    const mismatchBanner = screen.getAllByRole('alert').find((el) =>
      el.textContent?.includes('Network mismatch')
    )
    expect(mismatchBanner).toHaveTextContent(
      /Credence is set to Public \(Mainnet\), but Freighter is on Test \(Testnet\)/i
    )
    expect(screen.getByRole('button', { name: /^Create bond$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Create bond$/i })).toHaveAttribute(
      'aria-describedby',
      'bond-network-mismatch'
    )
    expect(screen.getByRole('button', { name: /switch app to test \(testnet\)/i })).toBeInTheDocument()
  })

  it('switches the app network to the connected wallet network from the mismatch banner', async () => {
    const user = userEvent.setup()
    mockWalletNetwork = 'test'
    mockNetworkMismatch = {
      mismatch: true,
      expected: 'Public (Mainnet)',
      actual: 'Test (Testnet)',
    }
    render(<Bond />)

    await user.click(screen.getByRole('button', { name: /switch app to test \(testnet\)/i }))
    expect(mockSetNetwork).toHaveBeenCalledWith('test')
  })

  describe('transaction pending states', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.runAllTimers()
      vi.useRealTimers()
    })

    it('create bond button enters aria-busy while transaction is in flight', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Bond />)

      const createBtn = screen.getByRole('button', { name: /^Create bond$/i })
      expect(createBtn).not.toHaveAttribute('aria-busy', 'true')

      // start the click but do not advance the timer yet
      const clickPromise = user.click(createBtn)
      // while the mock delay is pending, the button should be busy
      expect(screen.getByRole('button', { name: /^Create bond$/i })).toHaveAttribute(
        'aria-busy',
        'true'
      )

      // complete the timer so the promise resolves
      vi.runAllTimers()
      await clickPromise
    })

    it('aria-live region announces "Submitting transaction…" while in flight', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Bond />)

      const clickPromise = user.click(screen.getByRole('button', { name: /^Create bond$/i }))
      expect(screen.getByRole('status')).toHaveTextContent('Submitting transaction…')

      vi.runAllTimers()
      await clickPromise
    })

    it('aria-live region is cleared after transaction completes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Bond />)

      const clickPromise = user.click(screen.getByRole('button', { name: /^Create bond$/i }))
      vi.runAllTimers()
      await clickPromise

      expect(screen.getByRole('status')).toHaveTextContent('')
    })

    it('navigates to /bond/new after create transaction completes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Bond />)

      const clickPromise = user.click(screen.getByRole('button', { name: /^Create bond$/i }))
      vi.runAllTimers()
      await clickPromise

      expect(mockNavigate).toHaveBeenCalledWith('/bond/new')
    })

    it('prevents double-submit: second click while pending is a no-op', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Bond />)

      const createBtn = screen.getByRole('button', { name: /^Create bond$/i })
      const firstClick = user.click(createBtn)

      // Button is now disabled (aria-busy + disabled), second click should not fire
      await user.click(createBtn)

      vi.runAllTimers()
      await firstClick

      // navigate should only have been called once despite two clicks
      expect(mockNavigate).toHaveBeenCalledTimes(1)
    })

    it('create bond button resets to non-loading after transaction completes', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<Bond />)

      const clickPromise = user.click(screen.getByRole('button', { name: /^Create bond$/i }))
      vi.runAllTimers()
      await clickPromise

      const btn = screen.getByRole('button', { name: /^Create bond$/i })
      expect(btn).not.toHaveAttribute('aria-busy', 'true')
      expect(btn).not.toBeDisabled()
    })
  })
})
