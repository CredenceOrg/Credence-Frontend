import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue, type UseDebouncedValueOptions } from './useDebouncedValue'

/**
 * Narrows a pair of loose `vi.fn()` timer doubles to the injectable-clock
 * signatures declared by `UseDebouncedValueOptions`.
 *
 * The doubles themselves stay untyped so tests can keep asserting on
 * `setTimeoutImpl.mock.calls` (handle accounting), while the hook still
 * receives values that satisfy its clock contract.
 */
function timerOptions(
  setTimeoutImpl: unknown,
  clearTimeoutImpl: unknown
): UseDebouncedValueOptions {
  return {
    setTimeoutImpl: setTimeoutImpl as unknown as typeof setTimeout,
    clearTimeoutImpl: clearTimeoutImpl as unknown as typeof clearTimeout,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(({ value, delayMs }) => useDebouncedValue(value, delayMs), {
      initialProps: { value: 'hello', delayMs: 200 },
    })
    expect(result.current).toBe('hello')
  })

  it('does not update the returned value before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } }
    )
    rerender({ value: 'b', delayMs: 200 })
    // Timer hasn't fired yet — should still be 'a'
    expect(result.current).toBe('a')
  })

  it('retains_previous_value_one_millisecond_before_debounce_boundary', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'initial', delayMs: 200 } }
    )

    rerender({ value: 'updated', delayMs: 200 })

    act(() => {
      vi.advanceTimersByTime(199)
    })

    // Exactly 1ms before boundary: value MUST retain 'initial'
    expect(result.current).toBe('initial')
  })

  it('updates_value_at_exact_debounce_boundary_delay_ms', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'initial', delayMs: 200 } }
    )

    rerender({ value: 'updated', delayMs: 200 })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Exactly at boundary: value updates to 'updated'
    expect(result.current).toBe('updated')
  })

  it('cancels_pending_timer_and_discards_queued_updates_on_unmount', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result, rerender, unmount } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'initial', delayMs: 200 } }
    )

    rerender({ value: 'pending_update', delayMs: 200 })
    expect(result.current).toBe('initial')

    // Unmount at 100ms (middle of delay window)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    unmount()

    // Advance past original timer boundary
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('resets_timer_and_skips_intermediate_value_when_updated_before_delay_elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'first', delayMs: 200 } }
    )

    // First change at t=0
    rerender({ value: 'second', delayMs: 200 })

    // Advance 150ms (before timer fires)
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('first')

    // Second change at t=150 (resets 200ms timer)
    rerender({ value: 'third', delayMs: 200 })

    // Advance another 150ms (total t=300, but only 150ms since 'third')
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current).toBe('first')

    // Advance remaining 50ms (reaches 200ms since 'third')
    act(() => {
      vi.advanceTimersByTime(50)
    })
    // Value skips 'second' and updates directly to 'third'
    expect(result.current).toBe('third')
  })

  it('collapses rapid bursts to only the final value', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } }
    )

    rerender({ value: 'ab', delayMs: 200 })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    rerender({ value: 'abc', delayMs: 200 })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    rerender({ value: 'abcd', delayMs: 200 })

    // Only 200ms of *total* advance — the last change resets the timer
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('a')

    // Finish the remaining wait
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('abcd')
  })

  it('is synchronous when delayMs is 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 0 } }
    )
    expect(result.current).toBe('a')

    rerender({ value: 'b', delayMs: 0 })
    // No timer advancement needed — synchronous
    expect(result.current).toBe('b')
  })

  it('is synchronous when delayMs is negative', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'x', delayMs: -1 } }
    )
    expect(result.current).toBe('x')

    rerender({ value: 'y', delayMs: -1 })
    expect(result.current).toBe('y')
  })

  it('switches from debounced to synchronous when delayMs changes to 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } }
    )

    rerender({ value: 'b', delayMs: 0 })
    // Must reflect the new value immediately
    expect(result.current).toBe('b')
  })

  it('switches from synchronous to debounced — value lags by delayMs on first transition', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 0 } }
    )

    rerender({ value: 'b', delayMs: 200 })
    // Still returning the previously-debounced 'a' — the first debounced
    // render hasn't settled yet
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current).toBe('b')
  })

  it('does not warn about state updates on unmounted component', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { unmount, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } }
    )

    rerender({ value: 'b', delayMs: 200 })
    // Unmount before the timer fires
    unmount()

    // Advance past the timer — if the timer hadn't been cleared this would
    // trigger a setState on an unmounted component and log a warning
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('preserves referential stability when value is unchanged (delayMs > 0)', () => {
    const obj = { x: 1 }
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: obj, delayMs: 200 } }
    )
    const first = result.current

    // Re-render with the same value reference
    rerender({ value: obj, delayMs: 200 })
    const second = result.current

    expect(second).toBe(first)
  })

  it('preserves referential stability when value is unchanged (delayMs = 0)', () => {
    const obj = { x: 1 }
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: obj, delayMs: 0 } }
    )
    const first = result.current

    rerender({ value: obj, delayMs: 0 })
    const second = result.current

    expect(second).toBe(first)
  })

  it('ignores delayMs change when value is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'stable', delayMs: 200 } }
    )

    rerender({ value: 'stable', delayMs: 500 })
    // Should still be 'stable' immediately — no timer was reset
    expect(result.current).toBe('stable')
  })

  it('works with non-string types', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 0, delayMs: 100 } }
    )
    expect(result.current).toBe(0)

    rerender({ value: 42, delayMs: 100 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe(42)
  })
})

