import { render, screen, within } from '@testing-library/react'
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

function renderToast(severity: ToastSeverity, message = `${severity} notification`) {
  const onDismiss = vi.fn()
  const toast = { id: `toast-${severity}`, severity, message }

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

  it('passes the toast id to onDismiss when the severity-labelled button is clicked', async () => {
    const user = userEvent.setup()
    const { onDismiss, toast } = renderToast('warning')

    await user.click(screen.getByRole('button', { name: 'Dismiss warning notification' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onDismiss).toHaveBeenCalledWith(toast.id)
  })
})
