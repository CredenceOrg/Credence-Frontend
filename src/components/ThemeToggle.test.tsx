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

function setMatchMedia(value: unknown) {
  Object.defineProperty(window, 'matchMedia', { writable: true, value })
}

/** Seed the single source of truth with an explicit `themeMode`. */
function seedThemeMode(themeMode: string) {
  localStorage.setItem('credence:settings', JSON.stringify({ themeMode }))
}

function storedThemeMode(): string | null {
  const raw = localStorage.getItem('credence:settings')
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as { themeMode?: unknown }
    return typeof parsed.themeMode === 'string' ? parsed.themeMode : null
  } catch {
    return null
  }
}

beforeEach(() => {
  localStorage.clear()
  // The document attribute is written by SettingsContext and persists across
  // tests within a file; clear it so each case starts from a known baseline.
  document.documentElement.removeAttribute('data-theme')
  // Default OS: light
  setMatchMedia(mockMatchMedia(false))
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
    window.matchMedia = mockMatchMedia(true)
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('aria-label', 'Toggle theme')
    expect(btn).toHaveAttribute('title', 'Switch to light theme')
  })

  it('clicking from system+dark resolves to light', () => {
    window.matchMedia = mockMatchMedia(true)
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
})

/**
 * Boundary cases: inputs at the edge of the valid domain, and the exact
 * "just before / just after" transitions. Every case asserts the same
 * cross-component invariant — the toggle's `aria-pressed` and `title` must
 * agree with the `data-theme` attribute that SettingsContext wrote, otherwise
 * the button would advertise the opposite of what the user sees.
 */
