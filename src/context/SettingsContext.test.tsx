import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider, useSettings } from './SettingsContext'

const STORAGE_KEY = 'credence:settings'

function SettingsConsumer() {
  const s = useSettings()
  return (
    <div>
      <span data-testid="theme">{s.themeMode}</span>
      <span data-testid="network">{s.network}</span>
      <span data-testid="address">{s.addressDisplay}</span>
      <span data-testid="toasts">{String(s.toastsEnabled)}</span>
      <span data-testid="dismiss">{s.autoDismiss}</span>
      <button onClick={() => s.setThemeMode('dark')}>set dark</button>
      <button onClick={() => s.setNetwork('test')}>set testnet</button>
      <button onClick={() => s.setAddressDisplay('full')}>set full</button>
      <button onClick={() => s.setToastsEnabled(false)}>disable toasts</button>
      <button onClick={() => s.setAutoDismiss('3s')}>set 3s</button>
    </div>
  )
}

function renderWithProvider(initialStorage?: Record<string, unknown>) {
  if (initialStorage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialStorage))
  }
  return render(
    <SettingsProvider>
      <SettingsConsumer />
    </SettingsProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  // minimal matchMedia stub
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

afterEach(() => {
  localStorage.clear()
})

describe('SettingsProvider', () => {
  describe('defaults', () => {
    it('renders with default values when localStorage is empty', () => {
      renderWithProvider()
      expect(screen.getByTestId('theme').textContent).toBe('system')
      expect(screen.getByTestId('network').textContent).toBe('public')
      expect(screen.getByTestId('address').textContent).toBe('short')
      expect(screen.getByTestId('toasts').textContent).toBe('true')
      expect(screen.getByTestId('dismiss').textContent).toBe('5s')
    })

    it('hydrates state from existing localStorage entry', () => {
      renderWithProvider({ themeMode: 'dark', network: 'test', addressDisplay: 'full', toastsEnabled: false, autoDismiss: '3s' })
      expect(screen.getByTestId('theme').textContent).toBe('dark')
      expect(screen.getByTestId('network').textContent).toBe('test')
      expect(screen.getByTestId('address').textContent).toBe('full')
      expect(screen.getByTestId('toasts').textContent).toBe('false')
      expect(screen.getByTestId('dismiss').textContent).toBe('3s')
    })

    it('falls back to defaults when localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json')
      render(<SettingsProvider><SettingsConsumer /></SettingsProvider>)
      expect(screen.getByTestId('theme').textContent).toBe('system')
    })
  })

  describe('setters update state', () => {
    it('setThemeMode updates the theme', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'set dark' }))
      expect(screen.getByTestId('theme').textContent).toBe('dark')
    })

    it('setNetwork updates the network', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'set testnet' }))
      expect(screen.getByTestId('network').textContent).toBe('test')
    })

    it('setAddressDisplay updates the address display', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'set full' }))
      expect(screen.getByTestId('address').textContent).toBe('full')
    })

    it('setToastsEnabled updates toasts flag', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'disable toasts' }))
      expect(screen.getByTestId('toasts').textContent).toBe('false')
    })

    it('setAutoDismiss updates dismiss duration', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'set 3s' }))
      expect(screen.getByTestId('dismiss').textContent).toBe('3s')
    })
  })

  describe('localStorage persistence', () => {
    it('persists all fields after a setter is called', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'set dark' }))

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.themeMode).toBe('dark')
      expect(stored.network).toBe('public')
      expect(stored.toastsEnabled).toBe(true)
    })

    it('persists toastsEnabled=false', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'disable toasts' }))

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.toastsEnabled).toBe(false)
    })

    it('persists autoDismiss', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'set 3s' }))

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.autoDismiss).toBe('3s')
    })
  })

  describe('theme application', () => {
    it('sets data-theme attribute to "dark" when themeMode is dark', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'set dark' }))
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('sets data-theme to "light" when themeMode is light', () => {
      renderWithProvider({ themeMode: 'light' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('resolves system theme via matchMedia', () => {
      // matchMedia stub returns matches:false → light
      renderWithProvider({ themeMode: 'system' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('re-applies theme when prefers-color-scheme changes while themeMode is system', () => {
      // Use an object ref so TypeScript doesn't narrow the captured handler to null
      const captured: { handler: (() => void) | null } = { handler: null }
      const mql = {
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn((_: string, fn: () => void) => { captured.handler = fn }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
      window.matchMedia = vi.fn().mockReturnValue(mql)

      renderWithProvider({ themeMode: 'system' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')

      // Simulate OS switching to dark
      mql.matches = true
      captured.handler?.()
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      // Simulate OS switching back to light
      mql.matches = false
      captured.handler?.()
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })

  describe('idempotency (StrictMode double-invoke)', () => {
    it('is stable across two synchronous render cycles', () => {
      const { rerender } = renderWithProvider()
      rerender(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      )
      expect(screen.getByTestId('theme').textContent).toBe('system')
    })
  })

  describe('useSettings outside provider returns no-op defaults', () => {
    it('returns default values when rendered without a provider', () => {
      // SettingsContext default state has no-op setters; this verifies the import works
      render(<SettingsConsumer />)
      expect(screen.getByTestId('theme').textContent).toBe('system')
      expect(screen.getByTestId('toasts').textContent).toBe('true')
    })
  })
})
