import { render, screen, within, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import Toast, { type ToastSeverity } from './Toast'

const SEVERITY_CASES = [
  {
    severity: 'info',
    role: 'status',
    iconSelector: 'circle[cx="12"][cy="12"][r="10"]',
  },
  {
    severity: 'success',
    role: 'status',
    iconSelector: 'polyline[points="20 6 9 17 4 12"]',
  },
  {
    severity: 'warning',
    role: 'status',
    iconSelector: 'path[d^="M10.29 3.86"]',
  },
  {
    severity: 'danger',
    role: 'alert',
    iconSelector: 'line[x1="15"][y1="9"][x2="9"][y2="15"]',
  },
] as const satisfies readonly {
  severity: ToastSeverity
  role: 'status' | 'alert'
  iconSelector: string
}[]

function renderToast(
  severity: ToastSeverity,
  message = `${severity} notification`,
  durationMs = 5000
) {
  const onDismiss = vi.fn()
  const toast = { id: `toast-${severity}`, severity, message, durationMs }

  const view = render(<Toast toast={toast} onDismiss={onDismiss} />)

  return { ...view, onDismiss, toast }
}

/**
 * Advances the fake clock inside `act` so the progress `setInterval` flushes
 * synchronously. Bare `vi.advanceTimersByTime` leaves React state updates
 * outside `act`, which both warns and makes the resulting `aria-valuenow`
 * non-deterministic for the assertions that read it.
 */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

describe('Toast', () => {
  it.each(SEVERITY_CASES)(
    'renders the $severity notification contract',
    ({ severity, role, iconSelector }) => {
      const message = `Review the ${severity} state before submitting`
      const { container } = renderToast(severity, message)

      const toast = screen.getByRole(role)
      expect(toast).toHaveClass('toast', `toast--${severity}`)
      expect(within(toast).getByText(message)).toBeInTheDocument()

      const iconContainer = container.querySelector('.toast__icon-container')
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true')
      expect(iconContainer?.querySelector('svg')).toBeInTheDocument()
      expect(iconContainer?.querySelector(iconSelector)).toBeInTheDocument()

      expect(
        screen.getByRole('button', { name: `Dismiss ${severity} notification` })
      ).toBeInTheDocument()
    }
  )

  it('renders a progress indicator for auto-dismissible toasts', () => {
    renderToast('info', 'Auto dismissing toast', 5000)

    const progressBar = screen.getByRole('progressbar', { name: /time remaining/i })
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
    expect(progressBar).toHaveAttribute('aria-valuenow', '100')
  })

  it('passes the toast id to onDismiss when the severity-labelled button is clicked', async () => {
    const user = userEvent.setup()
    const { onDismiss, toast } = renderToast('warning')

    await user.click(screen.getByRole('button', { name: 'Dismiss warning notification' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith(toast.id)
  })

  it('passes the toast id to onDismiss when removed via keyboard (Enter)', async () => {
    // `delay: null` drops userEvent's inter-event waits so the interaction
    // completes synchronously, before the 100ms progress interval can fire
    // and update state outside `act`.
    const user = userEvent.setup({ delay: null })
    const { onDismiss, toast } = renderToast('warning')

    const button = screen.getByRole('button', { name: 'Dismiss warning notification' })
    // `.focus()` is a raw DOM call (not `fireEvent`), so it is not auto-wrapped
    // in `act`; doing so keeps the resulting `setProgress` flush deterministic.
    act(() => {
      button.focus()
    })
    await user.keyboard('{Enter}')

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith(toast.id)
  })

  it('passes the toast id to onDismiss when removed via keyboard (Space)', async () => {
    const user = userEvent.setup({ delay: null })
    const { onDismiss, toast } = renderToast('warning')

    const button = screen.getByRole('button', { name: 'Dismiss warning notification' })
    // `.focus()` is a raw DOM call (not `fireEvent`), so it is not auto-wrapped
    // in `act`; doing so keeps the resulting `setProgress` flush deterministic.
    act(() => {
      button.focus()
    })
    await user.keyboard(' ')

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith(toast.id)
  })

  it('has the correct aria-label accessible name', () => {
    renderToast('info')
    expect(screen.getByRole('button', { name: 'Dismiss info notification' })).toHaveAccessibleName(
      'Dismiss info notification'
    )
  })

  it('countdown matches configured duration', () => {
    vi.useFakeTimers()
    try {
      const { onDismiss, toast } = renderToast('info', 'Timeout toast', 3000)

      // Advance by 2999ms, should not dismiss
      advance(2999)
      expect(onDismiss).not.toHaveBeenCalled()

      // Advance 1 more ms, should dismiss
      advance(1)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(onDismiss).toHaveBeenCalledWith(toast.id)
    } finally {
      vi.useRealTimers()
    }
  })

  it('pauses the countdown while hovered and resumes on leave', () => {
    vi.useFakeTimers()
    try {
      const { onDismiss } = renderToast('info', 'Hover toast', 5000)
      const toast = screen.getByRole('status')

      // Hover before the timer expires.
      fireEvent.mouseEnter(toast)
      advance(10000)
      expect(onDismiss).not.toHaveBeenCalled()

      // Leaving resumes the remaining time.
      fireEvent.mouseLeave(toast)
      advance(5000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not restart the countdown when hovered after dismissal', () => {
    vi.useFakeTimers()
    try {
      const { onDismiss } = renderToast('info', 'Dismissed toast', 2000)
      const toast = screen.getByRole('status')

      // Let the toast auto-dismiss.
      advance(2000)
      expect(onDismiss).toHaveBeenCalledTimes(1)

      // Hovering after dismissal must be a no-op.
      fireEvent.mouseEnter(toast)
      advance(10000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores duplicate hover enter events without creating extra timers', () => {
    vi.useFakeTimers()
    try {
      const { onDismiss } = renderToast('info', 'Duplicate hover', 5000)
      const toast = screen.getByRole('status')

      fireEvent.mouseEnter(toast)
      fireEvent.mouseEnter(toast)
      fireEvent.mouseEnter(toast)

      advance(10000)
      expect(onDismiss).not.toHaveBeenCalled()

      fireEvent.mouseLeave(toast)
      advance(5000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not double-dismiss when the dismiss button is clicked after timeout', () => {
    vi.useFakeTimers()
    try {
      const { onDismiss } = renderToast('info', 'Double dismiss', 1000)

      advance(1000)
      expect(onDismiss).toHaveBeenCalledTimes(1)

      const button = screen.getByRole('button', { name: 'Dismiss info notification' })
      act(() => {
        button.click()
      })
      expect(onDismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats zero duration as non-auto-dismissible and ignores hover', () => {
    vi.useFakeTimers()
    try {
      const { onDismiss } = renderToast('danger', 'Sticky toast', 0)
      const toast = screen.getByRole('alert')

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

      fireEvent.mouseEnter(toast)
      fireEvent.mouseLeave(toast)
      advance(10000)
      expect(onDismiss).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * `handleFocus` / `handleBlur` failure-boundary coverage (#1164).
 *
 * Every case below pins a *deterministic* outcome: fake timers are installed
 * before render (so `Date.now()` — which `pauseTimer` uses to bank elapsed
 * time — advances in lockstep with the interval/timeout queue), timer advances
 * are wrapped in `act` so React state flushes are synchronous and inspectable,
 * and the assertions compare against exact remaining milliseconds rather than
 * ranges. Nothing here depends on wall-clock timing.
 */
describe('Toast handleFocus / handleBlur failure boundaries', () => {
  /** Reads the rounded remaining percentage off the progress bar. */
  const remainingPercent = () =>
    Number(
      screen.getByRole('progressbar', { name: /time remaining/i }).getAttribute('aria-valuenow')
    )

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('focus pausing the auto-dismiss timer', () => {
    it('pauses the countdown on focus and holds it indefinitely', () => {
      const { onDismiss, toast } = renderToast('info', 'Focus pause', 5000)
      const el = screen.getByRole('status')

      advance(1000)
      expect(remainingPercent()).toBe(80)

      fireEvent.focus(el)

      // A focus pause must survive an arbitrarily long wait.
      advance(60000)
      expect(onDismiss).not.toHaveBeenCalled()
      expect(remainingPercent()).toBe(80)

      fireEvent.blur(el, { relatedTarget: null })
      advance(5000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(onDismiss).toHaveBeenCalledWith(toast.id)
    })

    it('resumes for exactly the banked remainder, not the full duration', () => {
      const { onDismiss } = renderToast('info', 'Exact remainder', 5000)
      const el = screen.getByRole('status')

      advance(1200)
      fireEvent.focus(el)
      advance(10000)

      fireEvent.blur(el, { relatedTarget: null })
      // 5000 - 1200 banked = 3800ms remain. One tick early must not dismiss.
      advance(3799)
      expect(onDismiss).not.toHaveBeenCalled()
      advance(1)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('pauses when focus lands on a descendant (dismiss button)', () => {
      const { onDismiss } = renderToast('info', 'Child focus', 5000)
      const button = screen.getByRole('button', { name: 'Dismiss info notification' })

      // `onFocus` bubbles, so focus on the child must pause the root timer.
      fireEvent.focus(button)
      advance(30000)

      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('is idempotent for repeated focus events on the same element', () => {
      const { onDismiss } = renderToast('info', 'Duplicate focus', 5000)
      const el = screen.getByRole('status')

      advance(1000)
      fireEvent.focus(el)
      fireEvent.focus(el)
      fireEvent.focus(el)

      advance(30000)
      expect(onDismiss).not.toHaveBeenCalled()
      // Three focuses must not triple-bank elapsed time.
      expect(remainingPercent()).toBe(80)

      fireEvent.blur(el, { relatedTarget: null })
      advance(3999)
      expect(onDismiss).not.toHaveBeenCalled()
      advance(1)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('leaves no orphaned timers while paused', () => {
      renderToast('info', 'No leak', 5000)
      const el = screen.getByRole('status')

      // One dismissal timeout + one progress interval.
      expect(vi.getTimerCount()).toBe(2)

      fireEvent.focus(el)
      expect(vi.getTimerCount()).toBe(0)

      fireEvent.blur(el, { relatedTarget: null })
      expect(vi.getTimerCount()).toBe(2)
    })
  })

  describe('blur resuming the dismissal timer', () => {
    it('resumes when focus leaves to an element outside the toast', () => {
      const { onDismiss } = renderToast('info', 'Blur outside', 5000)
      const el = screen.getByRole('status')
      const outside = document.createElement('button')
      document.body.appendChild(outside)

      advance(1000)
      fireEvent.focus(el)
      fireEvent.blur(el, { relatedTarget: outside })

      advance(3999)
      expect(onDismiss).not.toHaveBeenCalled()
      advance(1)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      outside.remove()
    })

    it('stays paused when focus moves to a descendant (relatedTarget inside)', () => {
      const { onDismiss } = renderToast('info', 'Internal move', 5000)
      const el = screen.getByRole('status')
      const button = screen.getByRole('button', { name: 'Dismiss info notification' })

      advance(1000)
      fireEvent.focus(el)

      // relatedTarget is contained by the toast root, so focus never "left".
      expect(el.contains(button)).toBe(true)
      fireEvent.blur(el, { relatedTarget: button })

      advance(30000)
      expect(onDismiss).not.toHaveBeenCalled()
      expect(remainingPercent()).toBe(80)
    })

    it('resumes when relatedTarget is a detached node', () => {
      const { onDismiss } = renderToast('info', 'Detached target', 5000)
      const el = screen.getByRole('status')
      const detached = document.createElement('div')

      advance(1000)
      fireEvent.focus(el)
      // A node that is not in the document cannot be contained: focus is gone.
      fireEvent.blur(el, { relatedTarget: detached })

      advance(4000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('resumes when relatedTarget is null (focus lost to the document)', () => {
      const { onDismiss } = renderToast('info', 'Null target', 5000)
      const el = screen.getByRole('status')

      advance(1000)
      fireEvent.focus(el)
      fireEvent.blur(el, { relatedTarget: null })

      advance(4000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('ignores focus/blur events originating outside the toast', () => {
      const { onDismiss } = renderToast('info', 'Foreign events', 5000)
      const outside = document.createElement('input')
      document.body.appendChild(outside)

      // Neither event reaches the toast's handlers, so the timer is untouched.
      fireEvent.focus(outside)
      fireEvent.blur(outside, { relatedTarget: null })

      advance(4999)
      expect(onDismiss).not.toHaveBeenCalled()
      advance(1)
      expect(onDismiss).toHaveBeenCalledTimes(1)
      outside.remove()
    })
  })

  describe('boundary conditions', () => {
    it('survives rapid focus/blur cycling without leaking or double-dismissing', () => {
      const { onDismiss } = renderToast('info', 'Rapid cycling', 5000)
      const el = screen.getByRole('status')

      advance(1000)
      for (let i = 0; i < 50; i += 1) {
        fireEvent.focus(el)
        fireEvent.blur(el, { relatedTarget: null })
      }

      expect(vi.getTimerCount()).toBe(2)

      // Only the 1000ms of real elapsed time was spent; 4000ms remain.
      fireEvent.focus(el)
      advance(60000)
      expect(onDismiss).not.toHaveBeenCalled()

      fireEvent.blur(el, { relatedTarget: null })
      advance(4000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('accumulates elapsed time correctly across a focus/blur cycle', () => {
      const { onDismiss } = renderToast('info', 'Cumulative', 5000)
      const el = screen.getByRole('status')

      for (const slice of [500, 500, 500, 500]) {
        advance(slice)
        fireEvent.focus(el)
        advance(1000) // paused: must not consume the budget
        fireEvent.blur(el, { relatedTarget: null })
      }

      expect(remainingPercent()).toBe(60) // 2000ms of 5000ms spent

      advance(3000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('ignores focus after the toast has already auto-dismissed', () => {
      const { onDismiss } = renderToast('info', 'Focus after dismiss', 2000)
      const el = screen.getByRole('status')

      advance(2000)
      expect(onDismiss).toHaveBeenCalledTimes(1)

      fireEvent.focus(el)
      advance(60000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('ignores blur after the toast has already auto-dismissed', () => {
      const { onDismiss } = renderToast('info', 'Blur after dismiss', 2000)
      const el = screen.getByRole('status')

      fireEvent.focus(el)
      fireEvent.blur(el, { relatedTarget: null })
      advance(5000)
      expect(onDismiss).toHaveBeenCalledTimes(1)

      fireEvent.blur(el, { relatedTarget: null })
      advance(60000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('does not resurrect the timer when focus/blur cycles after manual dismissal', () => {
      const { onDismiss } = renderToast('info', 'Manual dismiss', 10000)
      const el = screen.getByRole('status')

      fireEvent.focus(el)
      fireEvent.blur(el, { relatedTarget: null })

      act(() => {
        screen.getByRole('button', { name: 'Dismiss info notification' }).click()
      })
      expect(onDismiss).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)

      fireEvent.focus(el)
      fireEvent.blur(el, { relatedTarget: null })
      expect(vi.getTimerCount()).toBe(0)
      advance(60000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('stays focused when hover ends, then resumes only on blur', () => {
      const { onDismiss } = renderToast('info', 'Hover plus focus', 5000)
      const el = screen.getByRole('status')

      advance(1000)
      fireEvent.focus(el)
      fireEvent.mouseEnter(el)

      // Leaving hover while still focused must NOT restart the countdown.
      fireEvent.mouseLeave(el)
      advance(30000)
      expect(onDismiss).not.toHaveBeenCalled()
      expect(remainingPercent()).toBe(80)

      fireEvent.blur(el, { relatedTarget: null })
      advance(4000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('treats focus and blur on a zero-duration toast as no-ops', () => {
      const { onDismiss } = renderToast('danger', 'Sticky focus', 0)
      const el = screen.getByRole('alert')

      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()

      fireEvent.focus(el)
      fireEvent.blur(el, { relatedTarget: null })
      advance(60000)

      expect(onDismiss).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('clears timers on unmount while focused without dismissing', () => {
      const { onDismiss, unmount } = renderToast('info', 'Unmount while focused', 5000)
      const el = screen.getByRole('status')

      advance(1000)
      fireEvent.focus(el)
      unmount()

      expect(vi.getTimerCount()).toBe(0)
      advance(60000)
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('clears timers on unmount while running and does not dismiss', () => {
      const { onDismiss, unmount } = renderToast('info', 'Unmount running', 5000)

      advance(1000)
      unmount()

      expect(vi.getTimerCount()).toBe(0)
      advance(60000)
      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('keeps sibling toasts independent when only one is focused', () => {
      const onDismissA = vi.fn()
      const onDismissB = vi.fn()
      render(
        <>
          <Toast
            toast={{ id: 'a', severity: 'info', message: 'Alpha', durationMs: 5000 }}
            onDismiss={onDismissA}
          />
          <Toast
            toast={{ id: 'b', severity: 'info', message: 'Bravo', durationMs: 5000 }}
            onDismiss={onDismissB}
          />
        </>
      )

      const [alpha] = screen.getAllByRole('status')
      fireEvent.focus(alpha)

      advance(5000)
      expect(onDismissA).not.toHaveBeenCalled()
      expect(onDismissB).toHaveBeenCalledTimes(1)
      expect(onDismissB).toHaveBeenCalledWith('b')

      fireEvent.blur(alpha, { relatedTarget: null })
      advance(5000)
      expect(onDismissA).toHaveBeenCalledTimes(1)
      expect(onDismissA).toHaveBeenCalledWith('a')
    })
  })
})
