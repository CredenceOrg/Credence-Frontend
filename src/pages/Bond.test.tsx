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

  it('renders the page header, description, and empty active bonds state', () => {
    render(<Bond />)

    expect(screen.getByRole('heading', { name: /Bond USDC/i })).toBeInTheDocument()
    expect(screen.getByText(/Lock USDC into the Credence contract/i)).toBeInTheDocument()
    expect(screen.getByText(/No active bonds/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create your first bond/i })).toBeInTheDocument()
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

  it('navigates to /bond/new when the empty state action button is clicked while connected', async () => {
    const user = userEvent.setup()
    render(<Bond />)
    await user.click(screen.getByRole('button', { name: /Create your first bond/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/bond/new')
  })

  it('calls connect when the empty state action button is clicked while disconnected', async () => {
    const user = userEvent.setup()
    mockConnected = false
    render(<Bond />)
    await user.click(screen.getByRole('button', { name: /Create your first bond/i }))
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
