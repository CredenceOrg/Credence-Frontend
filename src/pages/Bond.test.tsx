import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Bond from './Bond'

const mockAddToast = vi.fn()
const mockConnect = vi.fn()
const mockNavigate = vi.fn()

let mockConnected = true

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: mockAddToast,
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
    network: 'public',
  }),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

describe('Bond Page', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
    mockConnect.mockClear()
    mockNavigate.mockClear()
    mockConnected = true
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
})
