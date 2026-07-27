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

  it('does not call preload again on second onMouseEnter', () => {
    const preload = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onMouseEnter()
    result.current.onMouseEnter()

    expect(preload).toHaveBeenCalledTimes(1)
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
    const preload = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useRoutePrefetch(preload))

    result.current.onMouseEnter()

    await new Promise(resolve => setTimeout(resolve, 0))

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
