import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider, useSettings } from './SettingsContext'

const STORAGE_KEY = 'credence:settings'
type MatchMediaListener = (event: { matches: boolean }) => void

function StateDump() {
  const s = useSettings()
  return (
    <pre data-testid="state">
      {JSON.stringify({
        themeMode: s.themeMode,
        network: s.network,
        addressDisplay: s.addressDisplay,
        toastsEnabled: s.toastsEnabled,
        autoDismiss: s.autoDismiss,
      })}
    </pre>
  )
}

function Controls() {
  const s = useSettings()
  return (
    <div>
      <button data-testid="set-dark" onClick={() => s.setThemeMode('dark')}>
        dark
      </button>
      <button data-testid="set-system" onClick={() => s.setThemeMode('system')}>
        system
      </button>
      <button data-testid="save" onClick={() => s.saveSettings()}>
        save
      </button>
    </div>
  )
}

function setupMatchMedia(initialMatches = false) {
  const listeners = new Set<MatchMediaListener>()
  const add = vi.fn((_eventName: string, cb: MatchMediaListener) => listeners.add(cb))
  const remove = vi.fn((_eventName: string, cb: MatchMediaListener) => listeners.delete(cb))

  const mql = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: add,
    removeEventListener: remove,
    dispatchEvent: vi.fn(),
    // helper to simulate change events in tests
    _dispatch(matches: boolean) {
      mql.matches = matches
      for (const cb of Array.from(listeners)) cb({ matches })
    },
  }

  window.matchMedia = vi.fn((_query: string) => mql as unknown as MediaQueryList)
  return mql
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  cleanup()
})

