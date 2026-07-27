/**
 * Focused test suite for the SettingsContext theme-application effect.
 *
 * Asserts the document.documentElement data-theme attribute for light, dark,
 * and system modes; tests OS-theme-change flips via a matchMedia mock; and
 * verifies the media-query event listener is cleaned up on mode change and on
 * unmount, locking down the dark-mode glue between settings and CSS.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider, useSettings } from './SettingsContext'

const STORAGE_KEY = 'credence:settings'

// ── matchMedia mock helpers ────────────────────────────────────────────────────

type MQLListener = (event: { matches: boolean }) => void

interface MockMQL {
  matches: boolean
  media: string
  onchange: null
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  dispatchEvent: ReturnType<typeof vi.fn>
  /** Test helper: simulate a prefers-color-scheme change. */
  simulateChange(matches: boolean): void
}

function createMatchMediaMock(initialMatches: boolean): MockMQL {
  const listeners = new Set<MQLListener>()

  const mql: MockMQL = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn((_: string, cb: MQLListener) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: MQLListener) => listeners.delete(cb)),
    dispatchEvent: vi.fn(),
    simulateChange(matches: boolean) {
      mql.matches = matches
      for (const cb of Array.from(listeners)) cb({ matches })
    },
  }

  return mql
}

function installMatchMedia(mql: MockMQL) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn(() => mql as unknown as MediaQueryList),
  })
}

// ── Test harness components ────────────────────────────────────────────────────

function ThemeDisplay() {
  const { themeMode, setThemeMode } = useSettings()
  return (
    <div>
      <span data-testid="theme-mode">{themeMode}</span>
      <button onClick={() => setThemeMode('light')}>set light</button>
      <button onClick={() => setThemeMode('dark')}>set dark</button>
      <button onClick={() => setThemeMode('system')}>set system</button>
    </div>
  )
}

function renderWithProvider(initialStorage?: Record<string, unknown>) {
  if (initialStorage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialStorage))
  }
  return render(
    <SettingsProvider>
      <ThemeDisplay />
    </SettingsProvider>
  )
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  cleanup()
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  cleanup()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsContext — theme application and media-query sync', () => {
  describe('explicit light mode', () => {
    it('sets data-theme="light" on mount when themeMode is "light"', () => {
      const mql = createMatchMediaMock(true) // OS is dark but we override to light
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'light' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('does not attach a matchMedia listener in light mode', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'light' })
      expect(mql.addEventListener).not.toHaveBeenCalled()
    })

    it('sets data-theme="light" when switched to light via setter', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(true) // OS dark
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      await user.click(screen.getByRole('button', { name: 'set light' }))
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })

  describe('explicit dark mode', () => {
    it('sets data-theme="dark" on mount when themeMode is "dark"', () => {
      const mql = createMatchMediaMock(false) // OS is light but we override to dark
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'dark' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('does not attach a matchMedia listener in dark mode', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'dark' })
      expect(mql.addEventListener).not.toHaveBeenCalled()
    })

    it('sets data-theme="dark" when switched to dark via setter', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(false) // OS light
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'light' })

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      await user.click(screen.getByRole('button', { name: 'set dark' }))
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  describe('system mode — initial mount', () => {
    it('sets data-theme="light" when system and OS prefers light', () => {
      const mql = createMatchMediaMock(false) // matches: false → light
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('sets data-theme="dark" when system and OS prefers dark', () => {
      const mql = createMatchMediaMock(true) // matches: true → dark
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('attaches a matchMedia change listener in system mode', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })
      expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    })
  })

  describe('system mode — OS theme change flip', () => {
    it('updates data-theme to "dark" when OS flips to dark while in system mode', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      act(() => mql.simulateChange(true))
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('updates data-theme to "light" when OS flips to light while in system mode', () => {
      const mql = createMatchMediaMock(true)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      act(() => mql.simulateChange(false))
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('tracks multiple OS flips correctly', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })

      act(() => mql.simulateChange(true))
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      act(() => mql.simulateChange(false))
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')

      act(() => mql.simulateChange(true))
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  describe('listener cleanup', () => {
    it('removes the matchMedia listener when switching away from system mode', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })

      expect(mql.addEventListener).toHaveBeenCalledTimes(1)
      const addedListener = mql.addEventListener.mock.calls[0][1]

      await user.click(screen.getByRole('button', { name: 'set dark' }))

      expect(mql.removeEventListener).toHaveBeenCalledWith('change', addedListener)
    })

    it('removes the matchMedia listener on unmount while in system mode', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      const { unmount } = renderWithProvider({ themeMode: 'system' })

      const addedListener = mql.addEventListener.mock.calls[0][1]
      unmount()

      expect(mql.removeEventListener).toHaveBeenCalledWith('change', addedListener)
    })

    it('uses the same function reference for add and remove', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })

      const addedRef = mql.addEventListener.mock.calls[0][1]

      await user.click(screen.getByRole('button', { name: 'set dark' }))

      const removedRef = mql.removeEventListener.mock.calls[0][1]
      expect(addedRef).toBe(removedRef)
    })

    it('no longer responds to OS changes after switching away from system', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'system' })

      await user.click(screen.getByRole('button', { name: 'set dark' }))
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      // OS flips to light — should not override the explicit dark setting
      act(() => mql.simulateChange(false))
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('re-attaches a listener when switching back to system mode', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'dark' })

      expect(mql.addEventListener).not.toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'set system' }))

      expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })

  describe('persistence — data-theme and localStorage stay in sync', () => {
    it('setting dark via setter updates both data-theme and localStorage payload', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider()

      await user.click(screen.getByRole('button', { name: 'set dark' }))

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.themeMode).toBe('dark')
    })

    it('setting light via setter updates both data-theme and localStorage payload', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'dark' })

      await user.click(screen.getByRole('button', { name: 'set light' }))

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.themeMode).toBe('light')
    })

    it('setting system via setter updates data-theme based on OS preference and localStorage', async () => {
      const user = userEvent.setup()
      const mql = createMatchMediaMock(true) // OS dark
      installMatchMedia(mql)
      renderWithProvider({ themeMode: 'light' })

      await user.click(screen.getByRole('button', { name: 'set system' }))

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      expect(stored.themeMode).toBe('system')
    })

    it('initializes from localStorage on mount and applies the stored theme', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode: 'dark', network: 'public', addressDisplay: 'short', toastsEnabled: true, autoDismiss: '5s' }))

      renderWithProvider()

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
      expect(screen.getByTestId('theme-mode').textContent).toBe('dark')
    })
  })

  describe('double mount / Strict Mode resilience', () => {
    it('data-theme is consistent after a render/rerender cycle', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      const { rerender } = renderWithProvider({ themeMode: 'dark' })

      rerender(
        <SettingsProvider>
          <ThemeDisplay />
        </SettingsProvider>
      )

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('listener count does not grow unboundedly across rerenders in system mode', () => {
      const mql = createMatchMediaMock(false)
      installMatchMedia(mql)
      const { rerender } = renderWithProvider({ themeMode: 'system' })

      rerender(
        <SettingsProvider>
          <ThemeDisplay />
        </SettingsProvider>
      )
      rerender(
        <SettingsProvider>
          <ThemeDisplay />
        </SettingsProvider>
      )

      // Each rerender triggers cleanup + re-register; net listeners should stay at 1.
      const addCount = mql.addEventListener.mock.calls.length
      const removeCount = mql.removeEventListener.mock.calls.length
      expect(addCount - removeCount).toBeLessThanOrEqual(1)
    })
  })
})
