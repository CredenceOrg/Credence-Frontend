import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useThrottledCallback } from './useThrottledCallback'
import { DEFAULT_SCROLL_THROTTLE_MS } from '../config/scroll'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useThrottledCallback', () => {
  it('executes_leading_call_immediately_on_first_invocation', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    act(() => {
      result.current('event 1')
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('event 1')
  })

  it('throttles_rapid_subsequent_calls_within_delay_window', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 100))

    act(() => {
      result.current('scroll 1')
      result.current('scroll 2')
      result.current('scroll 3')
    })

    // Leading call executed immediately, rapid calls throttled
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenLastCalledWith('scroll 1')

    // Advance time to end of throttle window
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Trailing edge fires with latest arguments
    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenLastCalledWith('scroll 3')
  })

  it('executes_immediately_for_every_call_when_delay_ms_is_zero_or_negative', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback, 0))

    act(() => {
      result.current('a')
      result.current('b')
      result.current('c')
    })

    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenNthCalledWith(1, 'a')
    expect(callback).toHaveBeenNthCalledWith(2, 'b')
    expect(callback).toHaveBeenNthCalledWith(3, 'c')
  })

  it('defaults_delay_ms_to_default_scroll_throttle_ms_constant', () => {
    const callback = vi.fn()
    const { result } = renderHook(() => useThrottledCallback(callback))

    act(() => {
      result.current('scroll')
      result.current('scroll 2')
    })

    expect(callback).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(DEFAULT_SCROLL_THROTTLE_MS)
    })

    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('always_invokes_latest_callback_ref_without_stale_closure', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    const { result, rerender } = renderHook(
      ({ cb }) => useThrottledCallback(cb, 100),
      { initialProps: { cb: callback1 } }
    )

    act(() => {
      result.current('call 1')
    })
    expect(callback1).toHaveBeenCalledWith('call 1')

    // Rerender with new callback reference
    rerender({ cb: callback2 })

    act(() => {
      result.current('call 2')
    })

    // Call inside window schedules trailing execution with callback2
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(callback2).toHaveBeenCalledWith('call 2')
  })

  it('clears_pending_timeout_on_unmount_preventing_post_unmount_invocations', () => {
    const callback = vi.fn()
    const { result, unmount } = renderHook(() => useThrottledCallback(callback, 100))

    act(() => {
      result.current('first')
      result.current('second')
    })

    expect(callback).toHaveBeenCalledTimes(1)

    unmount()

    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Trailing call should be cancelled on unmount
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
