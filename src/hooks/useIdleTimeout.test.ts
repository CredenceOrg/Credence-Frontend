import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIdleTimeout } from './useIdleTimeout'

describe('useIdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onIdle after timeoutMs of inactivity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    expect(onIdle).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1000) })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer on mousemove activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => { vi.advanceTimersByTime(500) })

    window.dispatchEvent(new Event('mousemove'))

    act(() => { vi.advanceTimersByTime(500) })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(500) })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer on keydown activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => { vi.advanceTimersByTime(500) })

    window.dispatchEvent(new Event('keydown'))

    act(() => { vi.advanceTimersByTime(500) })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(500) })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer when tab becomes visible after being hidden', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => { vi.advanceTimersByTime(500) })

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    act(() => { vi.advanceTimersByTime(500) })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(500) })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('does not start timer when timeoutMs is 0 (disconnected)', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 0, onIdle }))

    act(() => { vi.advanceTimersByTime(10000) })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('does not start timer when timeoutMs is negative', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: -1, onIdle }))

    act(() => { vi.advanceTimersByTime(10000) })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('clears timer and removes listeners on unmount', () => {
    const onIdle = vi.fn()
    const { unmount } = renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    unmount()

    act(() => { vi.advanceTimersByTime(1000) })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('does not fire onIdle after unmount even with delayed activity', () => {
    const onIdle = vi.fn()
    const { unmount } = renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => { vi.advanceTimersByTime(500) })

    unmount()

    window.dispatchEvent(new Event('mousemove'))

    act(() => { vi.advanceTimersByTime(1000) })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('uses injectable setTimeout implementation', () => {
    const onIdle = vi.fn()
    const mockSetTimeout = vi.fn().mockReturnValue(123)
    const mockClearTimeout = vi.fn()

    renderHook(() => useIdleTimeout({
      timeoutMs: 1000,
      onIdle,
      setTimeoutImpl: mockSetTimeout as unknown as typeof setTimeout,
      clearTimeoutImpl: mockClearTimeout as unknown as typeof clearTimeout,
    }))

    expect(mockSetTimeout).toHaveBeenCalledTimes(1)
    expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  it('uses the latest onIdle callback without restarting the timer', () => {
    const onIdle1 = vi.fn()
    const onIdle2 = vi.fn()

    const { rerender } = renderHook(
      ({ onIdle }: { onIdle: () => void }) =>
        useIdleTimeout({ timeoutMs: 1000, onIdle }),
      { initialProps: { onIdle: onIdle1 } },
    )

    rerender({ onIdle: onIdle2 })

    act(() => { vi.advanceTimersByTime(1000) })

    expect(onIdle1).not.toHaveBeenCalled()
    expect(onIdle2).toHaveBeenCalledTimes(1)
  })

  it('resets timer on repeated activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    for (let i = 0; i < 5; i++) {
      act(() => { vi.advanceTimersByTime(500) })
      window.dispatchEvent(new Event('mousemove'))
    }

    expect(onIdle).not.toHaveBeenCalled()

    act(() => { vi.advanceTimersByTime(1000) })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })
})
