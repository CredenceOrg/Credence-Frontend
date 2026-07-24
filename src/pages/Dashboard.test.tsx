import { render, screen, fireEvent, act } from '@testing-library/react'
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

const mockRefetch = vi.fn().mockResolvedValue(undefined)
let mockQueryData = { score: 684, tier: 'gold' }
let mockIsMobile = false

vi.mock('../hooks/useQuery', () => ({
  useQuery: (_fn: any, options: any) => {
    const enabled = options?.enabled !== false
    return {
      data: enabled ? mockQueryData : undefined,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    }
  }
}))

vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: () => mockIsMobile,
  useMediaQuery: () => mockIsMobile,
}))

function renderDashboard(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard', () => {
  beforeEach(() => {
    mockConnect.mockClear()
    mockRefetch.mockClear()
    mockConnected = true
    mockIsConnecting = false
    mockQueryData = { score: 684, tier: 'gold' }
    mockIsMobile = false
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

  it('renders only the specified widget when ?widget= parameter is provided', () => {
    renderDashboard(['/dashboard?widget=active-bonds'])

    expect(screen.getByRole('heading', { name: /active bonds/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Trust Score' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /recent activity/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Shortcuts' })).not.toBeInTheDocument()
  })

  it('exposes primary shortcut links', () => {
    renderDashboard()

    expect(screen.getByRole('link', { name: /create bond/i })).toHaveAttribute('href', '/bond')
    expect(screen.getByRole('link', { name: /view trust score/i })).toHaveAttribute(
      'href',
      '/trust'
    )
    expect(screen.getByRole('link', { name: /review attestations/i })).toHaveAttribute(
      'href',
      '/attestations'
    )
  })

  it('shows loading skeleton while wallet connection is pending', () => {
    mockConnected = false
    mockIsConnecting = true

    renderDashboard()

    expect(screen.getByLabelText(/loading dashboard/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /wallet required/i })).not.toBeInTheDocument()
  })

  it('does not render pull-to-refresh UI on desktop', () => {
    mockIsMobile = false
    renderDashboard()
    expect(screen.queryByText(/pull to refresh/i)).not.toBeInTheDocument()
  })

  it('handles pull-to-refresh touch gesture on mobile', async () => {
    mockIsMobile = true
    renderDashboard()

    const dashboardElement = screen.getByRole('heading', { name: 'Dashboard' }).closest('.dashboard')!

    // Fire touchStart
    fireEvent.touchStart(dashboardElement, {
      touches: [{ clientY: 100 }]
    })

    // Fire touchMove - pull down by 200px (pullDistance = 80px)
    fireEvent.touchMove(dashboardElement, {
      touches: [{ clientY: 300 }]
    })

    expect(screen.getByText(/release to refresh/i)).toBeInTheDocument()

    // Fire touchEnd
    await act(async () => {
      fireEvent.touchEnd(dashboardElement)
    })

    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('does not trigger refetch on short pull', () => {
    mockIsMobile = true
    renderDashboard()

    const dashboardElement = screen.getByRole('heading', { name: 'Dashboard' }).closest('.dashboard')!

    fireEvent.touchStart(dashboardElement, {
      touches: [{ clientY: 100 }]
    })

    // Pull down by 50px (pullDistance = 20px)
    fireEvent.touchMove(dashboardElement, {
      touches: [{ clientY: 150 }]
    })

    expect(screen.getByText(/pull to refresh/i)).toBeInTheDocument()

    fireEvent.touchEnd(dashboardElement)

    expect(mockRefetch).not.toHaveBeenCalled()
  })

  it('does not trigger pull-to-refresh when offline', () => {
    mockIsMobile = true
    const originalOnLine = navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true
    })

    renderDashboard()

    const dashboardElement = screen.getByRole('heading', { name: 'Dashboard' }).closest('.dashboard')!

    fireEvent.touchStart(dashboardElement, {
      touches: [{ clientY: 100 }]
    })

    fireEvent.touchMove(dashboardElement, {
      touches: [{ clientY: 300 }]
    })

    // Offline banner should be present, pull UI should not be displayed
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
    expect(screen.queryByText(/pull to refresh/i)).not.toBeInTheDocument()

    fireEvent.touchEnd(dashboardElement)
    expect(mockRefetch).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true
    })
  })
})
