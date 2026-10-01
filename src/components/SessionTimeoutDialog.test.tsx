import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SessionTimeoutDialog, { type SessionTimeoutDialogProps } from './SessionTimeoutDialog'

function renderModal(overrides: Partial<SessionTimeoutDialogProps> = {}) {
  const onStayLoggedIn = overrides.onStayLoggedIn ?? vi.fn()
  const onLogout = overrides.onLogout ?? vi.fn()

  const props: SessionTimeoutDialogProps = {
    open: true,
    timeLeftSeconds: 60,
    ...overrides,
    onStayLoggedIn,
    onLogout,
  }

  const result = render(<SessionTimeoutDialog {...props} />)
  return { ...result, onStayLoggedIn, onLogout }
}

function subtitleText() {
  return screen.getByRole('dialog').querySelector('.confirm-dialog__subtitle')?.textContent
}

describe('SessionTimeoutDialog', () => {
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

  describe('rendering', () => {
    it('renders nothing when closed', () => {
      renderModal({ open: false })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows the initial time left when opened', () => {
      renderModal({ timeLeftSeconds: 60 })
      expect(subtitleText()).toBe('Your session will expire in 60 seconds due to inactivity.')
    })
  })

  describe('countdown', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('decrements the countdown by exactly one every second', () => {
      renderModal({ timeLeftSeconds: 5 })

      for (const expected of [4, 3, 2, 1, 0]) {
        act(() => {
          vi.advanceTimersByTime(1000)
        })
        expect(subtitleText()).toBe(
          `Your session will expire in ${expected} seconds due to inactivity.`
        )
      }
    })

    it.each([
      { input: -1, expected: 0 },
      { input: Number.NaN, expected: 0 },
      { input: Number.POSITIVE_INFINITY, expected: 0 },
      { input: 1.2, expected: 2 },
    ])('normalizes invalid and fractional countdown values', ({ input, expected }) => {
      renderModal({ timeLeftSeconds: input })
      expect(subtitleText()).toBe(
        `Your session will expire in ${expected} seconds due to inactivity.`
      )
    })

    it('does not decrement more than once per second', () => {
      renderModal({ timeLeftSeconds: 5 })

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(subtitleText()).toBe('Your session will expire in 5 seconds due to inactivity.')
    })

    it('clamps at zero and never goes negative', () => {
      renderModal({ timeLeftSeconds: 2 })

      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(subtitleText()).toBe('Your session will expire in 0 seconds due to inactivity.')
    })

    it('resets the countdown when timeLeftSeconds changes while open', () => {
      const { rerender } = renderModal({ timeLeftSeconds: 5 })

      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(subtitleText()).toBe('Your session will expire in 2 seconds due to inactivity.')

      rerender(
        <SessionTimeoutDialog
          open
          timeLeftSeconds={60}
          onStayLoggedIn={vi.fn()}
          onLogout={vi.fn()}
        />
      )
      expect(subtitleText()).toBe('Your session will expire in 60 seconds due to inactivity.')
    })

    it('resets the countdown when the dialog is reopened with the same timeout', () => {
      const { rerender, onStayLoggedIn, onLogout } = renderModal({ timeLeftSeconds: 5 })

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(subtitleText()).toBe('Your session will expire in 3 seconds due to inactivity.')

      rerender(
        <SessionTimeoutDialog
          open={false}
          timeLeftSeconds={5}
          onStayLoggedIn={onStayLoggedIn}
          onLogout={onLogout}
        />
      )
      rerender(
        <SessionTimeoutDialog
          open
          timeLeftSeconds={5}
          onStayLoggedIn={onStayLoggedIn}
          onLogout={onLogout}
        />
      )

      expect(subtitleText()).toBe('Your session will expire in 5 seconds due to inactivity.')
    })

    it('clears the countdown interval when unmounted', () => {
      const { unmount } = renderModal({ timeLeftSeconds: 5 })

      expect(vi.getTimerCount()).toBe(1)
      unmount()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('stops counting down once closed', () => {
      const { rerender, onStayLoggedIn, onLogout } = renderModal({ timeLeftSeconds: 5 })

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
        vi.advanceTimersByTime(5000)
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('recovery and concurrency', () => {
    it('shows a safe retry after renewal failure and preserves the confirmation phrase', async () => {
      const user = userEvent.setup()
      const onStayLoggedIn = vi.fn()
        .mockRejectedValueOnce(new Error('access_token=secret permission denied'))
        .mockResolvedValueOnce(undefined)
      renderModal({ onStayLoggedIn })

      const input = screen.getByRole('textbox', { name: /type.*stay/i })
      await user.type(input, 'STAY')
      await user.click(screen.getByRole('button', { name: 'Stay logged in' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Unable to extend your session. Please retry or sign out.')
      expect(alert).not.toHaveTextContent('access_token=secret')
      expect(input).toHaveValue('STAY')

      await user.click(screen.getByRole('button', { name: /retry/i }))
      await waitFor(() => expect(onStayLoggedIn).toHaveBeenCalledTimes(2))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(input).toHaveValue('STAY')
    })

    it('shows loading and prevents concurrent session extension attempts', async () => {
      let resolveExtension!: () => void
      const onStayLoggedIn = vi.fn(
        () => new Promise<void>((resolve) => {
          resolveExtension = resolve
        })
      )
      const user = userEvent.setup()
      renderModal({ onStayLoggedIn })

      await user.type(screen.getByRole('textbox', { name: /type.*stay/i }), 'STAY')
      const stayButton = screen.getByRole('button', { name: 'Stay logged in' })
      act(() => {
        fireEvent.click(stayButton)
        fireEvent.click(stayButton)
      })

      expect(onStayLoggedIn).toHaveBeenCalledTimes(1)
      expect(stayButton).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

      await act(async () => {
        resolveExtension()
      })
      expect(stayButton).toBeEnabled()
    })
  })

  describe('CTA behaviour', () => {
    it('keeps "Stay logged in" disabled until STAY is typed', async () => {
      const user = userEvent.setup()
      renderModal()

      const stayButton = screen.getByRole('button', { name: 'Stay logged in' })
      expect(stayButton).toBeDisabled()

      const input = screen.getByRole('textbox', { name: /type.*stay/i })
      await user.type(input, 'STAY')
      expect(stayButton).toBeEnabled()
    })

    it('calls onStayLoggedIn only after typing STAY and clicking the CTA', async () => {
      const user = userEvent.setup()
      const { onStayLoggedIn, onLogout } = renderModal()

      const input = screen.getByRole('textbox', { name: /type.*stay/i })
      await user.type(input, 'STAY')
      await user.click(screen.getByRole('button', { name: 'Stay logged in' }))

      expect(onStayLoggedIn).toHaveBeenCalledTimes(1)
      expect(onLogout).not.toHaveBeenCalled()
    })

    it('does not call onStayLoggedIn for a partial or incorrect phrase', async () => {
      const user = userEvent.setup()
      const { onStayLoggedIn } = renderModal()

      const input = screen.getByRole('textbox', { name: /type.*stay/i })
      await user.type(input, 'stay')
      await user.click(screen.getByRole('button', { name: 'Stay logged in' }))

      expect(onStayLoggedIn).not.toHaveBeenCalled()
    })

    it('calls onLogout when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const { onStayLoggedIn, onLogout } = renderModal()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onLogout).toHaveBeenCalledTimes(1)
      expect(onStayLoggedIn).not.toHaveBeenCalled()
    })
  })
})
