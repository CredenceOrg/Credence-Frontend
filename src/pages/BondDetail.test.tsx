import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import BondDetail from './BondDetail'
import { ApiError } from '../api/client'
import type { Bond } from '../api/types'

const mockAddToast = vi.fn()
const mockConnect = vi.fn()
const mockNavigate = vi.fn()
const mockApiFetch = vi.fn()

let mockConnected = true

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  }
})

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

vi.mock('../components/ConnectWalletDialog', () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
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
  default: ({
    open,
    title,
    onConfirm,
    onCancel,
  }: {
    open: boolean
    title: string
    onConfirm: () => void
    onCancel: () => void
  }) => {
    if (!open) return null
    return (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <label htmlFor="confirm-input">Type CONFIRM</label>
        <input id="confirm-input" type="text" aria-label="type confirm" />
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>Withdraw bond</button>
      </div>
    )
  },
}))

let mockParams = { id: 'bond-1' }

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    Link: ({
      children,
      to,
      className,
    }: {
      children: React.ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
  }
})

const LOCKED_BOND: Bond = {
  id: 'bond-1',
  borrower: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  amount: '1000.00',
  asset: 'USDC',
  status: 'active',
  createdAt: '2026-06-23T12:00:00Z',
  maturesAt: '2026-07-23T12:00:00Z',
}

const MATURED_BOND: Bond = {
  id: 'bond-3',
  borrower: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  amount: '750.00',
  asset: 'USDC',
  status: 'active',
  createdAt: '2026-01-01T12:00:00Z',
  maturesAt: '2026-06-01T12:00:00Z',
}

