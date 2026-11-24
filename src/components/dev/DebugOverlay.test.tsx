import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import DebugOverlay from './DebugOverlay'

// Mock the feature flags module to control return values in tests.
// We mock the module instead of relying on `window.location` because
// jsdom's location is not easily reset between tests.
const mockGetFeatureFlags = vi.fn()

vi.mock('../../config/featureFlags', () => ({
  getFeatureFlags: (...args: unknown[]) => mockGetFeatureFlags(...args),
  FEATURE_FLAG_LABELS: {
    debug: 'Debug Overlay',
    newDashboard: 'New Dashboard Layout',
    betaChart: 'Beta Chart Components',
    newTransactionList: 'New Transaction List',
  },
}))

describe('DebugOverlay', () => {
  beforeEach(() => {
    mockGetFeatureFlags.mockReset()
  })

  it('renders nothing when debug mode is off', () => {
    mockGetFeatureFlags.mockReturnValue({
      debug: false,
      newDashboard: false,
      betaChart: false,
      newTransactionList: false,
    })
    const { container } = render(<DebugOverlay />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the toggle button when debug mode is on', () => {
    mockGetFeatureFlags.mockReturnValue({
      debug: true,
      newDashboard: false,
      betaChart: false,
      newTransactionList: false,
    })
    render(<DebugOverlay />)
    expect(screen.getByRole('button', { name: /open debug overlay/i })).toBeInTheDocument()
  })

  it('opens the panel when the toggle button is clicked', () => {
    mockGetFeatureFlags.mockReturnValue({
      debug: true,
      newDashboard: false,
      betaChart: false,
      newTransactionList: false,
    })
    render(<DebugOverlay />)

    const toggle = screen.getByRole('button', { name: /open debug overlay/i })
    fireEvent.click(toggle)

    // The panel should now be visible
    expect(screen.getByRole('dialog', { name: /feature flags debug overlay/i })).toBeInTheDocument()
    // The toggle button should now say "Close debug toggle"
    expect(screen.getByRole('button', { name: /close debug toggle/i })).toBeInTheDocument()
  })

  it('closes the panel when the close button is clicked', () => {
    mockGetFeatureFlags.mockReturnValue({
      debug: true,
      newDashboard: false,
      betaChart: false,
      newTransactionList: false,
    })
    render(<DebugOverlay />)

    // Open
    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Close using the panel's close button
    fireEvent.click(screen.getByRole('button', { name: 'Close debug overlay' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows ON badge for active flags', () => {
    mockGetFeatureFlags.mockReturnValue({
      debug: true,
      newDashboard: true,
      betaChart: false,
      newTransactionList: true,
    })
    render(<DebugOverlay />)

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))

    expect(screen.getByTestId('flag-debug')).toHaveTextContent('ON')
    expect(screen.getByTestId('flag-newDashboard')).toHaveTextContent('ON')
    expect(screen.getByTestId('flag-betaChart')).toHaveTextContent('OFF')
    expect(screen.getByTestId('flag-newTransactionList')).toHaveTextContent('ON')
  })

  it('shows all flags OFF when none are active', () => {
    mockGetFeatureFlags.mockReturnValue({
      debug: true,
      newDashboard: false,
      betaChart: false,
      newTransactionList: false,
    })
    render(<DebugOverlay />)

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))

    expect(screen.getByTestId('flag-debug')).toHaveTextContent('ON')
    expect(screen.getByTestId('flag-newDashboard')).toHaveTextContent('OFF')
    expect(screen.getByTestId('flag-betaChart')).toHaveTextContent('OFF')
    expect(screen.getByTestId('flag-newTransactionList')).toHaveTextContent('OFF')
  })

  it('shows the hint text about URL params', () => {
    mockGetFeatureFlags.mockReturnValue({
      debug: true,
      newDashboard: false,
      betaChart: false,
      newTransactionList: false,
    })
    render(<DebugOverlay />)

    fireEvent.click(screen.getByRole('button', { name: /open debug overlay/i }))

    expect(screen.getByText(/set flags via url/i)).toBeInTheDocument()
  })
})