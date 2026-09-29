import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import useCopyToClipboard from './useCopyToClipboard'

describe('useCopyToClipboard', () => {
  const originalClipboard = navigator.clipboard
  const originalExecCommand = document.execCommand

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    })
    document.execCommand = originalExecCommand
  })

  it('uses the Clipboard API (happy path)', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })

    const { result } = renderHook(() => useCopyToClipboard({ timeoutMs: 1000 }))

    let success = false
    await act(async () => {
      success = await result.current.copy('test text')
    })

    expect(success).toBe(true)
    expect(writeTextMock).toHaveBeenCalledWith('test text')
    expect(result.current.copied).toBe(true)
  })

  it('falls back to execCommand when Clipboard API is missing', async () => {
    // Remove clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })

    const execCommandMock = vi.fn((cmd) => cmd === 'copy')
    document.execCommand = execCommandMock

    const { result } = renderHook(() => useCopyToClipboard({ timeoutMs: 1000 }))

    let success = false
    await act(async () => {
      success = await result.current.copy('fallback text')
    })

    expect(success).toBe(true)
    expect(execCommandMock).toHaveBeenCalledWith('copy')
    expect(result.current.copied).toBe(true)
  })

  it('falls back to execCommand when Clipboard API rejects', async () => {
    // Clipboard exists but rejects
    const writeTextMock = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })

    const execCommandMock = vi.fn((cmd) => cmd === 'copy')
    document.execCommand = execCommandMock

    const { result } = renderHook(() => useCopyToClipboard({ timeoutMs: 1000 }))

    let success = false
    await act(async () => {
      success = await result.current.copy('fallback text after rejection')
    })

    expect(success).toBe(true)
    expect(writeTextMock).toHaveBeenCalledWith('fallback text after rejection')
    expect(execCommandMock).toHaveBeenCalledWith('copy')
    expect(result.current.copied).toBe(true)
  })

  it('handles execCommand failure (sad path)', async () => {
    // Remove clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })

    const execCommandMock = vi.fn().mockReturnValue(false)
    document.execCommand = execCommandMock

    const { result } = renderHook(() => useCopyToClipboard({ timeoutMs: 1000 }))

    let success = false
    await act(async () => {
      success = await result.current.copy('sad path text')
    })

    expect(success).toBe(false)
    expect(execCommandMock).toHaveBeenCalledWith('copy')
    expect(result.current.copied).toBe(false)
  })

  it('resets copied state after timeout deterministically', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })

    vi.useFakeTimers()
    const { result } = renderHook(() => useCopyToClipboard({ timeoutMs: 1000 }))

    await act(async () => {
      await result.current.copy('test timeout')
    })

    expect(result.current.copied).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.copied).toBe(false)
    vi.useRealTimers()
  })

  it('returns false when text is empty', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })

    const { result } = renderHook(() => useCopyToClipboard())

    let success = false
    await act(async () => {
      success = await result.current.copy('')
    })

    expect(success).toBe(false)
    expect(writeTextMock).not.toHaveBeenCalled()
  })
})
