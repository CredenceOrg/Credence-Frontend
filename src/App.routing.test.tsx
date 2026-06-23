import { beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import { WalletProvider } from './context/WalletContext'
import ToastProvider from './components/ToastProvider'
import Layout from './components/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Bond from './pages/Bond'
import TrustScore from './pages/TrustScore'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

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

function renderRoutes(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <SettingsProvider>
        <WalletProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="bond" element={<Bond />} />
                <Route path="trust" element={<TrustScore />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ToastProvider>
        </WalletProvider>
      </SettingsProvider>
    </MemoryRouter>,
  )
}

function getDesktopNavLink(name: RegExp) {
  const links = screen.getAllByRole('link', { name })
  return links.find((link) => link.classList.contains('appNav-link')) ?? links[0]
}

describe('App routing integration', () => {
  it.each([
    ['/', 'Credence — Economic Trust'],
    ['/bond', 'Bond USDC'],
    ['/trust', 'Trust Score'],
    ['/settings', 'Settings'],
  ])('renders the page heading for %s', async (path, expectedHeading) => {
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

  it('navigates via header links and updates active-link state', async () => {
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
})
