import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SessionTimeoutModal, { type SessionTimeoutModalProps } from './SessionTimeoutModal'

function renderModal(overrides: Partial<SessionTimeoutModalProps> = {}) {
  const onStayLoggedIn = vi.fn()
  const onLogout = vi.fn()

  const props: SessionTimeoutModalProps = {
    open: true,
    timeLeftSeconds: 60,
    onStayLoggedIn,
    onLogout,
    ...overrides,
  }

  const result = render(<SessionTimeoutModal {...props} />)
  return { ...result, onStayLoggedIn, onLogout }
}

function subtitleText() {
  return screen.getByRole('dialog').querySelector('.confirm-dialog__subtitle')?.textContent
}

describe('SessionTimeoutModal', () => {
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
        <SessionTimeoutModal
          open
          timeLeftSeconds={60}
          onStayLoggedIn={vi.fn()}
          onLogout={vi.fn()}
        />
      )
      expect(subtitleText()).toBe('Your session will expire in 60 seconds due to inactivity.')
    })

    it('stops counting down once closed', () => {
      const { rerender, onStayLoggedIn, onLogout } = renderModal({ timeLeftSeconds: 5 })

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      rerender(
        <SessionTimeoutModal
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
