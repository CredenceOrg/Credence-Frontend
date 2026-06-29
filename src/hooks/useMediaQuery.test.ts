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

  it('returns false when window.matchMedia is undefined', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useMediaQuery(QUERY))
    expect(result.current).toBe(false)
  })

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

  it('re-subscribes when the query string changes', () => {
    const mql1 = makeMql(false)
    const mql2 = makeMql(true)
    const matchMediaMock = vi.fn()
      .mockReturnValueOnce(mql1) // initial render (lazy init) or first effect call
      .mockReturnValue(mql2)

    window.matchMedia = matchMediaMock

    const { result, rerender } = renderHook(({ q }) => useMediaQuery(q), {
      initialProps: { q: QUERY },
    })

    expect(result.current).toBe(false)

    act(() => { rerender({ q: '(min-width: 1024px)' }) })
    expect(result.current).toBe(true)
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
})
