import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ThemeToggle, { SunIcon } from './ThemeToggle'
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
let darkListeners: Array<(t: MediaQueryListEvent) => void> = []

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

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  it('reads only valid persisted themes and ignores corrupt values', () => {
    localStorage.setItem('theme', 'teal')
    expect(readPersistedTheme()).toBeUndefined()

    localStorage.setItem('theme', 'light')
    expect(readPersistedTheme()).toBe('light')
  })

  it('swallows storage write failures without breaking the toggle state', async () => {
    const user = userEvent.setup()
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    render(<ThemeToggle />)
    const button = screen.getByRole('button', { name: /switch to dark mode/i })
    expect(button).toBeInTheDocument()

    await user.click(button)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(setItemSpy).toHaveBeenCalled()
  })

  it('applies valid external theme change events and ignores invalid values', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button', { name: /switch to dark mode/i })
    act(() => {
      window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: 'dark' } }))
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    act(() => {
      window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: 'system' } }))
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    await user.click(button)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
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

  it('persists valid themes deterministically', () => {
    persistTheme('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})

describe('SunIcon', () => {
  it('renders a decorative SVG with the shared icon class', () => {
    const { container } = render(<SunIcon />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveClass('theme-toggle__icon')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('viewBox', '0 0 20 20')
  })

  it('renders the expected geometry deterministically', () => {
    const { container } = render(<SunIcon />)
    const svg = container.querySelector('svg')!
    expect(svg.querySelectorAll('circle')).toHaveLength(1)
    expect(svg.querySelectorAll('path')).toHaveLength(8)
    expect(svg.querySelector('circle')).toHaveAttribute('cx', '10')
    expect(svg.querySelector('circle')).toHaveAttribute('cy', '10')
    expect(svg.querySelector('circle')).toHaveAttribute('r', '3.5')
  })

  it('renders identical output across repeated mounts (no hidden state)', () => {
    const a = render(<SunIcon />).container.innerHTML
    const b = render(<SunIcon />).container.innerHTML
    expect(a).toBe(b)
  })

  it('does not throw when rendered without any providers or globals', () => {
    // Failure-boundary check: the icon is pure and must not depend on DOM/matchMedia.
    expect(() => render(<SunIcon />)).not.toThrow()
  })

  it('remains a valid SVG even when the browser has no matchMedia', () => {
    const original = window.matchMedia
    // @ts-expect-error -- deleberately remove the API to exercise the boundary.
    delete (window as { window?: unknown }).matchMedia
    try {
      const { container } = render(<SunIcon />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: original,
      })
    }
  })

  it('survives a matchMedia that throws (boundary failure mode)', () => {
    const original = window.matchMedia
    window.matchMedia = (() => {
      throw new Error('matchMedia unavailable')
    }) as unknown as typeof window.matchMedia
    try {
      expect(() => render(<SunIcon />)).not.toThrow()
    } finally {
      window.matchMedia = original
    }
  })

  it('remains stable when the containing button is re-rendered repeatedly', () => {
    const { rerun } = render(
      <SettingsProvider>
        <ThemeToggle />
      </SettingsProvider>
    )
    const before = document.querySelector('.theme-toggle__icon')!.outerHTML
    act(() => {
      rerun()
    })
    expect(document.querySelector('.theme-toggle__icon')!.outerHTML).toBe(before)
  })
})
