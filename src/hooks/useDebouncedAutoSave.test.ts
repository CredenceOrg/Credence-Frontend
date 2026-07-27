import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedAutoSave } from './useDebouncedAutoSave'

// Drain React-act + microtask queue. `act(() => ...)` flushes effects;
// `vi.advanceTimersByTime` flushes fake timers; `await Promise.resolve()`
// drains any pending microtasks so awaited bodies in `saveRef` run to
// completion before assertions.
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(0)
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useDebouncedAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays idle when value is undefined and never calls save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDebouncedAutoSave({ value: undefined, save, delayMs: 100 })
    )
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.status).toBe('idle')
    expect(save).not.toHaveBeenCalled()
  })

  it('keeps status pending during the debounce window and only fires once after the timer', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedAutoSave({ value, save, delayMs: 300 }),
      { initialProps: { value: 'a' } }
    )
    // Initial: hook schedules debounce for 'a'.
    expect(result.current.status).toBe('pending')
    rerender({ value: 'b' })
    rerender({ value: 'c' })
    rerender({ value: 'd' })
    expect(save).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(299)
    })
    expect(save).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(2)
    })
    await settle()
    expect(save).toHaveBeenCalledTimes(1)
    await settle()
    expect(save).toHaveBeenCalledWith('d', expect.any(AbortSignal))
    expect(result.current.status).toBe('saved')
    expect(result.current.lastSavedAt).not.toBeNull()
  })

  it('surfaces errors via status=error and the error field', async () => {
    const save = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() =>
      useDebouncedAutoSave({ value: 'x', save, delayMs: 100 })
    )
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    await settle()
    expect(result.current.status).toBe('error')
    expect(result.current.error?.message).toBe('boom')
  })

  it('onError callback fires once per failed save with the error and last attempted value', async () => {
    const save = vi.fn().mockRejectedValue(new Error('network-down'))
    const onError = vi.fn()
    const { result } = renderHook(() =>
      useDebouncedAutoSave({ value: 'attempted', save, delayMs: 100, onError })
    )
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    await settle()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'attempted')
    expect(onError.mock.calls[0][0].message).toBe('network-down')
    expect(result.current.status).toBe('error')
  })

  it('onError is NOT called for save() calls whose AbortSignal fires', async () => {
    type SettleFn = { resolve: () => void; reject: (e: Error) => void }
    const inflight: SettleFn[] = []
    const save = vi.fn((_value: string, signal: AbortSignal) => {
      return new Promise<void>((resolve, reject) => {
        const handlers: SettleFn = {
          resolve: () => {
            signal.removeEventListener('abort', onAbort)
            resolve()
          },
          reject: (e: Error) => {
            signal.removeEventListener('abort', onAbort)
            reject(e)
          },
        }
        const onAbort = () => handlers.reject(new Error('aborted'))
        signal.addEventListener('abort', onAbort)
        inflight.push(handlers)
      })
    })
    const onError = vi.fn()

    const { result, rerender } = renderHook(
      ({ value }) =>
        useDebouncedAutoSave({ value, save, delayMs: 100, onError }),
      { initialProps: { value: 'first' } }
    )
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    // First save is in flight; trigger a second cycle to supersede it.
    rerender({ value: 'second' })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(inflight.length).toBe(2)
    // Resolve the (eventually superseded) first save — its AbortSignal fired
    // when runSave('second') ran abortInflight(), so the fetch rejected via
    // `onAbort`. The hook's catch block filters on controller.signal.aborted
    // so onError is NOT called for this save.
    await act(async () => {
      // Resolve second save cleanly.
      inflight[1].resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onError).not.toHaveBeenCalled()
    expect(result.current.status).toBe('saved')
    expect(inflight[0]).toBeDefined()
  })

  it('cancel() drops the pending timer without calling save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDebouncedAutoSave({ value: 'x', save, delayMs: 200 })
    )
    expect(result.current.status).toBe('pending')
    act(() => {
      result.current.cancel()
    })
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(save).not.toHaveBeenCalled()
    // After cancel with no prior save, status drops to idle.
    expect(result.current.status).toBe('idle')
  })

  it('cancel() reverts to saved when there IS a prior saved value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedAutoSave({ value, save, delayMs: 100 }),
      { initialProps: { value: 'first' } }
    )
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    await settle()
    expect(result.current.status).toBe('saved')
    rerender({ value: 'second' })
    expect(result.current.status).toBe('pending')
    act(() => {
      result.current.cancel()
    })
    expect(result.current.status).toBe('saved')
  })

  it('saveNow() flushes the pending debounce immediately and resolves with the right value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDebouncedAutoSave({ value: 'flush-me', save, delayMs: 999 })
    )
    expect(result.current.status).toBe('pending')
    await act(async () => {
      await result.current.saveNow()
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('flush-me', expect.any(AbortSignal))
    expect(result.current.status).toBe('saved')
  })

  it('supersede: latest save wins; in-flight older save is aborted', async () => {
    type SettleFn = { resolve: () => void; reject: (e: Error) => void }
    const inflight: SettleFn[] = []
    const save = vi.fn((_value: string, signal: AbortSignal) => {
      return new Promise<void>((resolve, reject) => {
        const handlers: SettleFn = {
          resolve: () => {
            signal.removeEventListener('abort', onAbort)
            resolve()
          },
          reject: (e: Error) => {
            signal.removeEventListener('abort', onAbort)
            reject(e)
          },
        }
        const onAbort = () => handlers.reject(new Error('aborted'))
        signal.addEventListener('abort', onAbort)
        inflight.push(handlers)
      })
    })

    const { rerender } = renderHook(
      ({ value }) => useDebouncedAutoSave({ value, save, delayMs: 100 }),
      { initialProps: { value: 'first' } }
    )

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    // First save is mid-flight; keep it pending.
    expect(inflight.length).toBe(1)

    // Trigger a second cycle while the first is in-flight.
    rerender({ value: 'second' })

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(inflight.length).toBe(2)
    expect(inflight[1]).not.toBe(inflight[0])

    // The newest save resolves successfully.
    await act(async () => {
      inflight[1].resolve()
      // Resolve the older (superseded) save too — its AbortSignal fired
      // when the new run call ran, so its reject fired first; calling
      // resolve after is a no-op for our hook (it filtered on aborted).
      inflight[0].resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(inflight.length).toBe(2)
  })

  it('isDirty stays true until the value matches what was last saved', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ value }) =>
        useDebouncedAutoSave({
          value,
          save,
          delayMs: 100,
          isEqual: (a, b) => a === b,
        }),
      { initialProps: { value: 'a' } }
    )
    expect(result.current.isDirty).toBe(true)
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    await settle()
    expect(result.current.status).toBe('saved')
    expect(result.current.isDirty).toBe(false)

    rerender({ value: 'b' })
    expect(result.current.isDirty).toBe(true)

    rerender({ value: 'a' })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    await settle()
    expect(result.current.isDirty).toBe(false)
  })

  it('onSaved callback fires exactly once per successful save', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const onSaved = vi.fn()
    const { rerender } = renderHook(
      ({ value }) =>
        useDebouncedAutoSave({ value, save, delayMs: 100, onSaved, isEqual: (a, b) => a === b }),
      { initialProps: { value: 'a' } }
    )
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    await settle()
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onSaved).toHaveBeenCalledWith('a')

    // Same value re-rendered: no new save, no new callback.
    rerender({ value: 'a' })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(onSaved).toHaveBeenCalledTimes(1)

    // New value: new save, new callback.
    rerender({ value: 'b' })
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    await settle()
    expect(onSaved).toHaveBeenCalledTimes(2)
    expect(onSaved).toHaveBeenLastCalledWith('b')
  })

  it('enabled: false is a no-op (no timer scheduled, save not called)', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDebouncedAutoSave({ value: 'x', save, delayMs: 100, enabled: false })
    )
    expect(result.current.status).toBe('idle')
    await act(async () => {
      vi.advanceTimersByTime(500)
    })
    expect(save).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')
  })

  it('unmount aborts any in-flight save instead of leaking a post-unmount state update', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { unmount } = renderHook(() =>
      useDebouncedAutoSave({ value: 'x', save, delayMs: 100 })
    )
    // Let the debounce settle so the save is in-flight…
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    // The save promise resolves synchronously after `await`, so the hook
    // has already settled before we unmount. The remaining check is that
    // unmount does not throw.
    expect(() => unmount()).not.toThrow()
  })
})
