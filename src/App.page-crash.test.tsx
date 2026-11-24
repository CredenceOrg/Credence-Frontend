import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// Mock useWallet hook so Layout's WalletConnect works deterministically
vi.mock('./hooks/useWallet', () => ({
  useWallet: () => ({
    address: '',
    isConnected: false,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    network: 'public',
  }),
}))

// Mock TrustScore to throw during render to simulate page-level crash
vi.mock('./pages/TrustScore', () => ({
  default: () => {
    throw new Error('TrustScore page crashed')
  },
}))

// Mock Settings to render a healthy page
vi.mock('./pages/Settings', () => ({
  default: () => (
    <div>
      <h1>Settings Page</h1>
      <p>Configure your preferences.</p>
    </div>
  ),
}))

// Mock Dashboard for testing dashboard navigation link
vi.mock('./pages/Dashboard', () => ({
  default: () => (
    <div>
      <h1>Dashboard Page</h1>
    </div>
  ),
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('Page crash isolation and recovery (App.page-crash)', () => {
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    reloadSpy = vi.fn()
    try {
      Object.defineProperty(window.location, 'reload', {
        configurable: true,
        value: reloadSpy,
      })
    } catch {
      // In case window.location is frozen in certain environments
      const originalLocation = window.location
      delete (window as { location?: unknown }).location
      window.location = {
        ...originalLocation,
        get pathname() {
          return originalLocation.pathname
        },
        reload: reloadSpy,
      } as unknown as Location
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('a throwing page at /trust → the error panel is rendered and role="navigation" "Main navigation" is still present. Clicking the "Settings" nav link renders Settings without a reload', async () => {
    window.history.pushState({}, '', '/trust')

    render(<App />)

    // The page-level error boundary catches the crash and displays the fallback
    const errorAlert = await screen.findByRole('alert')
    expect(errorAlert).toBeInTheDocument()
    expect(errorAlert).toHaveAttribute('data-error-kind', 'generic')
    expect(errorAlert).toHaveAttribute('data-error-severity', 'danger')

    // Crucially: Chrome navigation is NOT torn down. Header and Main navigation remain present
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(mainNav).toBeInTheDocument()

    // Brand and wallet remain visible
    expect(screen.getByRole('link', { name: /credence/i })).toBeInTheDocument()
    expect(screen.getByTestId('wallet-connect-btn')).toBeInTheDocument()

    // Footer remains visible
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()

    // Click the "Settings" nav link in main navigation
    const settingsNavLink = screen.getByRole('link', { name: 'Settings' })
    fireEvent.click(settingsNavLink)

    // Boundary automatically resets on navigation without a full reload
    expect(await screen.findByRole('heading', { name: 'Settings Page' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('provides a page-scoped "Go to dashboard" action that recovers via router navigation', async () => {
    window.history.pushState({}, '', '/trust')

    render(<App />)

    // Wait for the page error panel
    await screen.findByRole('alert')

    // Find the secondary "Go to dashboard" link rendered in the route error boundary
    const goToDashboardLink = screen.getByRole('link', { name: /go to dashboard/i })
    expect(goToDashboardLink).toBeInTheDocument()
    expect(goToDashboardLink).toHaveAttribute('href', '/dashboard')

    // Click "Go to dashboard"
    fireEvent.click(goToDashboardLink)

    // Navigates and recovers to Dashboard without document reload
    expect(await screen.findByRole('heading', { name: 'Dashboard Page' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