describe('SettingsContext persistence & theme application', () => {
  it('hydrates defaults when no key present and applies system theme', () => {
    const mql = setupMatchMedia(false)

    render(
      <SettingsProvider>
        <StateDump />
      </SettingsProvider>
    )

    const state = JSON.parse(screen.getByTestId('state').textContent || '{}')
    expect(state).toEqual({
      themeMode: 'system',
      network: 'public',
      addressDisplay: 'short',
      toastsEnabled: true,
      autoDismiss: '5s',
    })

    // system + prefers-color-scheme false => light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(mql.addEventListener).toHaveBeenCalled()
  })

  it('restores valid JSON from localStorage', () => {
    const payload = {
      themeMode: 'dark',
      network: 'private',
      addressDisplay: 'long',
      toastsEnabled: false,
      autoDismiss: '10s',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    setupMatchMedia(false)

    render(
      <SettingsProvider>
        <StateDump />
      </SettingsProvider>
    )

    const state = JSON.parse(screen.getByTestId('state').textContent || '{}')
    expect(state).toEqual(payload)
    // explicit theme should be applied regardless of matchMedia
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('falls back gracefully on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-json')
    setupMatchMedia(false)

    expect(() =>
      render(
        <SettingsProvider>
          <StateDump />
        </SettingsProvider>
      )
    ).not.toThrow()

    const state = JSON.parse(screen.getByTestId('state').textContent || '{}')
    expect(state.themeMode).toBe('system')
  })

  it('persists full payload when saveSettings is called after changes', () => {
    setupMatchMedia(false)

    render(
      <SettingsProvider>
        <Controls />
      </SettingsProvider>
    )

    fireEvent.click(screen.getByTestId('set-dark'))
    fireEvent.click(screen.getByTestId('save'))

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const stored = JSON.parse(raw as string)
    expect(stored).toEqual({
      themeMode: 'dark',
      network: 'public',
      addressDisplay: 'short',
      toastsEnabled: true,
      autoDismiss: '5s',
    })
  })

  it('system theme follows matchMedia and updates on change', () => {
    const mql = setupMatchMedia(true)

    render(
      <SettingsProvider>
        <StateDump />
      </SettingsProvider>
    )

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // simulate user toggling OS theme
    mql._dispatch(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('removes matchMedia listener on theme change and on unmount', () => {
    const mql = setupMatchMedia(true)

    const { unmount } = render(
      <SettingsProvider>
        <Controls />
      </SettingsProvider>
    )

    // initial effect should have added listener
    expect(mql.addEventListener).toHaveBeenCalled()

    // change away from system — effect cleanup should remove previous listener
    fireEvent.click(screen.getByTestId('set-dark'))

    expect(mql.removeEventListener).toHaveBeenCalled()

    // unmount should also attempt to remove listener
    unmount()
    expect(mql.removeEventListener).toHaveBeenCalled()
  })
})
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
      <button onClick={() => s.saveSettings()}>save</button>
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
  document.documentElement.removeAttribute('data-theme')
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
      renderWithProvider({
        themeMode: 'dark',
        network: 'test',
        addressDisplay: 'full',
        toastsEnabled: false,
        autoDismiss: '3s',
      })
      expect(screen.getByTestId('theme').textContent).toBe('dark')
      expect(screen.getByTestId('network').textContent).toBe('test')
      expect(screen.getByTestId('address').textContent).toBe('full')
      expect(screen.getByTestId('toasts').textContent).toBe('false')
      expect(screen.getByTestId('dismiss').textContent).toBe('3s')
    })

    it('falls back to defaults when localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json')
      render(
        <SettingsProvider>
          <SettingsConsumer />
        </SettingsProvider>
      )
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

    it('persists full payload when saveSettings is called after changes', async () => {
      const user = userEvent.setup()
      renderWithProvider()
      await user.click(screen.getByRole('button', { name: 'set dark' }))
      await user.click(screen.getByRole('button', { name: 'save' }))

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored).toEqual({
        themeMode: 'dark',
        network: 'public',
        addressDisplay: 'short',
        toastsEnabled: true,
        autoDismiss: '5s',
      })
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
      renderWithProvider({ themeMode: 'system' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('re-applies theme when prefers-color-scheme changes while themeMode is system', () => {
      const captured: { handler: (() => void) | null } = { handler: null }
      const mql = {
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn((_: string, fn: () => void) => {
          captured.handler = fn
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
      window.matchMedia = vi.fn().mockReturnValue(mql)

      renderWithProvider({ themeMode: 'system' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')

      mql.matches = true
      captured.handler?.()
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      mql.matches = false
      captured.handler?.()
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('removes matchMedia listener on theme change and on unmount', async () => {
      const mql = {
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
      window.matchMedia = vi.fn().mockReturnValue(mql)

      const user = userEvent.setup()
      const { unmount } = renderWithProvider({ themeMode: 'system' })

      expect(mql.addEventListener).toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'set dark' }))
      expect(mql.removeEventListener).toHaveBeenCalled()

      unmount()
      expect(mql.removeEventListener).toHaveBeenCalled()
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
      render(<SettingsConsumer />)
      expect(screen.getByTestId('theme').textContent).toBe('system')
      expect(screen.getByTestId('toasts').textContent).toBe('true')
    })
  })

  describe("legacy 'theme' key migration", () => {
    it("adopts a valid legacy 'theme' value into themeMode and removes the key", () => {
      localStorage.setItem('theme', 'dark')

      renderWithProvider()

      expect(screen.getByTestId('theme').textContent).toBe('dark')
      // orphan key retired
      expect(localStorage.getItem('theme')).toBeNull()
      // migrated value folded into the single source of truth
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      expect(stored.themeMode).toBe('dark')
    })

    it("lets credence:settings win over a conflicting legacy 'theme' value", () => {
      localStorage.setItem('theme', 'dark')

      renderWithProvider({
        themeMode: 'light',
        network: 'public',
        addressDisplay: 'short',
        toastsEnabled: true,
        autoDismiss: '5s',
      })

      // single source of truth wins; legacy key is still cleaned up
      expect(screen.getByTestId('theme').textContent).toBe('light')
      expect(localStorage.getItem('theme')).toBeNull()
    })

    it("ignores an invalid legacy 'theme' value and falls back to default", () => {
      localStorage.setItem('theme', 'neon')

      renderWithProvider()

      expect(screen.getByTestId('theme').textContent).toBe('system')
      expect(localStorage.getItem('theme')).toBeNull()
    })

    it('does not show migrated theme as an unsaved change', () => {
      localStorage.setItem('theme', 'dark')

      render(
        <SettingsProvider>
          <UnsavedProbe />
        </SettingsProvider>,
      )

      expect(screen.getByTestId('theme').textContent).toBe('dark')
      expect(screen.getByTestId('unsaved').textContent).toBe('false')
    })
  })
})

function UnsavedProbe() {
  const s = useSettings()
  return (
    <div>
      <span data-testid="theme">{s.themeMode}</span>
      <span data-testid="unsaved">{String(s.hasUnsavedChanges)}</span>
    </div>
  )
}
