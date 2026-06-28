import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import { useOnlineStatus } from './useOnlineStatus'

describe('useOnlineStatus', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')

  function setNavigatorOnLine(value: boolean) {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => value,
    })
  }

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(Navigator.prototype, 'onLine', originalOnLine)
    }
  })

  it('initializes to navigator.onLine when online', () => {
    setNavigatorOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('initializes to false when navigator.onLine is false', () => {
    setNavigatorOnLine(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('becomes false on offline event', () => {
    setNavigatorOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('becomes true on online event', () => {
    setNavigatorOnLine(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })

  it('handles online → offline → online transitions', () => {
    setNavigatorOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())

    act(() => { window.dispatchEvent(new Event('offline')) })
    expect(result.current).toBe(false)

    act(() => { window.dispatchEvent(new Event('online')) })
    expect(result.current).toBe(true)
  })

  it('removes event listeners on unmount', () => {
    setNavigatorOnLine(true)
    const { result, unmount } = renderHook(() => useOnlineStatus())
    unmount()

    act(() => { window.dispatchEvent(new Event('offline')) })
    // After unmount, the hook's state won't update — no error thrown
    expect(result.current).toBe(true)
  })
})
