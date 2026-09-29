import { render, screen, within, act } from '@testing-library/react'
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
){
  const onDismiss = vi.fn()
  const toast = { id: `toast-${severity}`, severity, message, durationMs }

  const view = render(<Toast toast={toast} onDismiss={onDismiss} />)

  return { ...view, onDismiss, toast }
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
    const user = userEvent.setup()
    const { onDismiss, toast } = renderToast('warning')

    const button = screen.getByRole('button', { name: 'Dismiss warning notification' })
    button.focus()
    await user.keyboard('{Enter}')

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith(toast.id)
  })

  it('passes the toast id to onDismiss when removed via keyboard (Space)', async () => {
    const user = userEvent.setup()
    const { onDismiss, toast } = renderToast('warning')

    const button = screen.getByRole('button', { name: 'Dismiss warning notification' })
    button.focus()
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
      vi.advanceTimersByTime(2999)
      expect(onDismiss).not.toHaveBeenCalled()

      // Advance 1 more ms, should dismiss
      vi.advanceTimersByTime(1)
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
      vi.advanceTimersByTime(10000)
      expect(onDismiss).not.toHaveBeenCalled()

      // Leaving resumes the remaining time.
      fireEvent.mouseLeave(toast)
      vi.advanceTimersByTime(5000)
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
      vi.advanceTimersByTime(2000)
      expect(onDismiss).toHaveBeenCalledTimes(1)

      // Hovering after dismissal must be a no-op.
      fireEvent.mouseEnter(toast)
      vi.advanceTimersByTime(10000)
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

      vi.advanceTimersByTime(10000)
      expect(onDismiss).not.toHaveBeenCalled()

      fireEvent.mouseLeave(toast)
      vi.advanceTimersByTime(5000)
      expect(onDismiss).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not double-dismiss when the dismiss button is clicked after timeout', () => {
    vi.useFakeTimers()
    try {
      const { onDismiss } = renderToast('info', 'Double dismiss', 1000)

      vi.advanceTimersByTime(1000)
      expect(onDismiss).toHaveBeenCalledTimes(1)

      const button = screen.getByRole('button', { name: 'Dismis info notification' })
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

      expect(screen.queryButton('progressbar')).not.toBeInTheDocument()

      fireEvent.mouseEnter(toast)
      fireEvent.mouseLeave(toast)
      vi.advanceTimersByTime(10000)
      expect(onDismiss).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
