import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SessionTimeoutDialog, { type SessionTimeoutDialogProps } from './SessionTimeoutDialog'

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
      renderDialog({ open: false })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('shows the initial time left when opened', () => {
      renderDialog({ timeLeftSeconds: 60 })
      expect(subtitleText()).toBe('Your session will expire in 60 seconds due to inactivity.')
    })
  })

  describe('countdown', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('decrements the countdown by exactly one every second', () => {
      renderDialog({ timeLeftSeconds: 5 })

      for (const expected of [4, 3, 2, 1, 0]) {
        act(() => {
          vi.advanceTimersByTime(1000)
        })
        expect(subtitleText()).toBe(
          `Your session will expire in ${expected} seconds due to inactivity.`
        )
      }
    })

    it('does not decrement more than once per second', () => {
      renderDialog({ timeLeftSeconds: 5 })

      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(subtitleText()).toBe('Your session will expire in 5 seconds due to inactivity.')
    })

    it('clamps at zero and never goes negative', () => {
      renderDialog({ timeLeftSeconds: 2 })

      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(subtitleText()).toBe('Your session will expire in 0 seconds due to inactivity.')
    })

    it('resets the countdown when timeLeftSeconds changes while open', () => {
      const { rerender } = renderDialog({ timeLeftSeconds: 5 })

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

    it('stops counting down once closed', () => {
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
        vi.advanceTimersByTime(5000)
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('CTA behaviour', () => {
    it('keeps "Stay logged in" disabled until STAY is typed', async () => {
      const user = userEvent.setup()
      renderDialog()

      const stayButton = screen.getByRole('button', { name: 'Stay logged in' })
      expect(stayButton).toBeDisabled()

      const input = screen.getByRole('textbox', { name: /type.*stay/i })
      await user.type(input, 'STAY')
      expect(stayButton).toBeEnabled()
    })

    it('calls onStayLoggedIn only after typing STAY and clicking the CTA', async () => {
      const user = userEvent.setup()
      const { onStayLoggedIn, onLogout } = renderDialog()

      const input = screen.getByRole('textbox', { name: /type.*stay/i })
      await user.type(input, 'STAY')
      await user.click(screen.getByRole('button', { name: 'Stay logged in' }))

      expect(onStayLoggedIn).toHaveBeenCalledTimes(1)
      expect(onLogout).not.toHaveBeenCalled()
    })

    it('does not call onStayLoggedIn for a partial or incorrect phrase', async () => {
      const user = userEvent.setup()
      const { onStayLoggedIn } = renderDialog()

      const input = screen.getByRole('textbox', { name: /type.*stay/i })
      await user.type(input, 'stay')
      await user.click(screen.getByRole('button', { name: 'Stay logged in' }))

      expect(onStayLoggedIn).not.toHaveBeenCalled()
    })

    it('calls onLogout when Cancel is clicked', async () => {
      const user = userEvent.setup()
      const { onStayLoggedIn, onLogout } = renderDialog()

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onLogout).toHaveBeenCalledTimes(1)
      expect(onStayLoggedIn).not.toHaveBeenCalled()
    })
  })
})
