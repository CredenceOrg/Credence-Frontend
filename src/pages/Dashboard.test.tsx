import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

const mockConnect = vi.fn()
let mockConnected = true
let mockIsConnecting = false

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    connected: mockConnected,
    isConnected: mockConnected,
    isConnecting: mockIsConnecting,
    address: mockConnected ? 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' : '',
    connect: mockConnect,
    disconnect: vi.fn(),
    error: null,
    network: 'test',
  }),
}))

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    mockConnect.mockClear()
    mockConnected = true
    mockIsConnecting = false
  })

  it('prompts disconnected users to connect their wallet', async () => {
    const user = userEvent.setup()
    mockConnected = false

    renderDashboard()

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /wallet required/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /connect wallet/i }))

    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it('renders connected dashboard cards and activity summary', () => {
    renderDashboard()

    expect(screen.getByRole('heading', { name: 'Trust Score' })).toBeInTheDocument()
    expect(screen.getByText('Gold Tier')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /active bonds/i })).toBeInTheDocument()
    expect(screen.getByText('4,250 USDC')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /recent activity/i })).toBeInTheDocument()
    expect(screen.getByText(/Attestation submitted/i)).toBeInTheDocument()
  })

  it('exposes primary shortcut links', () => {
    renderDashboard()

    expect(screen.getByRole('link', { name: /create bond/i })).toHaveAttribute('href', '/bond')
    expect(screen.getByRole('link', { name: /view trust score/i })).toHaveAttribute('href', '/trust')
    expect(screen.getByRole('link', { name: /review attestations/i })).toHaveAttribute(
      'href',
      '/attestations',
    )
  })

  it('shows loading skeleton while wallet connection is pending', () => {
    mockConnected = false
    mockIsConnecting = true

    renderDashboard()

    expect(screen.getByLabelText(/loading dashboard/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /wallet required/i })).not.toBeInTheDocument()
  })
})
