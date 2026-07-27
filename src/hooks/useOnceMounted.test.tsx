import { StrictMode } from 'react'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useOnceMounted } from './useOnceMounted'

describe('useOnceMounted', () => {
  it('runs the callback exactly once on mount', () => {
    const cb = vi.fn()
    renderHook(() => useOnceMounted(cb))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('runs the callback exactly once under StrictMode double-invoke', () => {
    const cb = vi.fn()

    const { unmount } = renderHook(() => useOnceMounted(cb), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      ),
    })

    expect(cb).toHaveBeenCalledTimes(1)

    unmount()
    // Callback should still have been called exactly once after unmount
    // (the StrictMode double-invoke did not cause a second invocation).
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('runs the callback again after a true unmount and remount', () => {
    const cb = vi.fn()

    const { unmount } = renderHook(() => useOnceMounted(cb))
    expect(cb).toHaveBeenCalledTimes(1)

    // True unmount — the component instance is destroyed.
    unmount()

    // Mount a fresh instance — the callback should fire again.
    renderHook(() => useOnceMounted(cb))
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('invokes the cleanup function on unmount', () => {
    const cleanup = vi.fn()
    const cb = vi.fn(() => cleanup)

    const { unmount } = renderHook(() => useOnceMounted(cb))

    expect(cb).toHaveBeenCalledTimes(1)
    expect(cleanup).not.toHaveBeenCalled()

    unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('invokes cleanup during StrictMode simulated unmount but callback only once', () => {
    const cleanup = vi.fn()
    const cb = vi.fn(() => cleanup)

    const { unmount } = renderHook(() => useOnceMounted(cb), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      ),
    })

    // Callback fired exactly once despite StrictMode double-invoke.
    expect(cb).toHaveBeenCalledTimes(1)

    // In StrictMode: effect runs → cleanup stored → StrictMode simulated
    // unmount fires cleanup (count: 1, and cleanupRef is cleared) → effect
    // re-runs (no-op because calledRef is true) → real unmount triggers
    // cleanup again but cleanupRef is already undefined, so it's a no-op.
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('does not throw when callback returns undefined (no cleanup)', () => {
    const cb = vi.fn(() => undefined)
    expect(() => {
      const { unmount } = renderHook(() => useOnceMounted(cb))
      unmount()
    }).not.toThrow()
  })

  it('propagates a callback error on mount', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    // The callback runs synchronously inside useEffect, so the error
    // propagates out of renderHook.
    expect(() => {
      renderHook(() =>
        useOnceMounted(() => {
          throw new Error('callback error')
        })
      )
    }).toThrow('callback error')

    consoleError.mockRestore()
  })

  it('is idempotent across repeated renders (no additional invocations)', () => {
    const cb = vi.fn()

    const { rerender } = renderHook(() => useOnceMounted(cb))

    rerender()
    rerender()
    rerender()

    expect(cb).toHaveBeenCalledTimes(1)
  })
})
