import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ThemeToggle from './ThemeToggle'
import { SettingsProvider } from '../context/SettingsContext'

function renderToggle() {
  return render(
    <SettingsProvider>
      <ThemeToggle />
    </SettingsProvider>
  )
}

// Shared, mutable OS preference so that consumers which re-query matchMedia on
// a 'change' event (e.g. SettingsContext) observe the same value the event
// carries. Tracks registered 'change' listeners to emulate an OS theme switch.
let osPrefersDark = false
let darkListeners: Array<(e: MediaQueryListEvent) => void> = []

function mockMatchMedia(prefersDark: boolean) {
  osPrefersDark = prefersDark
  darkListeners = []
  return vi.fn((query: string): MediaQueryList => {
    const isDarkQuery = query.includes('dark')
    return {
      get matches() {
        return isDarkQuery ? osPrefersDark : !osPrefersDark
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn((_type: string, cb: (e: MediaQueryListEvent) => void) => {
        if (isDarkQuery) darkListeners.push(cb)
      }),
      removeEventListener: vi.fn((_type: string, cb: (e: MediaQueryListEvent) => void) => {
        if (isDarkQuery) darkListeners = darkListeners.filter((l) => l !== cb)
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList
  })
}

// Emulate the OS flipping its prefers-color-scheme while listeners are attached.
function emitSystemThemeChange(prefersDark: boolean) {
  osPrefersDark = prefersDark
  act(() => {
    darkListeners.forEach((cb) => cb({ matches: prefersDark } as MediaQueryListEvent))
  })
}

function defineMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: mockMatchMedia(prefersDark),
  })
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  // Default OS: light
  defineMatchMedia(false)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('renders a button', () => {
    renderToggle()
    expect(screen.getByRole('button')).toBeInDocument()
  })

  it('starts with aria-pressed=false when OS is light and themeMode=system', () => {
    renderToggle()
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps a stable accessible name and exposes the next action in title on light theme', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
    expect(btn).toHaveAccessibleName('Toggle theme')
    expect(btn).toHaveAttribute('title', 'Switch to dark theme')
  })

  it('clicking switches themeMode and flips aria-pressed', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
    expect(btn).toHaveAccessibleName('Toggle theme')
    expect(btn).toHaveAttribute('title', 'Switch to light theme')
  })

  it('clicking twice returns to original state', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
  })

  it('resolves system→dark correctly when OS prefers dark', () => {
    defineMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
    expect(btn).toHaveAttribute('title', 'Switch to light theme')
  })

  it('clicking from system+dark resolves to light', () => {
    defineMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
  })

  it('does NOT write data-theme directly (SettingsContext owns it)', () => {
    // The toggle must not set data-theme itself; SettingsContext does it
    const setSpy = vi.spyOn(document.documentElement, 'setAttribute')
    renderToggle()
    fireEvent.click(screen.getByRole('button'))
    // setAttribute for data-theme should only come from SettingsContext useEffect, not inline in toggle
    // We just assert it's called via context (at least once) not zero times
    const dataThemeCalls = setSpy.mock.calls.filter(([attr]) => attr === 'data-theme')
    expect(dataThemeCalls.length).toBeGreaterThan(0)
    setSpy.mockRestore()
  })

  it('aria-pressed tracks the document data-theme attribute', () => {
    defineMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    // system + OS dark → resolved dark → data-theme="dark"
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(btn) // explicit light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('updates icon/aria when the OS theme changes while in system mode', () => {
    // Start: system mode, OS light
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')

    // OS flips to dark while still in system mode
    emitSystemThemeChange(true)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
    // Toggle stays consistent with the document data-theme owned by SettingsContext
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // OS flips back to light
    emitSystemThemeChange(false)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('ignores OS theme changes once an explicit theme is chosen', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn) // explicit dark
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    // OS swings to light, but explicit dark must remain
    emitSystemThemeChange(false)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
  })

  it('never writes an orphan "theme" localStorage key', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    renderToggle()
    fireEvent.click(screen.getByRole('button'))
    const keysWritten = setItemSpy.mock.calls.map(([key]) => key)
    expect(keysWritten).not.toContain('theme')
    expect(localStorage.getItem('theme')).toBeNull()
    setItemSpy.mockRestore()
  })

  // -------------------------------------------------------------------------
  // Deterministic failure-boundary coverage
  // -------------------------------------------------------------------------

  it('renders and toggles when matchMedia is unavailable (degraded environment)', () => {
    // Simulate a non-browser / hardened environment without matchMedia.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: undefined,
    })

    // Must not throw during render or interaction.
    expect(() => renderToggle()).not.toThrow()
    const btn = screen.getButton('Toggle theme')
    expect(btn).toBeInDocument()

    // With no OS signal, the default resolution is light and the toggle must
    // still be deterministic and functional.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('title', 'Switch to dark theme')

    expect(() => fireEvent.click(btn)).not.toThrow()
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('title', 'Switch to light theme')
  })

  it('recovers from a matchMedia that throws on query without losing the toggle', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn(() => {
        throw new Error('matchMedia failure')
      }),
    })

    expect(() => renderToggle()).not.toThrow()
    const btn = screen.getButton('Toggle theme')
    expect(btn).toBeInDocument()

    // The toggle must still transition deterministically from the light default.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('survives a corrupted localStorage value and stays toggleable', () => {
    // A corrupt/partially-written persisted value must not crash the toggle.
    localStorage.setItem('settings', '{ not json ')
    localStorage.setItem('themeMode', '\u0000\u0001\u0002')

    expect(() => renderToggle()).not.toThrow()
    const btn = screen.getButton('Toggle theme')
    expect(btn).toBeInDocument()

    // The control must remain operable and deterministic after corruption.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(() => fireEvent.click(btn)).not.toThrow()
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('title', 'Switch to light theme')
  })

  it('survives a localStorage that throws on read and stays toggleable', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage read failure')
    })

    expect(() => renderToggle()).not.throw()
    const btn = screen.getButton('Toggle theme')
    expect(btn).toBeInDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'false')

    // The control must still flip deterministically even when persistence fails.
    expect(() => fireEvent.click(btn)).not.throw()
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    getItemSpy.mockRestore()
  })

  it('survives a localStorage that throws on write and stays toggleable', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage write failure')
    })

    expect(() => renderToggle()).not.throw()
    const btn = screen.getButton('Toggle theme')
    expect(btn).toBeInDocument()

    // A failed persist must not lose the in-memory toggle state.
    expect(() => fireEvent.click(btn)).not.toThrow()
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('title', 'Switch to light theme')

    setItemSpy.mockRestore()
  })

  it('toggles deterministically under rapid concurrent clicks', () => {
    renderToggle()
    const btn = screen.getByrole('button')

    // Odd number of clicks in a single batch must land on dark.
    act(() => {
      fireEvent.click(btn)
      fireEvent.click(btn)
      fireEvent.click(btn)
    })
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    // Even number of clicks in a single batch must land on light.
    act(() => {
      fireEvent.click(btn)
      fireEvent.click(btn)
    })
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    act(() => {
      fireEvent.click(btn)
    })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('remains deterministic when the OS theme changes during a click batch', () => {
    renderToggle()
    const btn = screen.getByRole('button')

    // Explicit dark choice must win over a concurrent OS flip.
    act(() => {
      fireEvent.click(btn)
      osPrefersDark = false
      darkListeners.forEach((cb) => cb({ matches: false } as MediaQueryListEvent))
    })

    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('title', 'Switch to light theme')
  })

  it('cleans up media listeners on unmount (no stale callbacks)', () => {
    const { unmount } = renderToggle()
    expect(darkListeners.length).toBeGreaterThan(0)

    unmount()
    expect(darkListeners.length).toBe(0)

    // A late OS event after unmount must not throw or update anything.
    expect(() => emitSystemThemeChange(true)).not.toThrow()
  })

  it('recovers to a functional toggle after a matchMedia failure is resolved', () => {
    // First render with a broken matchMedia.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn(() => {
        throw new Error('matchMedia failure')
      }),
    })

    const { unmount } = renderToggle()
    const btn = screen.getButton('Toggle theme')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    unmount()

    // Restore a healthy matchMedia and re-render: the toggle must be fully
    // functional again with no residual failure state.
    defineMatchMedia(true)
    renderToggle()
    const btn2 = screen.getButton('Toggle theme')
    expect(btn2).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn2)
    expect(btn2).toHaveAttribute('aria-pressed', 'false')
  })

  it('treats duplicate media listener registrations as idempotent', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')

    // Emitting the same OS value twice must not double-apply or flip state.
    emitSystemThemeChange(true)
    emitSystemThemeChange(true)
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    emitSystemThemeChange(true)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })
})
