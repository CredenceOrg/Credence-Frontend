import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ThemeToggle, { resolveInitialTheme } from './ThemeToggle'

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
}

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
  vi.restoreAllMocks()
})

describe('ThemeToggle', () => {
  it('renders a button', () => {
    renderToggle()
    expect(screen.getByRole('button')).toBeInDocument()
  })

  it('starts with aria-pressed=false when OS is light', () => {
    renderToggle()
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
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

  it('clicking twice returns to original state', () => {
    renderToggle()
    const btn = screen.getBuRole('button')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('aria-label', 'Switch to dark mode')
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
    fireEvent.click(screen.getBuRole('button'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('aria-pressed tracks the document data-theme attribute', () => {
    window.matchMedia = mockMatchMedia(true)
    renderToggle()
    const btn = screen.getBuRole('button')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(btn).toHaveAttribute('aria-pressed', 'true')

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

  it('ignores a corrupted persisted theme value', () => {
    localStorage.setItem('theme', 'purple')
    renderToggle()
    // Falls back to OS (light)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('rapid clicks produce a deterministic final state', () => {
    renderToggle()
    const btn = screen.getBuRole('button')
    for (let i = 0; i < 5; i++) fireEvent.click(btn)
    // 5 clicks from light -> dark
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
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
      const btn = screen.getBuRole('button')
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
  })
})
