import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import BondDetail from './BondDetail'

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

vi.mock('../components/ConnectWalletModal', () => ({
  __esModule: true,
  default: ({
    open,
    onClose,
  }: {
    open: boolean
    onClose: () => void
  }) => {
    if (!open) return null
    return (
      <div role="dialog" aria-label="Connect Freighter Wallet">
        <h2>Connect Freighter Wallet</h2>
        <button onClick={onClose}>Cancel</button>
        <button>Connect</button>
      </div>
    )
  },
}))

vi.mock('../components/ConfirmDialog', () => ({
  __esModule: true,
  default: ({ open, title, onConfirm, onCancel }: { open: boolean; title: string; onConfirm: () => void; onCancel: () => void }) => {
    if (!open) return null
    return (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <label htmlFor="confirm-input">Type CONFIRM</label>
        <input
          id="confirm-input"
          type="text"
          role="textbox"
          aria-label="type confirm"
        />
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>Withdraw bond</button>
      </div>
    )
  }
}))

let mockParams = { id: '1' }

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  }
})

describe('BondDetail Page', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
    mockConnect.mockClear()
    mockNavigate.mockClear()
    mockConnected = true
    mockParams = { id: '1' }
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the header with back button, page title, and badge', () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(screen.getByText('← Back to Bonds')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Manage Bond #1/i })).toBeInTheDocument()
    expect(screen.getByText('Locked')).toBeInTheDocument()
  })

  it('renders active status badge for bond #3', () => {
    mockParams = { id: '3' }
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /Manage Bond #3/i })).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders the bond specifications (amount, lock duration, unlock date)', () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(screen.getByText('Bonded Amount')).toBeInTheDocument()
    expect(screen.getByText('1,000 USDC')).toBeInTheDocument()
    expect(screen.getByText('Lock Duration')).toBeInTheDocument()
    expect(screen.getByText('30 Days')).toBeInTheDocument()
    expect(screen.getByText('Estimated Unlock Date')).toBeInTheDocument()
  })

  it('renders the slash-risk panel with the live penalty breakdown', () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /Slash-Risk Panel/i })).toBeInTheDocument()
    expect(screen.getByText('Current Early-Withdrawal Penalty')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByText('USDC Penalty Amount')).toBeInTheDocument()
    expect(screen.getByText('200 USDC')).toBeInTheDocument()
    expect(screen.getByText('Resulting Balance Received')).toBeInTheDocument()
    expect(screen.getByText('800 USDC')).toBeInTheDocument()
  })

  it('allows extending the lock duration using +30 and +90 days buttons', () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    const initialUnlockDate = screen.getByText('Estimated Unlock Date').nextElementSibling?.textContent
    const plus30Btn = screen.getByRole('button', { name: /^\+30 Days$/i })

    fireEvent.click(plus30Btn)

    expect(screen.getByText('60 Days')).toBeInTheDocument()
    const updatedUnlockDate = screen.getByText('Estimated Unlock Date').nextElementSibling?.textContent
    expect(updatedUnlockDate).not.toBe(initialUnlockDate)
    expect(mockAddToast).toHaveBeenCalledWith('success', 'Lock duration extended by +30 days.')

    const plus90Btn = screen.getByRole('button', { name: /^\+90 Days$/i })
    fireEvent.click(plus90Btn)
    expect(screen.getByText('150 Days')).toBeInTheDocument()
  })

  it('withdraw button shows confirm dialog when wallet is connected', () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    const withdrawBtn = screen.getByRole('button', { name: /^Withdraw$/i })
    fireEvent.click(withdrawBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Confirm bond withdrawal/i })).toBeInTheDocument()
  })

  it('opens the ConnectWalletModal when withdraw is clicked while disconnected', () => {
    mockConnected = false

    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    const withdrawBtn = screen.getByRole('button', { name: /connect wallet to withdraw/i })
    fireEvent.click(withdrawBtn)

    expect(mockConnect).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /connect freighter wallet/i })).toBeInTheDocument()
  })

  it('confirm dialog allows cancellation', () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /^Withdraw$/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirm dialog allows confirming withdrawal with correct toast and redirects', () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /^Withdraw$/i }))
    
    const input = screen.getByRole('textbox', { name: /type confirm/i })
    fireEvent.change(input, { target: { value: 'CONFIRM' } })

    const confirmBtn = screen.getByRole('button', { name: /Withdraw bond/i })
    fireEvent.click(confirmBtn)

    expect(mockAddToast).toHaveBeenCalledWith(
      'warning',
      'Bond withdrawn. 200 USDC was slashed per early withdrawal policy.'
    )
    expect(mockNavigate).toHaveBeenCalledWith('/bond')
  })

  it('renders ErrorState when requesting unknown bond ID', () => {
    mockParams = { id: '99' }
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(screen.getByText('Bond Not Found')).toBeInTheDocument()
    expect(screen.getByText('The requested bond with ID #99 does not exist or has been removed.')).toBeInTheDocument()
    expect(screen.getByText('← Back to Bonds')).toBeInTheDocument()
  })
})