describe('useDebouncedValue — options injection', () => {
  it('uses the injected setTimeout / clearTimeout implementations', () => {
    const setTimeoutImpl = vi.fn().mockReturnValue(42 as unknown as ReturnType<typeof setTimeout>)
    const clearTimeoutImpl = vi.fn()

    const { rerender } = renderHook(
      ({ value, delayMs, options }) => useDebouncedValue(value, delayMs, options),
      {
        initialProps: {
          value: 'a',
          delayMs: 200,
          options: timerOptions(setTimeoutImpl, clearTimeoutImpl),
        },
      }
    )

    // Initial render schedules a debounce via the injected setTimeout
    expect(setTimeoutImpl).toHaveBeenCalledTimes(1)
    expect(setTimeoutImpl).toHaveBeenCalledWith(expect.any(Function), 200)

    // A value change should cancel the previous timer and schedule a new one
    rerender({
      value: 'b',
      delayMs: 200,
      options: timerOptions(setTimeoutImpl, clearTimeoutImpl),
    })
    expect(clearTimeoutImpl).toHaveBeenCalledWith(42)
    expect(setTimeoutImpl).toHaveBeenCalledTimes(2)
  })

  it('passes the injected setTimeout result through to clearTimeout on unmount', () => {
    const setTimeoutImpl = vi.fn().mockReturnValue(99 as unknown as ReturnType<typeof setTimeout>)
    const clearTimeoutImpl = vi.fn()

    const { unmount } = renderHook(() =>
      useDebouncedValue('a', 200, timerOptions(setTimeoutImpl, clearTimeoutImpl))
    )

    expect(setTimeoutImpl).toHaveBeenCalled()
    unmount()

    expect(clearTimeoutImpl).toHaveBeenCalledWith(99)
  })

  it('does not crash when clearTimeoutImpl throws on cancellation', () => {
    const setTimeoutImpl = vi.fn().mockReturnValue(1 as unknown as ReturnType<typeof setTimeout>)
    const clearTimeoutImpl = vi.fn(() => {
      throw new Error('boom')
    })

    expect(() => {
      const { rerender } = renderHook(
        ({ value }) =>
          useDebouncedValue(value, 200, timerOptions(setTimeoutImpl, clearTimeoutImpl)),
        { initialProps: { value: 'a' } }
      )
      rerender({ value: 'b' })
    }).not.toThrow()
  })

  it('does not crash when clearTimeoutImpl throws on unmount cleanup', () => {
    const setTimeoutImpl = vi.fn().mockReturnValue(1 as unknown as ReturnType<typeof setTimeout>)
    const clearTimeoutImpl = vi.fn(() => {
      throw new Error('boom')
    })

    expect(() => {
      const { unmount } = renderHook(() =>
        useDebouncedValue('a', 200, timerOptions(setTimeoutImpl, clearTimeoutImpl))
      )
      unmount()
    }).not.toThrow()
  })

  it('does not call setTimeoutImpl when delayMs is <= 0 (short-circuit path)', () => {
    const setTimeoutImpl = vi.fn().mockReturnValue(1 as unknown as ReturnType<typeof setTimeout>)
    const clearTimeoutImpl = vi.fn()

    const { result, rerender } = renderHook(
      ({ value, delayMs }) =>
        useDebouncedValue(value, delayMs, timerOptions(setTimeoutImpl, clearTimeoutImpl)),
      { initialProps: { value: 'a', delayMs: 0 } }
    )
    expect(result.current).toBe('a')
    expect(setTimeoutImpl).not.toHaveBeenCalled()

    rerender({ value: 'b', delayMs: -1 })
    expect(result.current).toBe('b')
    expect(setTimeoutImpl).not.toHaveBeenCalled()
  })

  it('fires the injected setTimeoutImpl callback and updates the debounced value', () => {
    // vi.advanceTimersByTime only fires timers created via vitest's controlled
    // setTimeout — when the caller injects their own setTimeoutImpl, the timer
    // is registered with that impl, so we capture the scheduled callback and
    // invoke it manually to simulate the timer firing.
    let scheduled: (() => void) | null = null
    const setTimeoutImpl = vi.fn((cb: () => void, _ms: number) => {
      scheduled = cb
      return 7 as unknown as ReturnType<typeof setTimeout>
    })
    const clearTimeoutImpl = vi.fn()

    const { result, rerender } = renderHook(
      ({ value, delayMs }) =>
        useDebouncedValue(value, delayMs, timerOptions(setTimeoutImpl, clearTimeoutImpl)),
      { initialProps: { value: 'a', delayMs: 200 } }
    )

    expect(result.current).toBe('a')
    rerender({ value: 'b', delayMs: 200 })
    // Still pending — value has not been committed yet
    expect(result.current).toBe('a')
    expect(scheduled).not.toBeNull()

    act(() => {
      scheduled?.()
    })
    expect(result.current).toBe('b')
  })

  it('does not re-run the effect when only the injected impl references change', () => {
    // The implementation objects are kept in refs; changing the references
    // across renders must NOT cancel and reschedule the timer.
    const impl1 = {
      set: vi.fn().mockReturnValue(1 as unknown as ReturnType<typeof setTimeout>),
      clear: vi.fn(),
    }
    const impl2 = {
      set: vi.fn().mockReturnValue(2 as unknown as ReturnType<typeof setTimeout>),
      clear: vi.fn(),
    }

    const { rerender } = renderHook(
      ({ value, options }) => useDebouncedValue(value, 200, options),
      {
        initialProps: {
          value: 'a',
          options: timerOptions(impl1.set, impl1.clear),
        },
      }
    )
    expect(impl1.set).toHaveBeenCalledTimes(1)

    // Same value, but new impl references — effect must NOT re-run.
    rerender({ value: 'a', options: timerOptions(impl2.set, impl2.clear) })
    expect(impl1.set).toHaveBeenCalledTimes(1)
    expect(impl1.clear).not.toHaveBeenCalled()
    expect(impl2.set).not.toHaveBeenCalled()
  })
})

