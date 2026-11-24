import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ONBOARDING_COMPLETION_STORAGE_KEY,
  ONBOARDING_STEP_STORAGE_KEY,
} from '../config/onboarding'
import Dashboard from './Dashboard'

// Mocks needed because ActionCard now uses useToast, useCopyToClipboard, and useTranslation
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: vi.fn(),
    removeToast: vi.fn(),
    removeAllToasts: vi.fn(),
    announce: vi.fn(),
  }),
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
  useQuery: (_fn: unknown, options?: { enabled?: boolean }) => {
    const enabled = options?.enabled !== false
    return {
      data: enabled ? mockQueryData : undefined,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    }
  },
}))

// Live data sources composed by the Dashboard.
const mockTrustRefetch = vi.fn().mockResolvedValue(undefined)
const mockBondsRefetch = vi.fn().mockResolvedValue(undefined)
const mockActivityRefetch = vi.fn().mockResolvedValue(undefined)

interface MockQueryState<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

let mockTrustState: MockQueryState<{ score: number }>
let mockBondsState: MockQueryState<Array<{ id: string; amount: number; asset: string }>>
let mockActivityState: MockQueryState<Array<{ id: string; label: string }>>

vi.mock('../hooks/useTrustScore', () => ({
  useTrustScore: () => mockTrustState,
}))

vi.mock('../hooks/useBonds', () => ({
  useBonds: () => mockBondsState,
}))

vi.mock('../hooks/useActivity', () => ({
  useActivity: () => mockActivityState,
}))

function resetLiveData() {
  mockTrustState = {
    data: { score: 684 },
    isLoading: false,
    error: null,
    refetch: mockTrustRefetch,
  }
  mockBondsState = {
    data: [
      { id: 'b1', amount: 2500, asset: 'USDC' },
      { id: 'b2', amount: 1750, asset: 'USDC' },
    ],
    isLoading: false,
    error: null,
    refetch: mockBondsRefetch,
  }
  mockActivityState = {
    data: [{ id: 'a1', label: 'Attestation submitted' }],
    isLoading: false,
    error: null,
    refetch: mockActivityRefetch,
  }
}

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
    mockTrustRefetch.mockClear()
    mockBondsRefetch.mockClear()
    mockActivityRefetch.mockClear()
    mockConnected = true
    mockIsConnecting = false
    mockQueryData = { score: 684, tier: 'gold' }
    mockIsMobile = false
    resetLiveData()
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

  it('renders a single EmptyState wrapped in an ActionCard when disconnected', () => {
    mockConnected = false

    const { container } = renderDashboard()

    // Only one article (ActionCard) should render — no dashboard cards
    const articles = container.querySelectorAll('article')
    expect(articles).toHaveLength(1)

    // The ActionCard contains the EmptyState with the trust illustration
    const svg = articles[0].querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the connect-freighter description in the disconnected empty state', () => {
    mockConnected = false

    renderDashboard()

    expect(
      screen.getByText(
        /connect freighter to load your trust score, active bonds, and recent activity/i
      )
    ).toBeInTheDocument()
  })

  it('does not render dashboard cards (trust score, bonds, activity, shortcuts) when disconnected', () => {
    mockConnected = false

    renderDashboard()

    expect(screen.queryByRole('heading', { name: 'Trust Score' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /active bonds/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /recent activity/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Shortcuts' })).not.toBeInTheDocument()
  })

  it('keeps the disconnected state unchanged when live data hooks would error', () => {
    mockConnected = false
    mockTrustState = {
      data: undefined,
      isLoading: false,
      error: new Error('trust unavailable'),
      refetch: mockTrustRefetch,
    }
    mockBondsState = {
      data: undefined,
      isLoading: false,
      error: new Error('bonds unavailable'),
      refetch: mockBondsRefetch,
    }
    mockActivityState = {
      data: undefined,
      isLoading: false,
      error: new Error('activity unavailable'),
      refetch: mockActivityRefetch,
    }

    renderDashboard()

    expect(screen.getByRole('heading', { name: /wallet required/i })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard.mockDataBanner')).not.toBeInTheDocument()
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

  it('renders live trust score, derived tier, bond amounts and activity items', () => {
    mockTrustState.data = { score: 812 }
    mockBondsState.data = [{ id: 'b1', amount: 1234, asset: 'USDC' }]
    mockActivityState.data = [{ id: 'a1', label: 'Bond created' }]

    renderDashboard()

    expect(screen.getByText('812')).toBeInTheDocument()
    // Tier is derived via tierForScore rather than a hardcoded constant.
    expect(screen.getByText('Platinum Tier')).toBeInTheDocument()
    expect(screen.getByText('1,234 USDC')).toBeInTheDocument()
    expect(screen.getByText(/Bond created/i)).toBeInTheDocument()
    // No fabricated mock data banner once live data is shown.
    expect(screen.queryByTestId('dashboard.mockDataBanner')).not.toBeInTheDocument()
  })

  it('shows per-widget skeletons while data is loading', () => {
    mockTrustState = { data: undefined, isLoading: true, error: null, refetch: mockTrustRefetch }
    mockBondsState = { data: undefined, isLoading: true, error: null, refetch: mockBondsRefetch }
    mockActivityState = {
      data: undefined,
      isLoading: true,
      error: null,
      refetch: mockActivityRefetch,
    }

    renderDashboard()

    expect(screen.getByLabelText(/loading trust score/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/loading active bonds/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/loading recent activity/i)).toBeInTheDocument()
  })

  it('shows a per-widget error and retries only the failing widget', async () => {
    const user = userEvent.setup()
    mockBondsState = {
      data: undefined,
      isLoading: false,
      error: new Error('bonds unavailable'),
      refetch: mockBondsRefetch,
    }

    renderDashboard()

    // Other widgets still render their live data.
    expect(screen.getByText('684')).toBeInTheDocument()
    expect(screen.getByText(/Attestation submitted/i)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/bonds unavailable/i)

    await user.click(screen.getByRole('button', { name: /retry active bonds/i }))

    expect(mockBondsRefetch).toHaveBeenCalledTimes(1)
    expect(mockTrustRefetch).not.toHaveBeenCalled()
    expect(mockActivityRefetch).not.toHaveBeenCalled()
  })

  it('renders only the specified widget when ?widget= parameter is provided', () => {
    renderDashboard(['/dashboard?widget=active-bonds'])

    expect(screen.getByRole('heading', { name: /active bonds/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Trust Score' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /recent activity/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Shortcuts' })).not.toBeInTheDocument()
  })

  it('reorders pinned widgets with accessible controls and persists the new order', async () => {
    const user = userEvent.setup()
    localStorage.setItem(ONBOARDING_COMPLETION_STORAGE_KEY, 'done')

    const { container } = renderDashboard()

    await user.click(screen.getByRole('button', { name: 'Pin Active Bonds' }))
    await user.click(screen.getByRole('button', { name: 'Pin Trust Score' }))
    await user.click(screen.getByRole('button', { name: 'Move Trust Score earlier' }))

    expect(container.querySelector('.dashboard > [role="status"]')).toHaveTextContent(
      'Trust Score moved to position 1 of 2.'
    )
    expect(JSON.parse(localStorage.getItem('credence:pinned_widgets')!)).toEqual([
      'trust-score',
      'active-bonds',
    ])
    expect(
      Array.from(container.querySelectorAll('article h2')).map((heading) => heading.textContent)
    ).toEqual(['Trust Score', 'Active Bonds', 'Recent Activity', 'Shortcuts'])
    expect(screen.getByRole('button', { name: 'Move Trust Score earlier' })).toBeDisabled()
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
