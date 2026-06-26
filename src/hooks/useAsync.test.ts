import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import useAsync from './useAsync'

describe('useAsync', () => {
  it('starts in loading state when immediate=true', () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.resolve(42)),
    )
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()
  })

  it('does not start loading when immediate=false', () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.resolve(42), { immediate: false }),
    )
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('resolves data after async function completes', async () => {
    const { result } = renderHook(() =>
      useAsync(() => Promise.resolve('hello')),
    )

    // Flush all pending microtasks
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })

    expect(result.current.data).toBe('hello')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('captures errors', async () => {
    const { result } = renderHook(() =>
      useAsync<string>(() => Promise.reject(new Error('fail'))),
    )

    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('fail')
    expect(result.current.isLoading).toBe(false)
  })

  it('run() re-triggers the async function when immediate=false', async () => {
    const fn = vi.fn().mockResolvedValue('data')
    const { result } = renderHook(() => useAsync(fn, { immediate: false }))

    expect(fn).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.run()
    })

    expect(fn).toHaveBeenCalledTimes(1)
    expect(result.current.data).toBe('data')
  })
})
