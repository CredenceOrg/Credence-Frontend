import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToastProvider from '../components/ToastProvider'
import Dashboard from './Dashboard'

let mockConnected = true

const mockRefetchTrust = vi.fn()
const mockRefetchBonds = vi.fn()
const mockRefetchActivity = vi.fn()

vi.mock('../hooks/useTrustScore', () => ({
  useTrustScore: () => ({
    data: { score: 684, tier: 'gold' },
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetchTrust,
  }),
}))

vi.mock('../hooks/useBonds', () => ({
  useBonds: () => ({
    data: [
      { id: 'bond-1', amount: 100, status: 'active' },
      { id: 'bond-2', amount: 250, status: 'active' },
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetchBonds,
  }),
}))

vi.mock('../hooks/useActivity', () => ({
  useActivity: () => ({
    data: [{ id: 'act-1', type: 'bond_created', timestamp: '2024-01-01T00:00:00.000Z' }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetchActivity,
  }),
}))

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    connected: mockConnected,
    isConnected: mockConnected,
    isConnecting: false,
    address: mockConnected ? 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' : '',
    connect: vi.fn(),
    disconnect: vi.fn(),
    error: null,
    network: 'test',
  }),
}))

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    </MemoryRouter>
  )
}

describe('Dashboard performance budget contract', () => {
  beforeEach(() => {
    mockConnected = true
    mockRefetchTrust.mockReset()
    mockRefetchBonds.mockReset()
    mockRefetchActivity.mockReset()
  })

  it('does not mount more than four action-card regions on the connected dashboard route', () => {
    const { container } = renderDashboard()

    const actionCards = container.querySelectorAll('article')

    expect(actionCards).toHaveLength(4)
    expect(screen.getByRole('heading', { name: 'Trust Score' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Active Bonds' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortcuts' })).toBeInTheDocument()
  })

  it('does not render the connected dashboard card set for disconnected users', () => {
    mockConnected = false

    const { container } = renderDashboard()

    expect(container.querySelectorAll('article')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: /wallet required/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Trust Score' })).not.toBeInTheDocument()
  })

  it('refreshing one widget does not refetch or re-render unrelated widgets', async () => {
    renderDashboard()

    const bondsHeading = screen.getByRole('heading', { name: 'Active Bonds' })
    const activityHeading = screen.getByRole('heading', { name: 'Recent Activity' })
    const bondsCard = bondsHeading.closest('article')
    const activityCard = activityHeading.closest('article')

    expect(bondsCard).not.toBeNull()
    expect(activityCard).not.toBeNull()

    const bondsSnapshot = bondsCard?.innerHTML
    const activitySnapshot = activityCard?.innerHTML

    const trustCard = screen.getByRole('heading', { name: 'Trust Score' }).closest('article')
    const refreshButton = trustCard?.querySelector(
      '[data-testid="widget-refresh"], button[aria-label*="refresh" i]'
    ) as HTMLElement | null

    expect(refreshButton).not.toBeNull()
    fireEvent.click(refreshButton as HTMLElement)

    await waitFor(() => {
      expect(mockRefetchTrust).toHaveBeenCalledTimes(1)
    })

    expect(mockRefetchBonds).not.toHaveBeenCalled()
    expect(mockRefetchActivity).not.toHaveBeenCalled()
    expect(bondsCard?.innerHTML).toBe(bondsSnapshot)
    expect(activityCard?.innerHTML).toBe(activitySnapshot)
  })
})
