import type { ReactNode } from 'react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import ToastProvider from './components/ToastProvider'
import Layout from './components/Layout'
import RequireWallet from './components/RequireWallet'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Bond from './pages/Bond'
import TrustScore from './pages/TrustScore'
import TrustSummary from './pages/TrustSummary'
import Settings from './pages/Settings'
import SignIn from './pages/SignIn'
import NotFound from './pages/NotFound'
import type { WalletContextValue } from './context/WalletContext'

let mockWalletState: WalletContextValue

vi.mock('./context/WalletContext', () => ({
  useWallet: () => mockWalletState,
  useWalletContext: () => mockWalletState,
  WalletProvider: ({ children }: { children: ReactNode }) => children,
}))

function createWalletState(overrides: Partial<WalletContextValue> = {}): WalletContextValue {
  return {
    address: '',
    isConnected: false,
    connected: false,
    isConnecting: false,
    isRestoring: false,
    error: null,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    network: null,
    lastReauthTime: null,
    reauth: vi.fn().mockResolvedValue(false),
    requestReauth: vi.fn().mockResolvedValue(false),
    isReauthRequired: vi.fn().mockReturnValue(false),
    ...overrides,
  }
}

function LocationDisplay() {
  const location = useLocation()
  return (
    <output data-testid="location-display">
      {`${location.pathname}${location.search}${location.hash}`}
    </output>
  )
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

beforeEach(() => {
  mockWalletState = createWalletState()
})

function renderRoutes(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SettingsProvider>
        <ToastProvider>
          <LocationDisplay />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="trust" element={<TrustScore />} />
              <Route path="trust/summary" element={<TrustSummary />} />
              <Route path="signin" element={<SignIn />} />
              <Route element={<RequireWallet />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="bond" element={<Bond />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>
  )
}

function getDesktopNavLink(name: RegExp) {
  const links = screen.getAllByRole('link', { name })
  return links.find((link) => link.classList.contains('appNav-link')) ?? links[0]
}

describe('App routing integration', () => {
  it.each([
    ['/', 'Credence — Economic Trust'],
    ['/trust', 'Trust Score'],
  ])('renders public route %s when disconnected', async (path, expectedHeading) => {
    renderRoutes([path])

    expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /page not found/i })).not.toBeInTheDocument()
  })

  it('resolves trailing slash routes to the same page', async () => {
    renderRoutes(['/trust/'])

    expect(await screen.findByRole('heading', { name: 'Trust Score' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /page not found/i })).not.toBeInTheDocument()
  })

  it('renders NotFound for a deep unknown route', async () => {
    renderRoutes(['/some/deep/unknown'])

    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('redirects disconnected visits on private routes to /signin?next=... without flashing private content', async () => {
    renderRoutes(['/bond?tab=active'])

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/signin?next=%2Fbond%3Ftab%3Dactive'
      )
    })
    expect(screen.queryByRole('heading', { name: 'Bond USDC' })).not.toBeInTheDocument()
  })

  it('shows a loading state while wallet session is restoring with no flash of private content', () => {
    mockWalletState = createWalletState({ isRestoring: true })
    renderRoutes(['/settings'])

    expect(screen.getByRole('status')).toHaveTextContent(/restoring wallet session/i)
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.getByTestId('location-display')).toHaveTextContent('/settings')
  })

  it.each([
    ['/bond', 'Bond USDC'],
    ['/settings', 'Settings'],
  ])('renders private route %s when connected', async (path, expectedHeading) => {
    mockWalletState = createWalletState({
      address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      isConnected: true,
      connected: true,
    })
    renderRoutes([path])

    expect(await screen.findByRole('heading', { name: expectedHeading })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /page not found/i })).not.toBeInTheDocument()
  })

  it('navigates via header links and updates active-link state when connected', async () => {
    mockWalletState = createWalletState({
      address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      isConnected: true,
      connected: true,
    })
    renderRoutes(['/'])

    const bondLink = getDesktopNavLink(/bond/i)
    fireEvent.click(bondLink)
    expect(await screen.findByRole('heading', { name: 'Bond USDC' })).toBeInTheDocument()
    expect(bondLink).toHaveAttribute('aria-current', 'page')

    const trustLink = getDesktopNavLink(/trust score/i)
    fireEvent.click(trustLink)
    expect(await screen.findByRole('heading', { name: 'Trust Score' })).toBeInTheDocument()
    expect(trustLink).toHaveAttribute('aria-current', 'page')
    expect(bondLink).not.toHaveAttribute('aria-current')

    const settingsLink = getDesktopNavLink(/settings/i)
    fireEvent.click(settingsLink)
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(settingsLink).toHaveAttribute('aria-current', 'page')
  })

  it('redirects back to the original private route after connecting on /signin', async () => {
    const { rerender } = renderRoutes(['/bond?tab=active'])

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/signin?next=%2Fbond%3Ftab%3Dactive'
      )
    })

    mockWalletState = createWalletState({
      address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      isConnected: true,
      connected: true,
    })

    rerender(
      <MemoryRouter initialEntries={['/signin?next=%2Fbond%3Ftab%3Dactive']}>
        <SettingsProvider>
          <ToastProvider>
            <LocationDisplay />
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="trust" element={<TrustScore />} />
                <Route path="trust/summary" element={<TrustSummary />} />
                <Route path="signin" element={<SignIn />} />
                <Route element={<RequireWallet />}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="bond" element={<Bond />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ToastProvider>
        </SettingsProvider>
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: 'Bond USDC' })).toBeInTheDocument()
    expect(screen.getByTestId('location-display')).toHaveTextContent('/bond?tab=active')
  })

  it.each(['https://evil.com', '//evil.com'])(
    'ignores malicious next=%s and redirects to /dashboard after connect',
    async (maliciousNext) => {
      mockWalletState = createWalletState({
        address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        isConnected: true,
        connected: true,
      })

      renderRoutes([`/signin?next=${encodeURIComponent(maliciousNext)}`])

      await waitFor(() => {
        expect(screen.getByTestId('location-display')).toHaveTextContent('/dashboard')
      })
    }
  )
})