describe('BondDetail Page', () => {
  beforeEach(() => {
    mockAddToast.mockClear()
    mockConnect.mockClear()
    mockNavigate.mockClear()
    mockApiFetch.mockReset()
    mockConnected = true
    mockParams = { id: 'bond-1' }
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-06-23T12:00:00Z'))
    mockApiFetch.mockResolvedValue(LOCKED_BOND)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a loading skeleton while fetching the bond', () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(screen.getAllByRole('status', { name: 'Loading' }).length).toBeGreaterThan(0)
    expect(document.title).toContain('Detail')
  })

  it('renders header, status badge, and updates document title once data loads', async () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: /Manage Bond #bond-1/i })).toBeInTheDocument()
    expect(screen.getByText('← Back to Bonds')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    await waitFor(() => {
      expect(document.title).toContain('bond-1')
    })
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/bonds/bond-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('renders bond specifications derived from the fetched bond', async () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(await screen.findByText('1,000 USDC')).toBeInTheDocument()
    expect(screen.getByText('Bonded Amount')).toBeInTheDocument()
    expect(screen.getByText('Time Remaining')).toBeInTheDocument()
    expect(screen.getByText('30 days remaining')).toBeInTheDocument()
    expect(screen.getByText('Lock Duration')).toBeInTheDocument()
    expect(screen.getByText('30 Days')).toBeInTheDocument()
    expect(screen.getByText('Lock Start Date')).toBeInTheDocument()
    expect(screen.getByText('Estimated Unlock Date')).toBeInTheDocument()
  })

  it('renders the slash-risk panel with penalty breakdown from the fetched bond', async () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: /Slash-Risk Panel/i })).toBeInTheDocument()
    expect(screen.getByText('Current Early-Withdrawal Penalty')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByText('USDC Penalty Amount')).toBeInTheDocument()
    const penaltyAmount = screen.getByText('−200 USDC')
    expect(penaltyAmount).toBeInTheDocument()
    expect(penaltyAmount).toHaveClass('bond-detail__penalty-amount')
    expect(screen.getByText('Resulting Balance Received')).toBeInTheDocument()
    expect(screen.getByText('800 USDC')).toBeInTheDocument()
  })

  it('shows zero penalty for a matured bond', async () => {
    mockParams = { id: 'bond-3' }
    mockApiFetch.mockResolvedValue(MATURED_BOND)

    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: /Manage Bond #bond-3/i })).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('−0 USDC')).toBeInTheDocument()
    expect(screen.getAllByText('750 USDC').length).toBeGreaterThanOrEqual(2)
  })

  it('allows extending the lock duration using +30 and +90 days buttons', async () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    await screen.findByRole('heading', { name: /Manage Bond #bond-1/i })

    const initialUnlockDate =
      screen.getByText('Estimated Unlock Date').nextElementSibling?.textContent
    const plus30Btn = screen.getByRole('button', { name: /^\+30 Days$/i })

    fireEvent.click(plus30Btn)

    expect(screen.getByText('60 Days')).toBeInTheDocument()
    const updatedUnlockDate =
      screen.getByText('Estimated Unlock Date').nextElementSibling?.textContent
    expect(updatedUnlockDate).not.toBe(initialUnlockDate)
    expect(mockAddToast).toHaveBeenCalledWith('success', 'Lock duration extended by +30 days.')

    const plus90Btn = screen.getByRole('button', { name: /^\+90 Days$/i })
    fireEvent.click(plus90Btn)
    expect(screen.getByText('150 Days')).toBeInTheDocument()
  })

  it('withdraw button shows confirm dialog when wallet is connected', async () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    const withdrawBtn = await screen.findByRole('button', { name: /^Withdraw$/i })
    fireEvent.click(withdrawBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Confirm bond withdrawal/i })).toBeInTheDocument()
  })

  it('opens ConnectWalletDialog when withdraw is clicked while disconnected', async () => {
    mockConnected = false

    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    const withdrawBtn = await screen.findByRole('button', { name: /connect wallet to withdraw/i })
    fireEvent.click(withdrawBtn)

    expect(mockConnect).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /connect freighter wallet/i })).toBeInTheDocument()
  })

  it('confirm dialog allows confirming withdrawal with correct toast and redirects', async () => {
    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: /^Withdraw$/i }))

    const input = screen.getByRole('textbox', { name: /type confirm/i })
    fireEvent.change(input, { target: { value: 'CONFIRM' } })

    fireEvent.click(screen.getByRole('button', { name: /Withdraw bond/i }))

    expect(mockAddToast).toHaveBeenCalledWith(
      'warning',
      'Bond withdrawn. 200 USDC was slashed per early withdrawal policy.'
    )
    expect(mockNavigate).toHaveBeenCalledWith('/bond')
  })

  it('renders not-found state for HTTP 404 responses', async () => {
    mockParams = { id: 'missing-99' }
    mockApiFetch.mockRejectedValue(new ApiError(404, 'Bond not found'))

    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(await screen.findByText('Bond Not Found')).toBeInTheDocument()
    expect(
      screen.getByText('The requested bond with ID #missing-99 does not exist or has been removed.')
    ).toBeInTheDocument()
    expect(screen.getByText('← Back to Bonds')).toBeInTheDocument()
  })

  it('renders a retryable error state for 5xx/network errors and retries on click', async () => {
    mockApiFetch
      .mockRejectedValueOnce(new ApiError(500, 'Internal server error'))
      .mockResolvedValueOnce(LOCKED_BOND)

    render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Bond Not Found')).not.toBeInTheDocument()

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)

    expect(await screen.findByRole('heading', { name: /Manage Bond #bond-1/i })).toBeInTheDocument()
    expect(mockApiFetch).toHaveBeenCalledTimes(2)
  })

  it('aborts the in-flight request when the bond id changes', async () => {
    let capturedSignal: AbortSignal | undefined
    mockApiFetch.mockImplementation((_url: string, opts?: { signal?: AbortSignal }) => {
      if (!capturedSignal) {
        capturedSignal = opts?.signal
        return new Promise(() => {})
      }
      return Promise.resolve(MATURED_BOND)
    })

    const { rerender } = render(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    expect(capturedSignal?.aborted).toBe(false)

    mockParams = { id: 'bond-3' }
    rerender(
      <MemoryRouter>
        <BondDetail />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true)
    })
    expect(await screen.findByRole('heading', { name: /Manage Bond #bond-3/i })).toBeInTheDocument()
  })
})