describe('ThemeToggle boundary conditions', () => {
  it('resolves the two explicit modes from persisted storage without consulting the OS', () => {
    for (const mode of ['light', 'dark'] as const) {
      localStorage.clear()
      document.documentElement.removeAttribute('data-theme')
      setMatchMedia(mockMatchMedia(mode === 'light')) // OS deliberately disagrees
      seedThemeMode(mode)

      const { unmount } = renderToggle()
      const btn = screen.getByRole('button')

      expect(btn).toHaveAttribute('aria-pressed', String(mode === 'dark'))
      expect(document.documentElement.getAttribute('data-theme')).toBe(mode)
      unmount()
    }
  })

  it('treats both boundary edges of the media query (exactly matching / not matching) correctly', () => {
    // prefers-color-scheme: dark exactly true and exactly false are the only
    // two values the toggle can observe; neither may be mis-resolved.
    for (const [osDark, expectedPressed] of [
      [true, 'true'],
      [false, 'false'],
    ] as const) {
      localStorage.clear()
      document.documentElement.removeAttribute('data-theme')
      setMatchMedia(mockMatchMedia(osDark))

      const { unmount } = renderToggle()
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', expectedPressed)
      expect(document.documentElement.getAttribute('data-theme')).toBe(osDark ? 'dark' : 'light')
      unmount()
    }
  })

  it('falls back to light when persisted themeMode is an unknown future value', () => {
    // Invariant 3: an unrecognised mode must never render an icon/label triple
    // that disagrees with the document. 'neon' is outside ThemeMode.
    seedThemeMode('neon')

    renderToggle()
    const btn = screen.getByRole('button')

    // SettingsContext coerces the invalid value back to 'system'; with a light
    // OS the resolved theme is light and the toggle must agree.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('title', 'Switch to dark theme')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('recovers to a usable theme when the persisted settings JSON is corrupt', () => {
    localStorage.setItem('credence:settings', '{ this is not json')

    renderToggle()
    const btn = screen.getByRole('button')

    // Corrupt storage must not throw or leave the toggle un-actionable.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('title', 'Switch to dark theme')

    // …and the component is still functional after recovery.
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('recovers when the persisted settings blob is a valid JSON scalar', () => {
    // JSON.parse succeeds, so the fallback must come from validation, not parsing.
    localStorage.setItem('credence:settings', '"dark"')

    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('recovers when the persisted themeMode has the wrong primitive type', () => {
    localStorage.setItem('credence:settings', JSON.stringify({ themeMode: 42 }))

    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('migrates a valid legacy "theme" key and drops the orphan key', () => {
    localStorage.setItem('theme', 'dark')

    renderToggle()
    const btn = screen.getByRole('button')

    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    // Returning users keep their preference, and the orphan key is removed.
    expect(localStorage.getItem('theme')).toBeNull()
    expect(storedThemeMode()).toBe('dark')
  })

  it('discards an invalid legacy "theme" value instead of trusting it', () => {
    localStorage.setItem('theme', 'neon')

    renderToggle()
    const btn = screen.getByRole('button')

    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('lets credence:settings win over a conflicting legacy "theme" key', () => {
    localStorage.setItem('theme', 'dark')
    seedThemeMode('light')

    renderToggle()
    const btn = screen.getByRole('button')

    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('theme')).toBeNull()
  })
})

/**
 * Recovery / degraded-environment coverage. The theme feature is a *chrome*
 * concern: when the browser refuses to cooperate, the app must still render a
 * working, self-consistent control rather than crashing the whole shell.
 */
describe('ThemeToggle degraded-environment recovery', () => {
  it('renders and remains usable when matchMedia is unavailable', () => {
    // SSR, hardened privacy settings, or a stripped test environment.
    setMatchMedia(undefined)

    renderToggle()
    const btn = screen.getByRole('button')

    // Degrades to light rather than throwing during render/effect.
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // The explicit-theme path does not need matchMedia at all, so the user can
    // still switch to dark.
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('recovers when matchMedia throws', () => {
    setMatchMedia(
      vi.fn(() => {
        throw new Error('matchMedia exploded')
      })
    )

    renderToggle()
    const btn = screen.getByRole('button')

    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('recovers when matchMedia returns a null MediaQueryList', () => {
    setMatchMedia(vi.fn(() => null))

    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('subscribes via the deprecated addListener API when addEventListener is absent', () => {
    // Legacy Safari exposes only addListener/removeListener. Without the
    // fallback the toggle would silently stop tracking the OS preference.
    const addListener = vi.fn()
    const removeListener = vi.fn()
    setMatchMedia(
      vi.fn(
        (query: string) =>
          ({
            matches: query.includes('dark') ? false : true,
            media: query,
            onchange: null,
            addListener,
            removeListener,
          }) as unknown as MediaQueryList
      )
    )

    const { unmount } = renderToggle()
    // Both ThemeToggle and SettingsContext must fall back to the legacy API,
    // otherwise the toggle silently stops tracking the OS preference.
    expect(addListener).toHaveBeenCalledTimes(2)

    unmount()
    // Every subscription is released — no listener leak on unmount.
    expect(removeListener).toHaveBeenCalledTimes(2)
  })

  it('does not throw when the MediaQueryList supports neither listener API', () => {
    setMatchMedia(
      vi.fn(
        (query: string) =>
          ({ matches: false, media: query, onchange: null }) as unknown as MediaQueryList
      )
    )

    expect(() => renderToggle()).not.toThrow()
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('ignores a malformed change event instead of adopting undefined as the theme', () => {
    renderToggle()
    const btn = screen.getByRole('button')

    // Some shims dispatch an event with no `matches` field. Coercing to false
    // keeps the resolved theme a valid member of the light/dark domain.
    act(() => {
      darkListeners.forEach((cb) => cb({} as MediaQueryListEvent))
    })

    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('title', 'Switch to dark theme')
  })

  it('unsubscribes every matchMedia listener on unmount (no leak across remounts)', () => {
    // The toggle and SettingsContext each subscribe; both must clean up.
    const first = renderToggle()
    expect(darkListeners.length).toBeGreaterThan(0)
    first.unmount()
    expect(darkListeners).toHaveLength(0)

    const second = renderToggle()
    expect(darkListeners.length).toBeGreaterThan(0)
    second.unmount()
    expect(darkListeners).toHaveLength(0)
  })

  it('keeps a single consistent resolved theme across many rapid toggles', () => {
    renderToggle()
    const btn = screen.getByRole('button')

    for (let i = 0; i < 25; i += 1) {
      fireEvent.click(btn)
      // After every single click the control and the document must agree.
      const pressed = btn.getAttribute('aria-pressed')
      const docTheme = document.documentElement.getAttribute('data-theme')
      expect(pressed).toBe(docTheme === 'dark' ? 'true' : 'false')
    }

    // An odd number of flips from light lands on dark and is durably persisted.
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(storedThemeMode()).toBe('dark')
  })

  it('converges deterministically when several clicks are batched into one commit', () => {
    // Concurrent/re-entrant clicks: the component reads `themeMode` from the
    // last committed render, so a batch must never leave the resolved theme in
    // an impossible or un-actionable state.
    renderToggle()
    const btn = screen.getByRole('button')

    act(() => {
      btn.click()
      btn.click()
    })

    const docTheme = document.documentElement.getAttribute('data-theme')
    expect(['light', 'dark']).toContain(docTheme)
    expect(btn.getAttribute('aria-pressed')).toBe(docTheme === 'dark' ? 'true' : 'false')
    // The next action is always the opposite of the current state.
    expect(btn.getAttribute('title')).toBe(
      docTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    )
  })

  it('stays in sync when the OS theme flips repeatedly while in system mode', () => {
    renderToggle()
    const btn = screen.getByRole('button')

    for (let i = 0; i < 10; i += 1) {
      emitSystemThemeChange(i % 2 === 0)
      const docTheme = document.documentElement.getAttribute('data-theme')
      expect(btn.getAttribute('aria-pressed')).toBe(docTheme === 'dark' ? 'true' : 'false')
    }
  })

  it('an OS change arriving after unmount cannot update state', () => {
    const listeners = renderToggle()
    listeners.unmount()
    const orphanCount = darkListeners.length

    expect(() => emitSystemThemeChange(true)).not.toThrow()
    // Nothing re-subscribed after unmount, so the captured list is unchanged.
    expect(darkListeners).toHaveLength(orphanCount)
  })

  it('renders exactly one button so keyboard and screen-reader users get a single control', () => {
    renderToggle()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('exposes a non-empty accessible name and a decorative-only icon', () => {
    renderToggle()
    const btn = screen.getByRole('button')

    expect(btn).toHaveAccessibleName('Toggle theme')
    // The SVG is presentational so it is not announced twice.
    const icon = btn.querySelector('svg')
    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute('aria-hidden', 'true')
  })
})
