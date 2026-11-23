import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { useScrollToTop, BACK_TO_TOP_SCROLL_THRESHOLD } from './useScrollToTop'

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
}

describe('useScrollToTop', () => {
  let capturedHandler: (() => void) | null = null
  const originalAddEventListener = window.addEventListener.bind(window)
  const originalRemoveEventListener = window.removeEventListener.bind(window)

  beforeEach(() => {
    capturedHandler = null
    setScrollY(0)

    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler, options) => {
      if (type === 'scroll') {
        capturedHandler = handler as () => void
      }
      return originalAddEventListener(type, handler as EventListenerOrEventListenerObject, options)
    })

    vi.spyOn(window, 'removeEventListener').mockImplementation((type, handler, options) => {
      if (type === 'scroll') {
        capturedHandler = null
      }
      return originalRemoveEventListener(
        type,
        handler as EventListenerOrEventListenerObject,
        options
      )
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setScrollY(0)
  })

  it('exports BACK_TO_TOP_SCROLL_THRESHOLD as 800', () => {
    expect(BACK_TO_TOP_SCROLL_THRESHOLD).toBe(800)
  })

  it('returns false when scrollY is below the threshold', () => {
    setScrollY(0)
    const { result } = renderHook(() => useScrollToTop())
    expect(result.current).toBe(false)
  })

  it('returns false when scrollY equals the threshold exactly', () => {
    setScrollY(800)
    const { result } = renderHook(() => useScrollToTop())
    expect(result.current).toBe(false)
  })

  it('returns true when scrollY exceeds the threshold', () => {
    setScrollY(801)
    const { result } = renderHook(() => useScrollToTop())
    expect(result.current).toBe(true)
  })

  it('updates to true when user scrolls past threshold', () => {
    setScrollY(0)
    const { result } = renderHook(() => useScrollToTop())
    expect(result.current).toBe(false)

    act(() => {
      setScrollY(900)
      capturedHandler?.()
    })

    expect(result.current).toBe(true)
  })

  it('updates to false when user scrolls back above threshold', () => {
    setScrollY(900)
    const { result } = renderHook(() => useScrollToTop())
    expect(result.current).toBe(true)

    act(() => {
      setScrollY(100)
      capturedHandler?.()
    })

    expect(result.current).toBe(false)
  })

  it('removes the scroll listener on unmount', () => {
    const { unmount } = renderHook(() => useScrollToTop())
    expect(capturedHandler).not.toBeNull()

    unmount()
    expect(capturedHandler).toBeNull()
  })

  describe('boundary and recovery', () => {
    it('registers the scroll listener as passive', () => {
      renderHook(() => useScrollToTop())

      const calls = vi.mocked(window.addEventListener).mock.calls
      const scrollCall = calls.find(([type]) => type === 'scroll')
      expect(scrollCall).toBeDefined()
      expect(scrollCall?.[2]).toEqual({ passive: true })
    })

    it('removes exactly the handler it registered', () => {
      const { unmount } = renderHook(() => useScrollToTop())
      const registered = capturedHandler

      unmount()

      const removeCalls = vi.mocked(window.removeEventListener).mock.calls
      const scrollRemove = removeCalls.find(([type]) => type === 'scroll')
      expect(scrollRemove?.[1]).toBe(registered)
    })

    it('ignores non-scroll window events even when the position changed', () => {
      setScrollY(0)
      const { result } = renderHook(() => useScrollToTop())
      expect(result.current).toBe(false)

      act(() => {
        setScrollY(5000)
        window.dispatchEvent(new Event('resize'))
        window.dispatchEvent(new Event('orientationchange'))
      })

      expect(result.current).toBe(false)
    })

    it('hides again when scrolled back to exactly the threshold', () => {
      setScrollY(900)
      const { result } = renderHook(() => useScrollToTop())
      expect(result.current).toBe(true)

      act(() => {
        setScrollY(BACK_TO_TOP_SCROLL_THRESHOLD)
        capturedHandler?.()
      })

      // The predicate is strictly greater-than, so the boundary is hidden.
      expect(result.current).toBe(false)
    })

    it('settles on the final position across a burst of scroll events', () => {
      setScrollY(0)
      const { result } = renderHook(() => useScrollToTop())

      act(() => {
        setScrollY(900)
        capturedHandler?.()
        setScrollY(100)
        capturedHandler?.()
        setScrollY(1200)
        capturedHandler?.()
      })
      expect(result.current).toBe(true)

      act(() => {
        setScrollY(1000)
        capturedHandler?.()
        setScrollY(10)
        capturedHandler?.()
      })
      expect(result.current).toBe(false)
    })

    it('treats a negative scroll position as not visible', () => {
      setScrollY(-50)
      const { result } = renderHook(() => useScrollToTop())
      expect(result.current).toBe(false)
    })

    it('re-reads the live position on remount', () => {
      setScrollY(0)
      const first = renderHook(() => useScrollToTop())
      expect(first.result.current).toBe(false)
      first.unmount()

      setScrollY(2000)
      const second = renderHook(() => useScrollToTop())
      expect(second.result.current).toBe(true)
      second.unmount()
    })
  })
})
