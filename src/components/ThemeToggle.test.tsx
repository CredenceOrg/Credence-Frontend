import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import ThemeToggle, { resolveInitialTheme, persistTheme, readPersistedTheme } from './ThemeToggle'

// Shared, mutable OS preference so that consumers which re-query matchMedia on
// a 'change' event observe the same value the event carries.
let osPrefersDark = false

function mockMatchMedia(prefersDark: boolean) {
  osPrefersDark = prefersDark
  return vi.fn((query: string): MediaQueryList => {
    const isDarkQuery = query.includes('dark')
    return {
      get matches() {
        return isDarkQuery ? osPrefersDark : !osPrefersDark
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList
  })

function renderToggle() {
  return render(<ThemeToggle />)
}

beforeEach(() => {
  localStorage.clear()
  delete (document.documentElement as HTMLElement).dataset.theme
  // Default OS: light
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: mockMatchMedia(false),
  })
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.restoreAllMocks()
})

describe('ThemeToggle', () => {
  it('renders a button', () => {
    renderToggle()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

it('starts with aria-pressed=false when OS is light', () => {
    renderToggle()
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('reads only valid persisted themes and ignores corrupt values', () => {
    localStorage.setItem('theme', 'teal')
    expect(readPersistedTheme()).toBeUndefined()

localStorage.setItem('theme', 'light')
    expect(readPersistedTheme()).toBe('light')
  })

  it('exposes the next action in accessible name and title on light theme', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark mode')
    expect(btn).toHaveAccessibleName('Switch to dark mode')
    expect(btn).toHaveAttribute('title', 'Switch to dark mode')
  })

it('clicking switches theme and flips aria-pressed', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Switch to light mode')
    expect(btn).toHaveAttribute('title', 'Switch to light mode')
  })

  it('swallows storage write failures without breaking the toggle state', async () => {
    const user = userEvent.setup()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

it('clicking twice returns to original state', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark mode')
  })

await user.click(button)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(setItemSpy).toHaveBeenCalled()
  })

  it('resolves dark correctly when OS prefers dark', () => {
    window.matchMedia = mockMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('title', 'Switch to light mode')
  })

  it('clicking from dark resolves to light', () => {
    window.matchMedia = mockMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

it('writes data-theme on the document root', () => {
    renderToggle()
    fireEvent.click(screen.getByRole('button'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

const button = screen.getByRole('button', { name: /switch to dark mode/i })
    act(() => {
      window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: 'dark' } }))
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

fireEvent.click(btn)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('persists the chosen theme to localStorage', () => {
    renderToggle()
    fireEvent.click(screen.getByRole('button'))
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('restores a persisted theme on mount', () => {
    localStorage.setItem('theme', 'dark')
    renderToggle()
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
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
  })

  it('reflects a system theme change dispatched as a theme-change event', () => {
    act(() => {
      window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: 'system' } }))
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

await user.click(button)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('ignores a corrupted persisted theme value', () => {
    localStorage.setItem('theme', 'purple')
    renderToggle()
    // Falls back to OS (light)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

it('rapid clicks produce a deterministic final state', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    for (let i = 0; i < 5; i++) fireEvent.click(btn)
    // 5 clicks from light -> dark
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('renders the correct icon boundary for the active theme', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: /switch to dark mode/i })
    expect(button.querySelector('svg[fill="currentColor"]')).toBeInTheDocument()
    expect(button.querySelector('svg[fill="none"]')).not.toBeInTheDocument()

await user.click(button)
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /switch to light mode/i }).querySelector('svg[fill="none"]')).toBeInTheDocument()
  })

  it('surfaces an error state when applying the theme fails', () => {
    const original = document.documentElement.dataset
    Object.defineProperty(document.documentElement, 'dataset', {
      configurable: true,
      get() {
        throw new Error('dataset unavailable')
      },
    })
    try {
      renderToggle()
      const btn = screen.getByRole('button')
      expect(btn).toHaveAttribute('aria-invalid', 'true')
      expect(btn).toHaveAttribute('title', 'Unable to apply the theme.')
    } finally {
      Object.defineProperty(document.documentElement, 'dataset', {
        configurable: true,
        value: original,
      })
    }
  })

it('does not throw when localStorage writes fail', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    try {
      renderToggle()
      const btn = screen.getByRole('button')
      expect(() => fireEvent.click(btn)).not.toThrow()
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    } finally {
      spy.mockRestore()
    }
  })

  it('resolveInitialTheme falls back to light when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    try {
      expect(resolveInitialTheme()).toBe('light')
    } finally {
      spy.mockRestore()
    }
  })

  it('resolveInitialTheme falls back to light when matchMedia throws', () => {
    const original = window.matchMedia
    window.matchMedia = (() => {
      throw new Error('matchMedia unavailable')
    }) as unknown as typeof window.matchMedia
    try {
      expect(resolveInitialTheme()).toBe('light')
    } finally {
      window.matchMedia = original
    }
  })

  it('registers a click that applies the theme exactly once per event', () => {
    renderToggle()
    const btn = screen.getByRole('button')
    act(() => {
      fireEvent.click(btn)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

  it('persists valid themes deterministically', () => {
    persistTheme('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})
