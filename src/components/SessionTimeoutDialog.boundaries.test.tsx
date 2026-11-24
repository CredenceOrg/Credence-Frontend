import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SessionTimeoutDialog, { type SessionTimeoutDialogProps } from './SessionTimeoutDialog'

/**
 * Deterministic failure-boundary and recovery coverage for the session-timeout
 * modal (#1153).
 *
 * The component was renamed from `SessionTimeoutModal.tsx` to
 * `SessionTimeoutDialog.tsx` in #929 ("rename Modal to Dialog for semantic
 * HTML"); the public `SessionTimeoutModal` entry point is this dialog. This
 * suite complements `SessionTimeoutDialog.test.tsx` by pinning the adverse
 * states:
 *
 * - **non-positive budget** — an already-expired (or hostile) `timeLeftSeconds`
 *   schedules no countdown and can never auto-log-out;
 * - **boundary input** — the confirm CTA is unlocked only by the exact,
 *   case-sensitive `STAY` phrase, including the trailing-whitespace case;
 * - **recovery** — a fresh budget is adopted when the prop changes while open,
 *   and "Stay logged in" remains available after the countdown reaches zero;
 * - **dismissal paths** — Escape, backdrop click, and Cancel each route through
 *   `onLogout` exactly once and never confirm.
 */
function renderDialog(overrides: Partial<SessionTimeoutDialogProps> = {}) {
  const onStayLoggedIn = vi.fn()
  const onLogout = vi.fn()
  const props: SessionTimeoutDialogProps = {
    open: true,
    timeLeftSeconds: 60,
    onStayLoggedIn,
    onLogout,
    ...overrides,
  }
  const result = render(<SessionTimeoutDialog {...props} />)
  return { ...result, onStayLoggedIn, onLogout, props }
}

function subtitleText() {
  return screen.getByRole('dialog').querySelector('.confirm-dialog__subtitle')?.textContent
}

