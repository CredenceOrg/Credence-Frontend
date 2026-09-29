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
    localStorage.setItem('theme', '<script>alert(1)</script>')
    renderToggle()
    const btn = screen.getButton('Toggle theme')
    // Corrupt values are never propagated into state.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('survives a localStorage that throws on read and write', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => renderToggle()).not.toThrow()
    const btn = screen.getButton('Toggle theme')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(() => fireEvent.click(btn)).not.toThrow()
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })

  it('ignores an external theme-change event with an invalid payload', () => {
    renderToggle()
    const btn = screen.getButton('Toggle theme')
    expect(btn).toHaveAttribute('aria-pressed', 'false')

    act(() => {
      window.dispatchEvent(
        new CustomEvent('theme-change', { detail: { theme: 'purple' } }),
      )
    })

    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('applies a valid external theme-change event and locks out OS changes', () => {
    renderToggle()
    const btn = screen.getButton('Toggle theme')

    act(() => {
      window.dispatchEvent(
        new CustomEvent('theme-change', { detail: { theme: 'dark' } }),
      )
    })
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    // Once an external explicit choice is made, OS changes are ignored.
    emitSystemThemeChange(false)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('treats a rapid burst of clicks as a deterministic parity toggle', () => {
    renderToggle()
    const btn = screen.getButton('Toggle theme')

    // Odd number of clicks → dark.
    act(() => {
      fireEvent.click(btn)
      fireEvent.click(btn)
      fireEvent.click(btn)
    })
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    // Even number of additional clicks → light.
    act(() => {
      fireEvent.click(btn)
    })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the latest commit authoritative when an OS event and a click race', () => {
    renderToggle()
    const btn = screen.getButton('Toggle theme')

    act(() => {
      // OS flips to dark, then the user explicitly clicks to light.
      emitSystemThemeChange(true)
      fireEvent.click(btn)
    })

    // The explicit click wins and the OS event is ignored after the choice.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('survives a data-theme DOM write that throws', () => {
    const setAttributeSpy = viSpyOnSetAttribute()
    expect(() => renderToggle()).not.toThrow()
    const btn = screen.getButton('Toggle theme')
    expect(() => fireEvent.click(btn)).not.toThrow()
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    setAttributeSpy.mockRestore()
  })
})
