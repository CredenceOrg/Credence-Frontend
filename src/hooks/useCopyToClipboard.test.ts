import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCopyToClipboard } from './useCopyToClipboard'

describe('useCopyToClipboard', () => {
  const originalClipboard = navigator.clipboard

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    })
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('writes text to the clipboard and resets copied state after the delay', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const { result } = renderHook(() => useCopyToClipboard({ resetDelay: 500 }))

    await act(async () => {
      const copied = await result.current.copyToClipboard('GCREDENCE')
      expect(copied).toBe(true)
    })

    expect(writeText).toHaveBeenCalledWith('GCREDENCE')
    expect(result.current.copied).toBe(true)
    expect(result.current.error).toBeNull()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.copied).toBe(false)
  })

  it('returns false and records an error when clipboard writing is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })

    const { result } = renderHook(() => useCopyToClipboard())

    await act(async () => {
      const copied = await result.current.copyToClipboard('GCREDENCE')
      expect(copied).toBe(false)
    })

    expect(result.current.copied).toBe(false)
    expect(result.current.error?.message).toMatch(/not available/i)
  })

  it('surfaces rejected clipboard writes and allows manual reset', async () => {
    vi.useFakeTimers()
    const denied = new DOMException('denied', 'NotAllowedError')
    const writeText = vi.fn().mockRejectedValue(denied)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const { result } = renderHook(() => useCopyToClipboard({ resetDelay: 500 }))

    await act(async () => {
      const copied = await result.current.copyToClipboard('GCREDENCE')
      expect(copied).toBe(false)
    })

    expect(result.current.copied).toBe(false)
    expect(result.current.error?.message).toBe(denied.message)

    act(() => {
      result.current.reset()
    })

    expect(result.current.copied).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
