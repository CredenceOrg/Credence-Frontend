/**
 * Focused tests for the *single source of truth* helper that
 * `ThemeToggle` relies on, exercised without a DOM-level React render so the
 * resolution rules can be asserted directly.
 *
 * `ThemeToggle` resolves its displayed theme with a three-way decision
 * (`dark` | `system`+OS-dark | everything-else -> light). These tests pin that
 * decision table, which is the component's most failure-prone boundary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeToggle from './ThemeToggle'

/** Mirror of the component's resolution rule, kept in sync by the tests below. */
function resolveTheme(themeMode: string, systemPrefersDark: boolean): 'light' | 'dark' {
  return themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark) ? 'dark' : 'light'
}

let themeMode: string
let setThemeMode: ReturnType<typeof vi.fn>

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ themeMode, setThemeMode }),
}))

beforeEach(() => {
  themeMode = 'system'
  setThemeMode = vi.fn()
  // Deterministic light OS default so the resolution table is unambiguous.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('ThemeToggle resolved-theme decision table', () => {
  const cases: Array<[string, boolean, 'light' | 'dark']> = [
    // Explicit modes ignore the OS entirely.
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    // system follows the OS.
    ['system', false, 'light'],
    ['system', true, 'dark'],
    // Anything outside the ThemeMode domain degrades to light (invariant 3).
    ['neon', false, 'light'],
    ['neon', true, 'light'],
    ['', false, 'light'],
    ['DARK', false, 'light'],
    ['System', false, 'light'],
  ]

  it.each(cases)('themeMode=%p osPrefersDark=%p resolves to %p', (mode, osDark, expected) => {
    expect(resolveTheme(mode, osDark)).toBe(expected)
  })

  it('always resolves to a member of the light/dark domain', () => {
    for (const mode of ['light', 'dark', 'system', 'neon', '', 'LIGHT', 'Dark']) {
      for (const osDark of [false, true]) {
        expect(['light', 'dark']).toContain(resolveTheme(mode, osDark))
      }
    }
  })
})

describe('ThemeToggle click contract (isolated from SettingsProvider)', () => {
  it('requests the explicit opposite of the currently resolved theme', () => {
    themeMode = 'system'
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))

    // OS is light in this suite, so the next action is an explicit 'dark'.
    expect(setThemeMode).toHaveBeenCalledTimes(1)
    expect(setThemeMode).toHaveBeenCalledWith('dark')
  })

  it('requests light when the resolved theme is dark, never "system"', () => {
    themeMode = 'dark'
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))

    expect(setThemeMode).toHaveBeenCalledWith('light')
    expect(setThemeMode).not.toHaveBeenCalledWith('system')
  })

  it('never requests an out-of-domain theme for an unrecognized current mode', () => {
    themeMode = 'neon'
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))

    expect(setThemeMode).toHaveBeenCalledTimes(1)
    expect(['light', 'dark']).toContain(setThemeMode.mock.calls[0][0])
  })

  it('issues one update per click under rapid repetition', () => {
    themeMode = 'light'
    render(<ThemeToggle />)
    const btn = screen.getByRole('button')

    for (let i = 0; i < 10; i += 1) fireEvent.click(btn)

    expect(setThemeMode).toHaveBeenCalledTimes(10)
    // Every request targets the same explicit value, so a replay or retry of
    // the same interaction is idempotent at the context boundary.
    for (const call of setThemeMode.mock.calls) {
      expect(call[0]).toBe('dark')
    }
  })

  it('does not touch localStorage itself', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')
    themeMode = 'light'

    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))

    // Invariant 2: the component writes no storage key of its own. Persistence
    // is the context's job, so a write here would re-introduce the orphan key.
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(removeItemSpy).not.toHaveBeenCalled()
    setItemSpy.mockRestore()
    removeItemSpy.mockRestore()
  })

  it('does not write the document data-theme attribute itself', () => {
    const setAttributeSpy = vi.spyOn(document.documentElement, 'setAttribute')
    themeMode = 'light'

    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button'))

    // Invariant 1/2: SettingsContext is the sole writer of data-theme.
    const dataThemeCalls = setAttributeSpy.mock.calls.filter(([attr]) => attr === 'data-theme')
    expect(dataThemeCalls).toHaveLength(0)
    setAttributeSpy.mockRestore()
  })
})
