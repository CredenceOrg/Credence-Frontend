import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { SettingsProvider } from './context/SettingsContext'
import ToastProvider from './components/ToastProvider'
import Layout from './components/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Bond from './pages/Bond'
import TrustScore from './pages/TrustScore'
import Attestations from './pages/Attestations'
import Transactions from './pages/Transactions'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

vi.mock('./context/WalletContext', () => ({
  useWallet: () => ({
    connected: true,
    isConnected: true,
    isConnecting: false,
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    connect: vi.fn(),
    disconnect: vi.fn(),
    error: null,
    network: 'public',
  }),
  useWalletContext: () => ({
    connected: true,
    isConnected: true,
    isConnecting: false,
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    connect: vi.fn(),
    disconnect: vi.fn(),
    error: null,
    network: 'public',
  }),
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('./hooks/useTransactions', () => ({
  useTransactions: () => ({
    data: [
      {
        id: 'tx-1',
        type: 'bond_create',
        amountUsdc: 1000,
        status: 'confirmed',
        timestamp: '2026-06-15T10:30:00Z',
        hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('./hooks/useTrustScore', () => ({
  useTrustScore: () => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

afterEach(() => {
  document.body.focus()
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SettingsProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="bond" element={<Bond />} />
              <Route path="trust" element={<TrustScore />} />
              <Route path="attestations" element={<Attestations />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>,
  )
}

async function tabToElement(
  user: ReturnType<typeof userEvent.setup>,
  target: HTMLElement,
  maxSteps = 80,
): Promise<void> {
  document.body.focus()
  for (let i = 0; i < maxSteps; i++) {
    await user.tab()
    if (document.activeElement === target) return
  }
  throw new Error(
    `Could not reach "${target.textContent?.trim() || 'target'}" via Tab within ${maxSteps} steps`,
  )
}

describe('keyboard-only walkthrough', () => {
  describe('home page /', () => {
    beforeEach(() => renderAt('/'))

    it('tabs to the Create bond CTA', async () => {
      const user = userEvent.setup()
      const cta = screen.getByRole('button', { name: /create bond/i })
      expect(cta).toBeVisible()
      await tabToElement(user, cta)
      expect(cta).toHaveFocus()
    })

    it('tabs to the View trust score CTA', async () => {
      const user = userEvent.setup()
      const cta = screen.getByRole('button', { name: /view trust score/i })
      expect(cta).toBeVisible()
      await tabToElement(user, cta)
      expect(cta).toHaveFocus()
    })
  })

  describe('dashboard /dashboard', () => {
    beforeEach(() => renderAt('/dashboard'))

    it('renders the Dashboard heading', () => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })

    it('tabs to the Back to summary button', async () => {
      const user = userEvent.setup()
      const cta = screen.getByRole('button', { name: /back to summary/i })
      expect(cta).toBeVisible()
      await tabToElement(user, cta)
      expect(cta).toHaveFocus()
    })
  })

  describe('bond /bond', () => {
    beforeEach(() => renderAt('/bond'))

    it('tabs to the Create bond button', async () => {
      const user = userEvent.setup()
      const cta = screen.getByRole('button', { name: /^Create bond$/i })
      expect(cta).toBeVisible()
      await tabToElement(user, cta)
      expect(cta).toHaveFocus()
    })

    it('renders the Bond USDC heading', () => {
      expect(screen.getByRole('heading', { name: /Bond USDC/i })).toBeInTheDocument()
    })
  })

  describe('trust score /trust', () => {
    beforeEach(() => renderAt('/trust'))

    it('tabs to the How trust is earned button', async () => {
      const user = userEvent.setup()
      const cta = screen.getByRole('button', { name: /how trust is earned/i })
      expect(cta).toBeVisible()
      await tabToElement(user, cta)
      expect(cta).toHaveFocus()
    })
  })

  describe('attestations /attestations', () => {
    beforeEach(() => renderAt('/attestations'))

    it('tabs to the Submit Attestation button', async () => {
      const user = userEvent.setup()
      const cta = screen.getByRole('button', { name: /submit attestation/i })
      expect(cta).toBeVisible()
      await tabToElement(user, cta)
      expect(cta).toHaveFocus()
    })
  })

  describe('transactions /transactions', () => {
    beforeEach(() => renderAt('/transactions'))

    it('tabs to the status filter', async () => {
      const user = userEvent.setup()
      const filter = screen.getByRole('combobox', { name: /filter/i })
      expect(filter).toBeVisible()
      await tabToElement(user, filter)
      expect(filter).toHaveFocus()
    })
  })

  describe('settings /settings', () => {
    beforeEach(() => renderAt('/settings'))

    it('renders the Settings heading', () => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    })
  })

  describe('not found /*', () => {
    beforeEach(() => renderAt('/nonexistent'))

    it('tabs to the Back to Home button', async () => {
      const user = userEvent.setup()
      const cta = screen.getByRole('button', { name: /back to home/i })
      expect(cta).toBeVisible()
      await tabToElement(user, cta)
      expect(cta).toHaveFocus()
    })
  })
})
