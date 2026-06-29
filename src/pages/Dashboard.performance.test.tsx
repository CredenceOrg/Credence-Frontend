import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

let mockConnected = true

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
      <Dashboard />
    </MemoryRouter>
  )
}

describe('Dashboard performance budget contract', () => {
  beforeEach(() => {
    mockConnected = true
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
})
