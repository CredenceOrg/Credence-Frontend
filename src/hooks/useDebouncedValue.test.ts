import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

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
      { initialProps: { value: 'a', delayMs: 200, options: { setTimeoutImpl, clearTimeoutImpl } } }
    )

    // Initial render schedules a debounce via the injected setTimeout
    expect(setTimeoutImpl).toHaveBeenCalledTimes(1)
    expect(setTimeoutImpl).toHaveBeenCalledWith(expect.any(Function), 200)

    // A value change should cancel the previous timer and schedule a new one
    rerender({ value: 'b', delayMs: 200, options: { setTimeoutImpl, clearTimeoutImpl } })
    expect(clearTimeoutImpl).toHaveBeenCalledWith(42)
    expect(setTimeoutImpl).toHaveBeenCalledTimes(2)
  })

  it('passes the injected setTimeout result through to clearTimeout on unmount', () => {
    const setTimeoutImpl = vi.fn().mockReturnValue(99 as unknown as ReturnType<typeof setTimeout>)
    const clearTimeoutImpl = vi.fn()

    const { unmount } = renderHook(() =>
      useDebouncedValue('a', 200, { setTimeoutImpl, clearTimeoutImpl })
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
        ({ value }) => useDebouncedValue(value, 200, { setTimeoutImpl, clearTimeoutImpl }),
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
        useDebouncedValue('a', 200, { setTimeoutImpl, clearTimeoutImpl })
      )
      unmount()
    }).not.toThrow()
  })

  it('does not call setTimeoutImpl when delayMs is <= 0 (short-circuit path)', () => {
    const setTimeoutImpl = vi.fn().mockReturnValue(1 as unknown as ReturnType<typeof setTimeout>)
    const clearTimeoutImpl = vi.fn()

    const { result, rerender } = renderHook(
      ({ value, delayMs }) =>
        useDebouncedValue(value, delayMs, { setTimeoutImpl, clearTimeoutImpl }),
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
        useDebouncedValue(value, delayMs, { setTimeoutImpl, clearTimeoutImpl }),
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
          options: { setTimeoutImpl: impl1.set, clearTimeoutImpl: impl1.clear },
        },
      }
    )
    expect(impl1.set).toHaveBeenCalledTimes(1)

    // Same value, but new impl references — effect must NOT re-run.
    rerender({ value: 'a', options: { setTimeoutImpl: impl2.set, clearTimeoutImpl: impl2.clear } })
    expect(impl1.set).toHaveBeenCalledTimes(1)
    expect(impl1.clear).not.toHaveBeenCalled()
    expect(impl2.set).not.toHaveBeenCalled()
  })
})
