import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRoutePrefetch } from './useRoutePrefetch'

describe('useRoutePrefetch', () => {
  it('calls preload on first onMouseEnter', () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onMouseEnter()

    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('logs debug events on preload start and success', async () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onMouseEnter()

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(debug).toHaveBeenCalledTimes(2)
    expect(debug.mock.calls[0]?.[0]).toMatch(/event=route_prefetch_start/)
    expect(debug.mock.calls[1]?.[0]).toMatch(/event=route_prefetch_complete/)
  })

  it('logs debug event on preload failure and allows retry', async () => {
    const preload = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined)
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onMouseEnter()

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(debug.mock.calls[0]?.[0]).toMatch(/event=route_prefetch_start/)
    expect(debug.mock.calls[1]?.[0]).toMatch(/event=route_prefetch_retry/)

    result.current.onMouseEnter()

    expect(preload).toHaveBeenCalledTimes(2)
  })

  it('calls preload on onFocus', () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onFocus()

    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('calls preload on onTouchStart', () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onTouchStart()

    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('deduplicates across onMouseEnter and onFocus', () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onMouseEnter()
    result.current.onFocus()
    result.current.onTouchStart()

    expect(preload).toHaveBeenCalledTimes(1)
  })

  it('allows retry when preload rejects', async () => {
    const preload = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onMouseEnter()

    await new Promise((resolve) => setTimeout(resolve, 0))

    result.current.onMouseEnter()

    expect(preload).toHaveBeenCalledTimes(2)
  })

  it('returns stable handlers across renders', () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(() => useRoutePrefetch(preload))

    const first = result.current

    rerender()

    expect(result.current.onMouseEnter).toBe(first.onMouseEnter)
    expect(result.current.onFocus).toBe(first.onFocus)
    expect(result.current.onTouchStart).toBe(first.onTouchStart)
  })
})
