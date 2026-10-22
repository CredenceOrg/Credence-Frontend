/**
 * Failure-boundary coverage for `getSystemPrefersDark` and its consumers.
 *
 * Matrix covered here (the happy path lives in `ThemeToggle.test.tsx`):
 * - success: valid OS preference reads and live change delivery
 * - rejection: `window`/`matchMedia` missing, non-callable, throwing, or
 *   returning an unusable `MediaQueryList`
 * - boundary: non-boolean `.matches`, invalid/stale event payloads, duplicate
 *   and concurrent reads
 * - retry: bounded subscription attempts with backoff, then give-up
 * - recovery: environment heals mid-flight and after give-up
 * - regression: a failed system read never loses the user's persisted theme
 *   and never leaves the toggle inoperable
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeToggle, {
  SUBSCRIBE_MAX_ATTEMPTS,
  getSystemPrefersDark,
  readSystemPrefersDark,
  resetSystemPrefersDarkDiagnostics,
  subscribeSystemPrefersDark,
} from './ThemeToggle'
import { SettingsProvider, useSettings } from '../context/SettingsContext'

type ChangeHandler = (event: MediaQueryListEvent) => void

interface MediaStub {
  /** Mutable `matches` — flip it before emitting to simulate an OS change. */
  matches: boolean
  listeners: ChangeHandler[]
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  /** Dispatches a change event with an arbitrary (possibly invalid) payload. */
  emit(matches: unknown): void
}

const originalMatchMedia = window.matchMedia

/** Installs a `window.matchMedia` implementation; returns its mutable stub. */
function installMatchMedia(factory: (query: string) => unknown): ReturnType<typeof vi.fn> {
  const impl = vi.fn(factory)
  window.matchMedia = impl as unknown as typeof window.matchMedia
  return impl
}

