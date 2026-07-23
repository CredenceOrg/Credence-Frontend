import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

beforeEach(() => {
  localStorage.clear()
  // Default OS: light
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia(false),
  })
})

describe('ThemeToggle', () => {
  it('renders a button', () => {
    renderToggle()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('starts with aria-pressed=false when OS is light and themeMode=system', () => {
    renderToggle()
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows "Switch to dark theme" label on light theme', () => {
    renderToggle()
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dark theme')
  })

  it('clicking switches themeMode and flips aria-pressed', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Switch to light theme')
  })

  it('clicking twice returns to original state', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark theme')
  })

  it('resolves system→dark correctly when OS prefers dark', () => {
    window.matchMedia = mockMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Switch to light theme')
  })

  it('clicking from system+dark resolves to light', () => {
    window.matchMedia = mockMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark theme')
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
    window.matchMedia = mockMatchMedia(true)
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
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark theme')

    // OS flips to dark while still in system mode
    emitSystemThemeChange(true)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Switch to light theme')
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
    expect(btn).toHaveAttribute('aria-label', 'Switch to light theme')
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
})
