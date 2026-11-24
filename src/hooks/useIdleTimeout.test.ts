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

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer on mousemove activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    window.dispatchEvent(new Event('mousemove'))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer on keydown activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    window.dispatchEvent(new Event('keydown'))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer when tab becomes visible after being hidden', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('does not start timer when timeoutMs is 0 (disconnected)', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 0, onIdle }))

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('does not start timer when timeoutMs is negative', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: -1, onIdle }))

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('clears timer and removes listeners on unmount', () => {
    const onIdle = vi.fn()
    const { unmount } = renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    unmount()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('does not fire onIdle after unmount even with delayed activity', () => {
    const onIdle = vi.fn()
    const { unmount } = renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    unmount()

    window.dispatchEvent(new Event('mousemove'))

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onIdle).not.toHaveBeenCalled()
  })

  it('uses injectable setTimeout implementation', () => {
    const onIdle = vi.fn()
    const mockSetTimeout = vi.fn().mockReturnValue(123)
    const mockClearTimeout = vi.fn()

    renderHook(() =>
      useIdleTimeout({
        timeoutMs: 1000,
        onIdle,
        setTimeoutImpl: mockSetTimeout as unknown as typeof setTimeout,
        clearTimeoutImpl: mockClearTimeout as unknown as typeof clearTimeout,
      })
    )

    expect(mockSetTimeout).toHaveBeenCalledTimes(1)
    expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  it('uses the latest onIdle callback without restarting the timer', () => {
    const onIdle1 = vi.fn()
    const onIdle2 = vi.fn()

    const { rerender } = renderHook(
      ({ onIdle }: { onIdle: () => void }) => useIdleTimeout({ timeoutMs: 1000, onIdle }),
      { initialProps: { onIdle: onIdle1 } }
    )

    rerender({ onIdle: onIdle2 })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onIdle1).not.toHaveBeenCalled()
    expect(onIdle2).toHaveBeenCalledTimes(1)
  })

  it('resets timer on repeated activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(500)
      })
      window.dispatchEvent(new Event('mousemove'))
    }

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // Rate-ceiling contract: onIdle fires at most once per idle window
  // ---------------------------------------------------------------------------

  it('fires onIdle exactly once even when activity bursts precede the ceiling', () => {
    // This is the core rate-ceiling contract: no matter how many activity events
    // fire before the timeout, onIdle is emitted exactly once when the window
    // finally closes.
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 500, onIdle }))

    // Rapid burst of activity — resets the ceiling each time
    for (let i = 0; i < 10; i++) {
      window.dispatchEvent(new Event('mousemove'))
      act(() => {
        vi.advanceTimersByTime(100)
      })
    }

    // Not yet idle — last event was less than 500ms ago
    expect(onIdle).not.toHaveBeenCalled()

    // Cross the ceiling with no further activity
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('fires onIdle again after a second idle window following new activity', () => {
    // Ensures the ceiling resets: a second quiet period must produce a second fire.
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    // First idle window
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)

    // Activity restarts the timer
    window.dispatchEvent(new Event('keydown'))

    // Second idle window
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onIdle).toHaveBeenCalledTimes(2)
  })

  // ---------------------------------------------------------------------------
  // Remaining event types that must each reset the timer
  // ---------------------------------------------------------------------------

  it('resets timer on mousedown activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })
    window.dispatchEvent(new Event('mousedown'))
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer on touchstart activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })
    window.dispatchEvent(new Event('touchstart'))
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer on scroll activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })
    window.dispatchEvent(new Event('scroll'))
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('resets timer on wheel activity', () => {
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })
    window.dispatchEvent(new Event('wheel'))
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('does not reset timer on visibilitychange when tab becomes hidden', () => {
    // Only the transition to 'visible' should reset; going hidden must not.
    const onIdle = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle }))

    act(() => {
      vi.advanceTimersByTime(500)
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    // The remaining 500ms should still expire the original timer
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)

    // Restore for other tests
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
  })

  // ---------------------------------------------------------------------------
  // onActivity callback
  // ---------------------------------------------------------------------------

  it('calls onActivity on every activity event', () => {
    const onIdle = vi.fn()
    const onActivity = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle, onActivity }))

    window.dispatchEvent(new Event('mousemove'))
    window.dispatchEvent(new Event('keydown'))
    window.dispatchEvent(new Event('scroll'))

    expect(onActivity).toHaveBeenCalledTimes(3)
  })

  it('does not call onActivity when idle fires (no activity event)', () => {
    const onIdle = vi.fn()
    const onActivity = vi.fn()
    renderHook(() => useIdleTimeout({ timeoutMs: 1000, onIdle, onActivity }))

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
    expect(onActivity).not.toHaveBeenCalled()
  })

  it('works correctly when onActivity is omitted', () => {
    // onActivity is optional — the hook must not throw when it is absent.
    const onIdle = vi.fn()
    const { unmount } = renderHook(() => useIdleTimeout({ timeoutMs: 500, onIdle }))

    window.dispatchEvent(new Event('mousemove'))
    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(onIdle).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('uses the latest onActivity callback without restarting the timer', () => {
    const onActivity1 = vi.fn()
    const onActivity2 = vi.fn()
    const onIdle = vi.fn()

    const { rerender } = renderHook(
      ({ onActivity }: { onActivity: () => void }) =>
        useIdleTimeout({ timeoutMs: 1000, onIdle, onActivity }),
      { initialProps: { onActivity: onActivity1 } }
    )

    rerender({ onActivity: onActivity2 })

    window.dispatchEvent(new Event('mousemove'))

    expect(onActivity1).not.toHaveBeenCalled()
    expect(onActivity2).toHaveBeenCalledTimes(1)
  })
})
