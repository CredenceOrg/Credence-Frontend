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
    const { result } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'hello', delayMs: 200 } },
    )
    expect(result.current).toBe('hello')
  })

  it('does not update the returned value before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } },
    )
    rerender({ value: 'b', delayMs: 200 })
    // Timer hasn't fired yet — should still be 'a'
    expect(result.current).toBe('a')
  })

  it('updates the returned value after the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } },
    )
    rerender({ value: 'b', delayMs: 200 })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current).toBe('b')
  })

  it('collapses rapid bursts to only the final value', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } },
    )

    rerender({ value: 'ab', delayMs: 200 })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: 'abc', delayMs: 200 })
    act(() => { vi.advanceTimersByTime(100) })

    rerender({ value: 'abcd', delayMs: 200 })

    // Only 200ms of *total* advance — the last change resets the timer
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe('a')

    // Finish the remaining wait
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe('abcd')
  })

  it('is synchronous when delayMs is 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 0 } },
    )
    expect(result.current).toBe('a')

    rerender({ value: 'b', delayMs: 0 })
    // No timer advancement needed — synchronous
    expect(result.current).toBe('b')
  })

  it('is synchronous when delayMs is negative', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'x', delayMs: -1 } },
    )
    expect(result.current).toBe('x')

    rerender({ value: 'y', delayMs: -1 })
    expect(result.current).toBe('y')
  })

  it('switches from debounced to synchronous when delayMs changes to 0', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } },
    )

    rerender({ value: 'b', delayMs: 0 })
    // Must reflect the new value immediately
    expect(result.current).toBe('b')
  })

  it('switches from synchronous to debounced — value lags by delayMs on first transition', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 0 } },
    )

    rerender({ value: 'b', delayMs: 200 })
    // Still returning the previously-debounced 'a' — the first debounced
    // render hasn't settled yet
    expect(result.current).toBe('a')

    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe('b')
  })

  it('does not warn about state updates on unmounted component', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { unmount, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'a', delayMs: 200 } },
    )

    rerender({ value: 'b', delayMs: 200 })
    // Unmount before the timer fires
    unmount()

    // Advance past the timer — if the timer hadn't been cleared this would
    // trigger a setState on an unmounted component and log a warning
    act(() => { vi.advanceTimersByTime(200) })

    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('preserves referential stability when value is unchanged (delayMs > 0)', () => {
    const obj = { x: 1 }
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: obj, delayMs: 200 } },
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
      { initialProps: { value: obj, delayMs: 0 } },
    )
    const first = result.current

    rerender({ value: obj, delayMs: 0 })
    const second = result.current

    expect(second).toBe(first)
  })

  it('ignores delayMs change when value is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 'stable', delayMs: 200 } },
    )

    rerender({ value: 'stable', delayMs: 500 })
    // Should still be 'stable' immediately — no timer was reset
    expect(result.current).toBe('stable')
  })

  it('works with non-string types', () => {
    const { result, rerender } = renderHook(
      ({ value, delayMs }) => useDebouncedValue(value, delayMs),
      { initialProps: { value: 0, delayMs: 100 } },
    )
    expect(result.current).toBe(0)

    rerender({ value: 42, delayMs: 100 })
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(42)
  })
})
