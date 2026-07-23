import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useMediaQuery, useIsMobile } from './useMediaQuery'

const QUERY = '(max-width: 767px)'

function makeMql(matches: boolean) {
  let changeHandler: ((e: MediaQueryListEvent) => void) | null = null
  const mql = {
    matches,
    media: QUERY,
    onchange: null,
    addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') changeHandler = handler
    }),
    removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change' && changeHandler === handler) changeHandler = null
    }),
    dispatchEvent: vi.fn(),
    /** Test helper: fire a change event */
    _fire: (nextMatches: boolean) => changeHandler?.({ matches: nextMatches } as MediaQueryListEvent),
    _handler: () => changeHandler,
  }
  return mql
}

describe('useMediaQuery', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  // --- static-render / SSR-style fallback (matchMedia unavailable) ---

  it('returns false when window.matchMedia is undefined', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(false)
  })

  it('returns false when window.matchMedia is null (non-function value)', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: null,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(false)
  })

  it('returns false when window.matchMedia is a non-callable object', () => {
    // An object that looks like an mql but is not a function must be treated as
    // absent so callers always get a deterministic boolean rather than throwing.
    Object.defineProperty(window, 'matchMedia', {
      value: { matches: true }, // not typeof 'function'
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(false)
  })

  // --- normal happy-path (matchMedia present and functional) ---

  it('returns initial match value (false)', () => {
    const mql = makeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(false)
  })

  it('returns initial match value (true)', () => {
    const mql = makeMql(true)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(true)
  })

  it('updates when the media query fires a change event', () => {
    const mql = makeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(false)

    act(() => { mql._fire(true) })
    expect(result.current).toBe(true)

    act(() => { mql._fire(false) })
    expect(result.current).toBe(false)
  })

  it('removes the listener on unmount', () => {
    const mql = makeMql(false)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { unmount } = renderHook(() => useMediaQuery(QUERY))
    expect(mql._handler()).not.toBeNull()

    unmount()
    expect(mql._handler()).toBeNull()
  })

  // --- graceful degradation when addEventListener is missing ---

  it('does not throw when addEventListener is absent on the mql object', () => {
    // Older environments expose matchMedia but lack addEventListener on the
    // returned MediaQueryList.  The hook uses optional chaining (`?.`) so it
    // must not throw; the listener simply never fires.
    const mql = {
      matches: true,
      media: QUERY,
      onchange: null,
      addEventListener: undefined,
      removeEventListener: undefined,
      dispatchEvent: vi.fn(),
    }
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result, unmount } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(true)
    expect(() => unmount()).not.toThrow()
  })

  // --- query-change re-subscription ---

  it('re-subscribes when the query string changes', () => {
    // The hook calls matchMedia once per useEffect run (the lazy-init call is
    // separate and happens only on the initial mount).  Two distinct mql stubs
    // are used so we can assert which one the hook is currently subscribed to.
    const mql1 = makeMql(false) // initial subscription (matches=false)
    const mql2 = makeMql(true)  // subscription after query change (matches=true)
    const matchMediaMock = vi.fn()
      .mockReturnValueOnce(mql1) // lazy-init call on first mount
      .mockReturnValueOnce(mql1) // useEffect call on first mount
      .mockReturnValue(mql2)     // useEffect call after the query changes

    window.matchMedia = matchMediaMock

    const { result, rerender } = renderHook(({ q }) => useMediaQuery(q), {
      initialProps: { q: QUERY },
    })

    expect(result.current).toBe(false)

    act(() => { rerender({ q: '(min-width: 1024px)' }) })
    expect(result.current).toBe(true)
  })

  it('removes old listener and attaches new one when query string changes', () => {
    // Verifies the cleanup path: the previous mql loses its handler and the
    // new mql receives one, preventing duplicate or stale subscriptions.
    const mql1 = makeMql(false)
    const mql2 = makeMql(true)
    const matchMediaMock = vi.fn()
      .mockReturnValueOnce(mql1) // lazy-init call on first mount
      .mockReturnValueOnce(mql1) // useEffect call on first mount
      .mockReturnValue(mql2)     // useEffect call after query changes

    window.matchMedia = matchMediaMock

    const { rerender } = renderHook(({ q }) => useMediaQuery(q), {
      initialProps: { q: QUERY },
    })

    // A handler must be attached to the first mql after the initial render.
    expect(mql1._handler()).not.toBeNull()

    act(() => { rerender({ q: '(min-width: 1024px)' }) })

    // Old handler torn down; new handler wired up.
    expect(mql1._handler()).toBeNull()
    expect(mql2._handler()).not.toBeNull()
  })
})

describe('useIsMobile', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('returns true when viewport is below 768px', () => {
    window.matchMedia = vi.fn().mockReturnValue(makeMql(true))
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false when viewport is 768px or above', () => {
    window.matchMedia = vi.fn().mockReturnValue(makeMql(false))
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('uses the (max-width: 767px) query', () => {
    window.matchMedia = vi.fn().mockReturnValue(makeMql(false))
    renderHook(() => useIsMobile())
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)')
  })

  it('returns false when matchMedia is unavailable (simulated static-render fallback)', () => {
    // Mirrors the SSR / static-export scenario: matchMedia not present, so the
    // hook must return a safe false rather than throwing.
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('transitions from mobile to desktop when the mql fires a change event', () => {
    // Simulates a viewport expanding beyond the 768 px mobile boundary.
    const mql = makeMql(true) // starts as mobile (< 768 px)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    act(() => { mql._fire(false) }) // viewport grew to ≥768 px
    expect(result.current).toBe(false)
  })

  it('transitions from desktop to mobile when the mql fires a change event', () => {
    // Simulates a viewport shrinking below the 768 px mobile boundary.
    const mql = makeMql(false) // starts as desktop (≥768 px)
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => { mql._fire(true) }) // viewport shrunk to < 768 px
    expect(result.current).toBe(true)
  })
})