describe('useDebouncedValue — boundary & recovery', () => {
  /**
   * Deterministic timer double: scheduled callbacks are captured (never
   * auto-fired) and handles are unique small integers, so a test can assert
   * exactly *which* handle was released without depending on host timer ids.
   */
  const createTimerDouble = () => {
    const callbacks: Array<() => void> = []
    let nextHandle = 0

    const setTimeoutImpl = vi.fn((cb: () => void, _ms: number) => {
      callbacks.push(cb)
      nextHandle += 1
      return nextHandle as unknown as ReturnType<typeof setTimeout>
    })

    const clearTimeoutImpl = vi.fn()

    return { callbacks, setTimeoutImpl, clearTimeoutImpl }
  }

  it('commits at the first millisecond of the smallest positive window', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'initial', delayMs: 1 } }
    )

    rerender({ value: 'updated', delayMs: 1 })

    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current).toBe('initial')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('updated')
  })

  it('holds the previous value across a long window and commits exactly at its boundary', () => {
    const delayMs = 60_000
    const { result, rerender } = renderHook(
      ({ value, delayMs: delay }) => useDebouncedValue(value, delay),
      { initialProps: { value: 'initial', delayMs } }
    )

    rerender({ value: 'updated', delayMs })

    act(() => {
      vi.advanceTimersByTime(delayMs - 1)
    })
    expect(result.current).toBe('initial')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('updated')
  })

  it('does not reschedule when the same value is re-rendered repeatedly', () => {
    const { callbacks, setTimeoutImpl, clearTimeoutImpl } = createTimerDouble()

    const { rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200, timerOptions(setTimeoutImpl, clearTimeoutImpl)),
      { initialProps: { value: 'stable' } }
    )

    rerender({ value: 'stable' })
    rerender({ value: 'stable' })
    rerender({ value: 'stable' })

    // Identity-stable input: one window, never released, never re-armed.
    expect(setTimeoutImpl).toHaveBeenCalledTimes(1)
    expect(callbacks).toHaveLength(1)
    expect(clearTimeoutImpl).not.toHaveBeenCalled()
  })

  it('restarts the window from the delayMs change, not from the original value change', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } }
    )

    // 'b' arrives at t=0 with a 200 ms window (would commit at t=200)
    rerender({ value: 'b', delayMs: 200 })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Widening the window at t=100 must restart the countdown from t=100
    rerender({ value: 'b', delayMs: 500 })
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('b')
  })

  it('skips a superseded value when its window boundary coincides with a new input', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } }
    )

    // 'b' arrives at t=0 and would commit at t=200
    rerender({ value: 'b', delayMs: 200 })
    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(result.current).toBe('a')

    // 'c' arrives 1 ms before 'b' would commit, restarting the window
    rerender({ value: 'c', delayMs: 200 })
    act(() => {
      vi.advanceTimersByTime(1)
    })
    // Exactly on the superseded boundary: 'b' must never be observed
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(result.current).toBe('c')
  })

  it('cancels the pending window when delayMs drops to 0 so a stale commit can never resurface', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'initial', delayMs: 200 } }
    )

    // 'stale' is queued at t=0 and would commit at t=200
    rerender({ value: 'stale', delayMs: 200 })
    act(() => {
      vi.advanceTimersByTime(50)
    })

    // Debouncing switches off at t=50 — the queued window must be dropped
    rerender({ value: 'fresh', delayMs: 0 })
    expect(result.current).toBe('fresh')

    // Let the dropped window elapse, then re-arm debouncing with the same
    // value: the superseded 'stale' commit must not have leaked into state.
    act(() => {
      vi.advanceTimersByTime(500)
    })
    rerender({ value: 'fresh', delayMs: 200 })
    expect(result.current).toBe('fresh')
  })

  it('releases each timer handle exactly once so a spent window is never cleared again', () => {
    const { callbacks, setTimeoutImpl, clearTimeoutImpl } = createTimerDouble()

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200, timerOptions(setTimeoutImpl, clearTimeoutImpl)),
      { initialProps: { value: 'a' } }
    )
    expect(setTimeoutImpl).toHaveBeenCalledTimes(1)

    // Supersede the first window: its handle is released exactly once
    rerender({ value: 'b' })
    expect(clearTimeoutImpl).toHaveBeenCalledTimes(1)
    expect(clearTimeoutImpl).toHaveBeenCalledWith(1)

    // Fire the live window: the handle is spent the moment it runs
    act(() => {
      callbacks[1]?.()
    })
    expect(result.current).toBe('b')

    // A later change must not re-release (clear) the spent handle
    rerender({ value: 'c' })
    expect(setTimeoutImpl).toHaveBeenCalledTimes(3)
    expect(clearTimeoutImpl).toHaveBeenCalledTimes(1)
  })

  it('does not clear an already-released handle after a delayMs <= 0 transition', () => {
    const { callbacks, setTimeoutImpl, clearTimeoutImpl } = createTimerDouble()

    const { result, rerender } = renderHook(
      ({ value, delayMs }) =>
        useDebouncedValue(value, delayMs, timerOptions(setTimeoutImpl, clearTimeoutImpl)),
      { initialProps: { value: 'a', delayMs: 200 } }
    )

    // Debouncing turns off: the mount window is released exactly once
    rerender({ value: 'b', delayMs: 0 })
    expect(result.current).toBe('b')
    expect(clearTimeoutImpl).toHaveBeenCalledTimes(1)

    // Turning debouncing back on must not re-release the spent handle
    rerender({ value: 'c', delayMs: 200 })
    expect(clearTimeoutImpl).toHaveBeenCalledTimes(1)
    expect(setTimeoutImpl).toHaveBeenCalledTimes(2)

    act(() => {
      callbacks[1]?.()
    })
    expect(result.current).toBe('c')
  })

  it('recovers from an injected clearTimeout that throws and keeps debouncing later values', () => {
    const { callbacks, setTimeoutImpl } = createTimerDouble()

    let shouldThrow = true
    const clearTimeoutImpl = vi.fn(() => {
      if (shouldThrow) {
        shouldThrow = false
        throw new Error('clock failure')
      }
    })

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200, timerOptions(setTimeoutImpl, clearTimeoutImpl)),
      { initialProps: { value: 'a' } }
    )

    // A failing clock must not abort the render path...
    rerender({ value: 'b' })
    expect(clearTimeoutImpl).toHaveBeenCalledTimes(1)

    // ...and the new window must still be scheduled and committable
    act(() => {
      callbacks[1]?.()
    })
    expect(result.current).toBe('b')

    // ...and subsequent windows keep working with the recovered clock
    rerender({ value: 'c' })
    act(() => {
      callbacks[2]?.()
    })
    expect(result.current).toBe('c')
    expect(setTimeoutImpl).toHaveBeenCalledTimes(3)
  })

  it('preserves the identity of object values through the debounce window', () => {
    const initial = { id: 'initial' }
    const updated = { id: 'updated' }

    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: initial },
    })
    expect(result.current).toBe(initial)

    rerender({ value: updated })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    // The debounced value is the exact reference that was supplied
    expect(result.current).toBe(updated)
  })

  it('keeps exactly one live window across a StrictMode effect double-invocation', () => {
    const { callbacks, setTimeoutImpl, clearTimeoutImpl } = createTimerDouble()

    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200, timerOptions(setTimeoutImpl, clearTimeoutImpl)),
      { initialProps: { value: 'a' }, wrapper: StrictMode }
    )

    rerender({ value: 'b' })
    expect(result.current).toBe('a')

    // StrictMode re-runs mount effects, but released handles must not accumulate
    // as live ones: scheduled − released must be exactly one live handle.
    expect(setTimeoutImpl.mock.calls.length - clearTimeoutImpl.mock.calls.length).toBe(1)

    act(() => {
      callbacks[callbacks.length - 1]?.()
    })
    expect(result.current).toBe('b')
  })
})
