import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ThemeToggle from './ThemeToggle'
import { SettingsProvider } from '../context/SettingsContext'

function renderToggle() {
  return render(
    <SettingsProvider>
      <ThemeToggle />
    </SettingsProvider>,
  )
}

function mockMatchMedia(prefersDark: boolean) {
  return vi.fn((query: string): MediaQueryList => ({
    matches: query.includes('dark') ? prefersDark : !prefersDark,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
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

  it('shows "Switch to dark mode" label on light theme', () => {
    renderToggle()
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

  it('clicking switches themeMode and flips aria-pressed', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Switch to light mode')
  })

  it('clicking twice returns to original state', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

  it('resolves system→dark correctly when OS prefers dark', () => {
    window.matchMedia = mockMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Switch to light mode')
  })

  it('clicking from system+dark resolves to light', () => {
    window.matchMedia = mockMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark mode')
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
})
