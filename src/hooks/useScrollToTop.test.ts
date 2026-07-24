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
})