describe('SessionTimeoutDialog — boundary & recovery (#1153)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.style.overflow = ''
  })

  it('renders nothing and never fires callbacks while closed', () => {
    vi.useFakeTimers()
    const { onStayLoggedIn, onLogout } = renderDialog({ open: false, timeLeftSeconds: 5 })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(onStayLoggedIn).not.toHaveBeenCalled()
    expect(onLogout).not.toHaveBeenCalled()
  })

  it('does not count down or auto-log-out for a zero budget', () => {
    vi.useFakeTimers()
    const { onLogout } = renderDialog({ timeLeftSeconds: 0 })

    expect(subtitleText()).toBe('Your session will expire in 0 seconds due to inactivity.')

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(subtitleText()).toBe('Your session will expire in 0 seconds due to inactivity.')
    expect(onLogout).not.toHaveBeenCalled()
  })

  it('never schedules a timer for a negative budget', () => {
    vi.useFakeTimers()
    const { onLogout } = renderDialog({ timeLeftSeconds: -5 })

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    expect(onLogout).not.toHaveBeenCalled()
  })

  it('counts down once per second and clamps at zero without logging out', () => {
    vi.useFakeTimers()
    const { onLogout } = renderDialog({ timeLeftSeconds: 2 })

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(subtitleText()).toContain('0 seconds')

    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(subtitleText()).toContain('0 seconds')
    expect(onLogout).not.toHaveBeenCalled()
  })

  it('unlocks the CTA only for the exact uppercase phrase', () => {
    const { onStayLoggedIn } = renderDialog()
    const button = screen.getByRole('button', { name: 'Stay logged in' })
    const input = screen.getByRole('textbox', { name: /type.*stay/i })

    expect(button).toBeDisabled()

    fireEvent.change(input, { target: { value: 'stay' } })
    expect(button).toBeDisabled()

    fireEvent.change(input, { target: { value: 'STAY ' } })
    expect(button).toBeDisabled()

    fireEvent.change(input, { target: { value: 'STAY' } })
    expect(button).toBeEnabled()

    fireEvent.click(button)
    expect(onStayLoggedIn).toHaveBeenCalledTimes(1)
  })

  it('still allows staying logged in after the countdown reaches zero', () => {
    vi.useFakeTimers()
    const { onStayLoggedIn, onLogout } = renderDialog({ timeLeftSeconds: 1 })

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(subtitleText()).toContain('0 seconds')

    fireEvent.change(screen.getByRole('textbox', { name: /type.*stay/i }), {
      target: { value: 'STAY' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Stay logged in' }))

    expect(onStayLoggedIn).toHaveBeenCalledTimes(1)
    expect(onLogout).not.toHaveBeenCalled()
  })

  it('adopts a fresh budget when the prop changes while open', () => {
    vi.useFakeTimers()
    const { rerender, onStayLoggedIn, onLogout } = renderDialog({ timeLeftSeconds: 5 })

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(subtitleText()).toContain('3 seconds')

    rerender(
      <SessionTimeoutDialog
        open
        timeLeftSeconds={30}
        onStayLoggedIn={onStayLoggedIn}
        onLogout={onLogout}
      />
    )
    expect(subtitleText()).toContain('30 seconds')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(subtitleText()).toContain('29 seconds')
  })

  it('removes the dialog and stops counting once closed', () => {
    vi.useFakeTimers()
    const { rerender, onStayLoggedIn, onLogout } = renderDialog({ timeLeftSeconds: 5 })

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    rerender(
      <SessionTimeoutDialog
        open={false}
        timeLeftSeconds={5}
        onStayLoggedIn={onStayLoggedIn}
        onLogout={onLogout}
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('routes an Escape keypress to onLogout and never confirms', () => {
    const { onStayLoggedIn, onLogout } = renderDialog()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(onStayLoggedIn).not.toHaveBeenCalled()
  })

  it('routes a backdrop click to onLogout and never confirms', () => {
    const { onStayLoggedIn, onLogout } = renderDialog()

    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog.parentElement as HTMLElement)

    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(onStayLoggedIn).not.toHaveBeenCalled()
  })

  it('routes Cancel to onLogout and never confirms', () => {
    const { onStayLoggedIn, onLogout } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(onStayLoggedIn).not.toHaveBeenCalled()
  })

  it('surfaces a safe alert on extension failure without unhandled rejections and allows retry or logout', async () => {
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason)
    }
    process.on('unhandledRejection', onUnhandledRejection)

    try {
      const onStayLoggedIn = vi
        .fn()
        .mockRejectedValueOnce(new Error('internal_token=leak'))
        .mockResolvedValueOnce(undefined)
      const { onLogout } = renderDialog({ onStayLoggedIn })

      fireEvent.change(screen.getByRole('textbox', { name: /type.*stay/i }), {
        target: { value: 'STAY' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Stay logged in' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Unable to extend your session. Please retry or sign out.')
      expect(alert).not.toHaveTextContent('internal_token=leak')
      expect(unhandledRejections).toEqual([])
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Stay logged in' })).toBeEnabled()

      // Retry succeeds and clears the alert
      fireEvent.click(screen.getByRole('button', { name: /retry/i }))
      await waitFor(() => expect(onStayLoggedIn).toHaveBeenCalledTimes(2))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()

      // Sign-out remains functional
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onLogout).toHaveBeenCalledTimes(1)
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('clears the extension error alert when closed and reopened', async () => {
    const onStayLoggedIn = vi.fn().mockRejectedValueOnce(new Error('network error'))
    const { rerender, onLogout } = renderDialog({ onStayLoggedIn })

    fireEvent.change(screen.getByRole('textbox', { name: /type.*stay/i }), {
      target: { value: 'STAY' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Stay logged in' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()

    rerender(
      <SessionTimeoutDialog
        open={false}
        timeLeftSeconds={60}
        onStayLoggedIn={onStayLoggedIn}
        onLogout={onLogout}
      />
    )
    rerender(
      <SessionTimeoutDialog
        open
        timeLeftSeconds={60}
        onStayLoggedIn={onStayLoggedIn}
        onLogout={onLogout}
      />
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('enforces the submissionInFlight lock when retrying after a failure', async () => {
    let resolveRetry!: () => void
    const onStayLoggedIn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveRetry = resolve
          })
      )
    renderDialog({ onStayLoggedIn })

    fireEvent.change(screen.getByRole('textbox', { name: /type.*stay/i }), {
      target: { value: 'STAY' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Stay logged in' }))

    const retryButton = await screen.findByRole('button', { name: /retry/i })
    const stayButton = screen.getByRole('button', { name: 'Stay logged in' })

    act(() => {
      fireEvent.click(retryButton)
      fireEvent.click(stayButton)
    })

    expect(onStayLoggedIn).toHaveBeenCalledTimes(2)
    expect(stayButton).toBeDisabled()

    await act(async () => {
      resolveRetry()
    })
    expect(stayButton).toBeEnabled()
  })
})
