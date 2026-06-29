import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, within } from '@testing-library/react'
import { WalletProvider, useWallet } from './WalletContext'
import { BrowserRouter } from 'react-router-dom'
import { SettingsProvider } from './SettingsContext'
import ToastProvider from '../components/ToastProvider'
import * as useWalletHook from '../hooks/useWallet'

// Mock the useWallet hook
vi.mock('../hooks/useWallet', () => ({
  useWallet: vi.fn(),
}))

const TestComponent = () => {
  const { isConnected } = useWallet()
  return <div>{isConnected ? 'Connected' : 'Disconnected'}</div>
}

describe('Session Timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(useWalletHook.useWallet).mockReturnValue({
      address: 'GBA...MOCK',
      isConnected: true,
      isConnecting: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      network: 'test',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('shows warning modal after 14 minutes of inactivity', async () => {
    render(
      <BrowserRouter>
        <SettingsProvider>
          <ToastProvider>
            <WalletProvider>
              <TestComponent />
            </WalletProvider>
          </ToastProvider>
        </SettingsProvider>
      </BrowserRouter>
    )

    // Initially connected
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Fast-forward 14 minutes (15m - 60s)
    act(() => {
      vi.advanceTimersByTime(14 * 60 * 1000)
    })

    const modal = screen.getByRole('dialog')
    expect(modal).toBeInTheDocument()
    // Using getAllByText since it appears in multiple places for accessibility
    expect(within(modal).getAllByText(/Session Timeout Warning/i).length).toBeGreaterThan(0)
    expect(within(modal).getAllByText(/Your session will expire in 60 seconds/i).length).toBeGreaterThan(0)
  })

  it('automatically logs out after 15 minutes of inactivity', async () => {
    const disconnect = vi.fn()
    vi.mocked(useWalletHook.useWallet).mockReturnValue({
      address: 'GBA...MOCK',
      isConnected: true,
      isConnecting: false,
      error: null,
      connect: vi.fn(),
      disconnect,
      network: 'test',
    })

    render(
      <BrowserRouter>
        <SettingsProvider>
          <ToastProvider>
            <WalletProvider>
              <TestComponent />
            </WalletProvider>
          </ToastProvider>
        </SettingsProvider>
      </BrowserRouter>
    )

    // Fast-forward 14 minutes to show warning
    act(() => {
      vi.advanceTimersByTime(14 * 60 * 1000)
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Fast-forward 60 more seconds
    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })

    expect(disconnect).toHaveBeenCalled()
  })

  it('resets timer on activity', async () => {
    render(
      <BrowserRouter>
        <SettingsProvider>
          <ToastProvider>
            <WalletProvider>
              <TestComponent />
            </WalletProvider>
          </ToastProvider>
        </SettingsProvider>
      </BrowserRouter>
    )

    // Fast-forward 10 minutes
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000)
    })

    // Simulate activity
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })

    // Fast-forward another 10 minutes
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000)
    })

    // Warning should NOT be shown yet because timer was reset at 10m
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Fast-forward another 4 minutes (total 14m since last activity)
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000)
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