function installHealthyMatchMedia(prefersDark: boolean): {
  impl: ReturnType<typeof vi.fn>
  stub: MediaStub
} {
  const stub: MediaStub = {
    matches: prefersDark,
    listeners: [],
    addEventListener: undefined as unknown as ReturnType<typeof vi.fn>,
    removeEventListener: undefined as unknown as ReturnType<typeof vi.fn>,
    emit(matches: unknown) {
      // A valid payload advances the OS value; an invalid one leaves the last
      // known value in place (stale), mirroring a malformed dispatch.
      if (typeof matches === 'boolean') stub.matches = matches
      act(() => {
        // Copy: a listener may detach itself during dispatch.
        stub.listeners.slice().forEach((cb) => cb({ matches } as unknown as MediaQueryListEvent))
      })
    },
  }
  stub.addEventListener = vi.fn((_type: string, cb: ChangeHandler) => {
    stub.listeners.push(cb)
  })
  stub.removeEventListener = vi.fn((_type: string, cb: ChangeHandler) => {
    stub.listeners = stub.listeners.filter((l) => l !== cb)
  })

  const impl = installMatchMedia(() => ({
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    get matches() {
      return stub.matches
    },
    addEventListener: stub.addEventListener,
    removeEventListener: stub.removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

  return { impl, stub }
}

/** Minimal MediaQueryList-shaped object; omit fields per test. */
function mediaQueryListShape(overrides: Record<string, unknown> = {}) {
  return {
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    ...overrides,
  }
}

function warnOutput(spy: { mock: { calls: unknown[][] } }): string {
  return spy.mock.calls.flat().join(' ')
}

let warnSpy: {
  mock: { calls: unknown[][] }
  mockRestore: () => void
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  resetSystemPrefersDarkDiagnostics()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
  warnSpy.mockRestore()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ─────────────────────────────────────────────────────────────────────
// getSystemPrefersDark — success and rejection boundaries
// ─────────────────────────────────────────────────────────────────────

describe('getSystemPrefersDark: valid input', () => {
  it('returns true when the OS prefers dark', () => {
    installHealthyMatchMedia(true)
    expect(getSystemPrefersDark()).toBe(true)
    expect(readSystemPrefersDark()).toEqual({ prefersDark: true, source: 'media' })
  })

  it('returns false when the OS prefers light and logs nothing', () => {
    installHealthyMatchMedia(false)
    expect(getSystemPrefersDark()).toBe(false)
    expect(readSystemPrefersDark()).toEqual({ prefersDark: false, source: 'media' })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('returns a strict boolean in every outcome (never truthy garbage)', () => {
    installHealthyMatchMedia(true)
    expect(getSystemPrefersDark()).toBe(true)
    installMatchMedia(() => ({ matches: 'definitely-not-a-boolean' }))
    expect(getSystemPrefersDark()).toBe(false)
  })
})

describe('getSystemPrefersDark: rejection boundaries', () => {
  it('returns false when window is unavailable (SSR)', () => {
    vi.stubGlobal('window', undefined)
    expect(getSystemPrefersDark()).toBe(false)
    expect(readSystemPrefersDark()).toEqual({
      prefersDark: false,
      source: 'fallback',
      failure: 'window-unavailable',
    })
    vi.unstubAllGlobals()
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a non-callable object', { matches: true }],
    ['a string', 'matchMedia'],
  ])('returns false when window.matchMedia is %s', (_label, value) => {
    window.matchMedia = value as unknown as typeof window.matchMedia
    expect(getSystemPrefersDark()).toBe(false)
    expect(readSystemPrefersDark()).toMatchObject({
      source: 'fallback',
      failure: 'match-media-unavailable',
    })
  })

  it('returns false without throwing when matchMedia throws, and never leaks the error text', () => {
    installMatchMedia(() => {
      throw new Error('SecurityError: denied for user=alice token=sk_live_SECRET')
    })
    expect(() => getSystemPrefersDark()).not.toThrow()
    expect(getSystemPrefersDark()).toBe(false)
    expect(readSystemPrefersDark()).toMatchObject({
      source: 'fallback',
      failure: 'match-media-threw',
    })
    const logged = warnOutput(warnSpy)
    expect(logged).toContain('theme_system_preference_unavailable')
    expect(logged).toContain('match-media-threw')
    expect(logged).not.toContain('sk_live_SECRET')
    expect(logged).not.toContain('alice')
  })

  it('returns false when matchMedia resolves to a non-object', () => {
    installMatchMedia(() => null)
    expect(getSystemPrefersDark()).toBe(false)
    expect(readSystemPrefersDark()).toMatchObject({ failure: 'invalid-media-query-list' })
  })

  it('returns false when reading .matches throws', () => {
    installMatchMedia(() => ({
      get matches(): boolean {
        throw new Error('revoked proxy')
      },
    }))
    expect(() => getSystemPrefersDark()).not.toThrow()
    expect(getSystemPrefersDark()).toBe(false)
    expect(readSystemPrefersDark()).toMatchObject({ failure: 'matches-threw' })
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['the string "true"', 'true'],
    ['the number 1', 1],
    ['an object', {}],
  ])('treats .matches = %s as unreadable rather than dark', (_label, value) => {
    installMatchMedia(() => ({ matches: value }))
    expect(getSystemPrefersDark()).toBe(false)
    expect(readSystemPrefersDark()).toMatchObject({
      source: 'fallback',
      failure: 'matches-not-boolean',
    })
  })
})

describe('getSystemPrefersDark: duplicate and concurrent execution', () => {
  it('is idempotent across repeated synchronous calls', () => {
    installHealthyMatchMedia(true)
    const first = readSystemPrefersDark()
    for (let i = 0; i < 25; i += 1) {
      expect(readSystemPrefersDark()).toEqual(first)
      expect(getSystemPrefersDark()).toBe(true)
    }
  })

  it('is deterministic across concurrent (promise-interleaved) calls', async () => {
    installHealthyMatchMedia(true)
    const results = await Promise.all(
      Array.from({ length: 25 }, async () => {
        await Promise.resolve()
        return getSystemPrefersDark()
      })
    )
    expect(new Set(results)).toEqual(new Set([true]))
  })

  it('never writes storage — a read cannot lose or duplicate persisted user data', () => {
    installHealthyMatchMedia(true)
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')
    getSystemPrefersDark()
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(removeItemSpy).not.toHaveBeenCalled()
    setItemSpy.mockRestore()
    removeItemSpy.mockRestore()
  })

  it('reports each failure class once per session (no log storm on retries)', () => {
    installMatchMedia(() => {
      throw new Error('always fails')
    })
    for (let i = 0; i < 10; i += 1) getSystemPrefersDark()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnOutput(warnSpy)).toContain('match-media-threw')

    // Reset restores full diagnosability for the next failure class.
    resetSystemPrefersDarkDiagnostics()
    getSystemPrefersDark()
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })
})

// ─────────────────────────────────────────────────────────────────────
// subscribeSystemPrefersDark — delivery, stale payloads, containment
// ─────────────────────────────────────────────────────────────────────

describe('subscribeSystemPrefersDark', () => {
  it('delivers validated change events and unsubscribes idempotently', () => {
    const { stub } = installHealthyMatchMedia(false)
    const received: boolean[] = []
    const sub = subscribeSystemPrefersDark((v) => received.push(v))

    expect(sub.active).toBe(true)
    stub.matches = true
    stub.emit(true)
    expect(received).toEqual([true])

    sub.unsubscribe()
    sub.unsubscribe() // duplicate unsubscribe is a safe no-op
    expect(stub.listeners).toHaveLength(0)
    stub.matches = false
    stub.emit(false)
    expect(received).toEqual([true])
  })

  it('falls back to the legacy addListener API when addEventListener is absent', () => {
    const legacyListeners: ChangeHandler[] = []
    const removeListener = vi.fn((cb: ChangeHandler) => {
      const i = legacyListeners.indexOf(cb)
      if (i >= 0) legacyListeners.splice(i, 1)
    })
    installMatchMedia(() =>
      mediaQueryListShape({
        addEventListener: undefined,
        removeEventListener: undefined,
        addListener: (cb: ChangeHandler) => legacyListeners.push(cb),
        removeListener,
      })
    )

    const received: boolean[] = []
    const sub = subscribeSystemPrefersDark((v) => received.push(v))
    expect(sub.active).toBe(true)
    legacyListeners.forEach((cb) => cb({ matches: true } as MediaQueryListEvent))
    expect(received).toEqual([true])
    sub.unsubscribe()
    expect(removeListener).toHaveBeenCalledTimes(1)
  })

  it('is inactive (never throws) when the environment exposes no listener API', () => {
    installMatchMedia(() =>
      mediaQueryListShape({
        addEventListener: undefined,
        addListener: undefined,
        removeEventListener: undefined,
        removeListener: undefined,
      })
    )
    let sub: ReturnType<typeof subscribeSystemPrefersDark> | undefined
    expect(() => {
      sub = subscribeSystemPrefersDark(() => {})
    }).not.toThrow()
    expect(sub!.active).toBe(false)
    expect(() => sub!.unsubscribe()).not.toThrow()
    expect(warnOutput(warnSpy)).toContain('subscribe-unavailable')
  })

  it('is inactive (never throws) when registration throws', () => {
    installMatchMedia(() =>
      mediaQueryListShape({
        addEventListener: vi.fn(() => {
          throw new Error('listener quota exceeded')
        }),
      })
    )
    let sub: ReturnType<typeof subscribeSystemPrefersDark> | undefined
    expect(() => {
      sub = subscribeSystemPrefersDark(() => {})
    }).not.toThrow()
    expect(sub!.active).toBe(false)
    expect(() => sub!.unsubscribe()).not.toThrow()
  })

  it('is inactive when matchMedia itself throws', () => {
    installMatchMedia(() => {
      throw new Error('nope')
    })
    const sub = subscribeSystemPrefersDark(() => {})
    expect(sub.active).toBe(false)
    expect(() => sub.unsubscribe()).not.toThrow()
  })

  it('drops stale/invalid event payloads instead of coercing them', () => {
    const { stub } = installHealthyMatchMedia(false)
    const received: boolean[] = []
    subscribeSystemPrefersDark((v) => received.push(v))

    stub.emit('true') // truthy non-boolean must NOT become dark
    stub.emit(undefined)
    stub.emit({ matches: true })
    expect(received).toEqual([])

    stub.emit(true)
    expect(received).toEqual([true])
    expect(warnOutput(warnSpy)).toContain('matches-not-boolean')
  })

  it('contains a throwing listener so later events still arrive', () => {
    const { stub } = installHealthyMatchMedia(false)
    let calls = 0
    subscribeSystemPrefersDark(() => {
      calls += 1
      throw new Error('consumer exploded')
    })

    expect(() => stub.emit(true)).not.toThrow()
    expect(calls).toBe(1)
    expect(() => stub.emit(false)).not.toThrow()
    expect(calls).toBe(2)
    expect(warnOutput(warnSpy)).toContain('listener-threw')
  })

  it('detaches on unsubscribe so a late event cannot update unmounted consumers', () => {
    const { stub } = installHealthyMatchMedia(false)
    const received: boolean[] = []
    const sub = subscribeSystemPrefersDark((v) => received.push(v))
    sub.unsubscribe()
    expect(stub.removeEventListener).toHaveBeenCalledTimes(1)
    expect(stub.listeners).toHaveLength(0)
    stub.emit(true)
    expect(received).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────
// ThemeToggle — component-level failure, retry, recovery, regression
// ─────────────────────────────────────────────────────────────────────

function renderToggle() {
  return render(
    <SettingsProvider>
      <ThemeToggle />
    </SettingsProvider>
  )
}

/** Exposes `setThemeMode` so tests can drive a system → explicit → system cycle. */
function SystemSwitchHarness() {
  const { setThemeMode } = useSettings()
  return (
    <>
      <ThemeToggle />
      <button type="button" data-testid="set-system" onClick={() => setThemeMode('system')}>
        use system
      </button>
    </>
  )
}

describe('ThemeToggle: system read fails (rejection)', () => {
  it('renders a deterministic light fallback with a diagnosable source attribute', () => {
    installMatchMedia(() => {
      throw new Error('denied secret=abc123')
    })

    expect(() => renderToggle()).not.toThrow()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('data-theme-source', 'fallback')
    // SettingsContext still owns data-theme and must not crash either.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    const logged = warnOutput(warnSpy)
    expect(logged).toContain('theme_system_preference_unavailable')
    expect(logged).not.toContain('abc123')
  })

  it('stays operable: clicking still flips the theme and leaves the fallback path', () => {
    installMatchMedia(() => {
      throw new Error('nope')
    })
    renderToggle()
    const btn = screen.getByRole('button')

    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('data-theme-source', 'explicit')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('regression: a saved explicit theme survives a failing system read (no data loss)', () => {
    localStorage.setItem(
      'credence:settings',
      JSON.stringify({
        themeMode: 'dark',
        network: 'public',
        addressDisplay: 'short',
        toastsEnabled: true,
        autoDismiss: '5s',
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      })
    )
    installMatchMedia(() => {
      throw new Error('environment broken')
    })

    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('data-theme-source', 'explicit')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(JSON.parse(localStorage.getItem('credence:settings')!).themeMode).toBe('dark')

    // The persisted preference still round-trips through SettingsContext.
    fireEvent.click(btn)
    expect(JSON.parse(localStorage.getItem('credence:settings')!).themeMode).toBe('light')
    // The legacy orphan key is never resurrected.
    expect(localStorage.getItem('theme')).toBeNull()
  })
})

describe('ThemeToggle: bounded retries (retry)', () => {
  it('stops retrying after SUBSCRIBE_MAX_ATTEMPTS and keeps the fallback value', () => {
    vi.useFakeTimers()
    const matchMedia = installMatchMedia(() => {
      throw new Error('still broken')
    })

    render(<ThemeToggle />)
    const btn = screen.getByRole('button')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const callsAfterBudget = matchMedia.mock.calls.length
    expect(callsAfterBudget).toBeGreaterThan(0)
    // 1 lazy read on mount + (read + subscribe) per attempt, never more.
    expect(callsAfterBudget).toBeLessThanOrEqual(1 + 2 * SUBSCRIBE_MAX_ATTEMPTS)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(matchMedia.mock.calls.length).toBe(callsAfterBudget)

    expect(btn).toHaveAttribute('aria-pressed', 'false')
    expect(btn).toHaveAttribute('data-theme-source', 'fallback')
  })

  it('recovers mid-flight: transient failures are retried until the environment heals', () => {
    vi.useFakeTimers()
    // Fails the mount read, the first re-read, and the first subscribe attempt.
    let failuresLeft = 3
    const matchMedia = installMatchMedia(() => {
      if (failuresLeft > 0) {
        failuresLeft -= 1
        throw new Error('transient')
      }
      return mediaQueryListShape({ matches: true })
    })

    render(<ThemeToggle />)
    const btn = screen.getByRole('button')
    // First attempt failed: the last known (light) value is retained.
    expect(btn).toHaveAttribute('data-theme-source', 'fallback')

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(btn).toHaveAttribute('data-theme-source', 'system')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    // Bounded: mount read + failed round + one successful round, nothing more.
    expect(matchMedia.mock.calls.length).toBeLessThanOrEqual(1 + 2 * SUBSCRIBE_MAX_ATTEMPTS)

    // Live subscription is established after recovery: no further retries fire.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(matchMedia.mock.calls.length).toBeLessThanOrEqual(1 + 2 * SUBSCRIBE_MAX_ATTEMPTS)
  })
})

describe('ThemeToggle: recovery after give-up (failure recovery)', () => {
  it('re-attaches on the next themeMode transition once the environment heals', () => {
    vi.useFakeTimers()
    const matchMedia = installMatchMedia(() => {
      throw new Error('broken')
    })

    render(
      <SettingsProvider>
        <SystemSwitchHarness />
      </SettingsProvider>
    )
    const toggle = screen.getByRole('button', { name: 'Toggle theme' })

    // Exhaust the retry budget while the environment is broken.
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(toggle).toHaveAttribute('data-theme-source', 'fallback')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    // Environment heals.
    const healthy = installHealthyMatchMedia(true)

    // system → explicit (also triggers a resync/reattach attempt)
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveAttribute('data-theme-source', 'explicit')

    // explicit → system: value re-read from the now-healthy environment
    fireEvent.click(screen.getByTestId('set-system'))
    expect(toggle).toHaveAttribute('data-theme-source', 'system')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // And live OS changes are flowing again.
    healthy.stub.matches = false
    healthy.stub.emit(false)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle).toHaveAttribute('data-theme-source', 'system')
    expect(matchMedia).toHaveBeenCalled()
  })
})

describe('ThemeToggle: concurrent and stale change events', () => {
  it('applies the last of a rapid burst of valid events (no torn state)', () => {
    const { stub } = installHealthyMatchMedia(false)
    renderToggle()
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')

    stub.emit(true)
    stub.emit(false)
    stub.emit(true)

    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('ignores a stale/invalid OS event and keeps the last good value', () => {
    const { stub } = installHealthyMatchMedia(false)
    renderToggle()
    const btn = screen.getByRole('button')

    stub.emit(true)
    expect(btn).toHaveAttribute('aria-pressed', 'true')

    stub.emit('not-a-boolean')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
    expect(btn).toHaveAttribute('data-theme-source', 'system')

    stub.emit(false)
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('detaches its listener on unmount so late events cannot update dead state', () => {
    const { stub } = installHealthyMatchMedia(false)
    const { unmount } = renderToggle()
    expect(stub.listeners.length).toBeGreaterThan(0)

    unmount()
    expect(stub.listeners).toHaveLength(0)
    expect(() => stub.emit(true)).not.toThrow()
  })
})
