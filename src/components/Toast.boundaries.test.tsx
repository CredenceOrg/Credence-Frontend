import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Toast, { type ToastData } from './Toast'

/**
 * Deterministic failure-boundary and recovery coverage for `Toast` (#1166).
 *
 * The component owns a self-expiring timer whose behavior must stay
 * deterministic for every input class:
 *
 * - **valid** — a positive `durationMs` auto-dismisses exactly once, at the
 *   configured deadline, forwarding the toast id;
 * - **invalid** — a zero or negative `durationMs` is *not* auto-dismissible: it
 *   renders no progress track, never schedules a timer, and ignores hover/focus;
 * - **duplicate** — a second dismiss signal (click after timeout, timeout after
 *   click, repeated clicks) must be a no-op and never call `onDismiss` twice;
 * - **boundary** — pausing/resuming across a hover or focus transition, a blur
 *   that lands on a descendant, and unmounting with a timer live must all leave
 *   no stale timer that could fire after the toast is gone.
 *
 * This suite complements `Toast.test.tsx` by pinning the less-travelled
 * boundaries rather than repeating the rendering contract.
 */
function renderToast(overrides: Partial<ToastData> = {}) {
  const onDismiss = vi.fn()
  const toast: ToastData = {
    id: 'toast-boundary',
    severity: 'info',
    message: 'Boundary toast',
    durationMs: 5000,
    ...overrides,
  }
  const view = render(<Toast toast={toast} onDismiss={onDismiss} />)
  return { ...view, onDismiss, toast }
}

describe('Toast — deterministic failure boundaries (#1166)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('treats a negative duration as non-auto-dismissible', () => {
    const { onDismiss } = renderToast({ severity: 'danger', durationMs: -100 })
    const toast = screen.getByRole('alert')

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

    fireEvent.mouseEnter(toast)
    fireEvent.mouseLeave(toast)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('renders no progress track for a zero duration', () => {
    renderToast({ severity: 'danger', durationMs: 0 })

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('dismisses exactly at the deadline and never one tick early', () => {
    const { onDismiss, toast } = renderToast({ durationMs: 1000 })

    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith(toast.id)
  })

  it('pauses while hovered and resumes with the remaining budget', () => {
    const { onDismiss } = renderToast({ durationMs: 5000 })
    const toast = screen.getByRole('status')

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.mouseEnter(toast)

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.mouseLeave(toast)
    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not extend the budget across repeated hover cycles', () => {
    const { onDismiss } = renderToast({ durationMs: 3000 })
    const toast = screen.getByRole('status')

    fireEvent.mouseEnter(toast)
    fireEvent.mouseLeave(toast)
    fireEvent.mouseEnter(toast)
    fireEvent.mouseLeave(toast)

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('focus pauses the countdown and blur outside the toast resumes it', () => {
    const { onDismiss } = renderToast({ durationMs: 4000 })
    const toast = screen.getByRole('status')

    fireEvent.focus(toast)
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.blur(toast, { relatedTarget: document.body })
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('keeps the countdown paused when blur moves focus to a descendant', () => {
    const { onDismiss } = renderToast({ durationMs: 2000 })
    const toast = screen.getByRole('status')
    const dismissButton = screen.getByRole('button', { name: 'Dismiss info notification' })

    fireEvent.focus(toast)
    fireEvent.blur(toast, { relatedTarget: dismissButton })

    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.blur(toast, { relatedTarget: document.body })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('ignores a second dismiss click after the first', () => {
    const { onDismiss } = renderToast({ durationMs: 0 })
    const button = screen.getByRole('button', { name: 'Dismiss info notification' })

    act(() => {
      button.click()
    })
    act(() => {
      button.click()
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not fire the timer after a manual dismiss', () => {
    const { onDismiss } = renderToast({ durationMs: 1500 })

    act(() => {
      screen.getByRole('button', { name: 'Dismiss info notification' }).click()
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('cannot be resurrected by focus or hover after auto-dismissal', () => {
    const { onDismiss } = renderToast({ durationMs: 1000 })
    const toast = screen.getByRole('status')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)

    fireEvent.mouseEnter(toast)
    fireEvent.focus(toast)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('cancels a pending timer when unmounted', () => {
    const { onDismiss, unmount } = renderToast({ durationMs: 1000 })

    unmount()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('auto-dismisses a danger toast that has a duration, with alert semantics', () => {
    const { onDismiss } = renderToast({ severity: 'danger', durationMs: 1000 })

    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('keeps progress within [0, 100] and clamps at zero on dismissal', () => {
    const { onDismiss } = renderToast({ durationMs: 1000 })
    const progress = screen.getByRole('progressbar', { name: /time remaining/i })

    act(() => {
      vi.advanceTimersByTime(500)
    })
    const midway = Number(progress.getAttribute('aria-valuenow'))
    expect(midway).toBeGreaterThanOrEqual(0)
    expect(midway).toBeLessThanOrEqual(100)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(Number(progress.getAttribute('aria-valuenow'))).toBe(0)
  })

  it('renders an explorer link only when a transaction hash is present', () => {
    const { rerender } = renderToast({ durationMs: 0, txHash: undefined })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    rerender(
      <Toast
        toast={{
          id: 'toast-boundary',
          severity: 'success',
          message: 'With hash',
          durationMs: 0,
          txHash: 'abcdef0123456789',
          network: 'public',
        }}
        onDismiss={vi.fn()}
      />
    )

    const link = screen.getByRole('link', { name: /view transaction on stellar explorer/i })
    expect(link.getAttribute('href')).toContain('abcdef0123456789')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
