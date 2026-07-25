import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ONBOARDING_COMPLETION_STORAGE_KEY, ONBOARDING_STEP_STORAGE_KEY } from '../config/onboarding'
import Dashboard from './Dashboard'

// Mocks needed because ActionCard now uses useToast, useCopyToClipboard, and useTranslation
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn(), removeAllToasts: vi.fn(), announce: vi.fn() }),
}))

vi.mock('../hooks/useCopyToClipboard', () => ({
  default: () => ({ copy: vi.fn().mockResolvedValue(true), copied: false, reset: vi.fn() }),
}))

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
    localStorage.clear()
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

  it('shows the onboarding tour on first visit and records completion when skipped', async () => {
    const user = userEvent.setup()

    renderDashboard()

    expect(screen.getByText(/quick tour/i)).toBeInTheDocument()
    expect(screen.getByText(/welcome to your dashboard/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /skip tour/i }))

    expect(localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY)).toBeTruthy()
    expect(localStorage.getItem(ONBOARDING_STEP_STORAGE_KEY)).toBeNull()
  })

  it('persists progress when advancing the onboarding tour', async () => {
    const user = userEvent.setup()

    renderDashboard()

    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(localStorage.getItem(ONBOARDING_STEP_STORAGE_KEY)).toBe('1')
    expect(screen.getByText(/review active bonds/i)).toBeInTheDocument()
  })

  it('resumes an interrupted onboarding tour from the saved step', () => {
    localStorage.setItem(ONBOARDING_STEP_STORAGE_KEY, '2')

    renderDashboard()

    expect(screen.getByText(/monitor recent activity/i)).toBeInTheDocument()
  })
})
