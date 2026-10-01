import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ThemeToggle, { persistTheme, readPersistedTheme } from './ThemeToggle'

describe('ThemeToggle deterministic boundaries', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    })
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
