import { render, screen, act, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import ToastProvider, { useToast } from './ToastProvider'
import * as SettingsContextModule from '../context/SettingsContext'

// Mock the settings module to control useSettings
vi.mock('../context/SettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/SettingsContext')>()
  return {
    ...actual,
    useSettings: vi.fn(),
  }
})

function TestComponent() {
  const { addToast, removeAllToasts } = useToast()
  return (
    <div>
      <button onClick={() => addToast('info', 'Info Message')}>Add Info</button>
      <button onClick={() => addToast('danger', 'Danger Message')}>Add Danger</button>
      <button onClick={removeAllToasts}>Remove All</button>
    </div>
  )
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      toastsEnabled: true,
      autoDismiss: '5s',
    } as ReturnType<typeof SettingsContextModule.useSettings>)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('adds and auto-dismisses a toast according to autoDismiss setting', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

    // autoDismiss is 5s
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(container.querySelector('.toast')).not.toBeInTheDocument()
  })

  it('respects toastsEnabled changes mid-session', () => {
    const { rerender, container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

    // Disable toasts mid-session
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      toastsEnabled: false,
      autoDismiss: '5s',
    } as ReturnType<typeof SettingsContextModule.useSettings>)

    rerender(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Fire another toast
    fireEvent.click(screen.getByText('Add Danger'))
    // Danger message should not appear
    expect(container.querySelector('.toast--danger')).not.toBeInTheDocument()
  })

  it('respects autoDismiss changes mid-session', () => {
    const { rerender, container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // Change autoDismiss to 3s mid-session
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      toastsEnabled: true,
      autoDismiss: '3s',
    } as ReturnType<typeof SettingsContextModule.useSettings>)

    rerender(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Should be dismissed now
    expect(container.querySelector('.toast')).not.toBeInTheDocument()
  })

  it('danger toasts stay sticky (0 timeout)', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Danger'))
    expect(container.querySelector('.toast--danger')).toHaveTextContent('Danger Message')

    act(() => {
      vi.advanceTimersByTime(100000)
    })

    expect(container.querySelector('.toast--danger')).toHaveTextContent('Danger Message')
  })

  it('enforces maximum 3 toasts', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    // autoDismiss is off for easy testing
    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      toastsEnabled: true,
      autoDismiss: 'off',
    } as ReturnType<typeof SettingsContextModule.useSettings>)

    fireEvent.click(screen.getByText('Add Danger'))
    fireEvent.click(screen.getByText('Add Danger'))
    fireEvent.click(screen.getByText('Add Danger'))

    expect(container.querySelectorAll('.toast--danger').length).toBe(3)

    // Add a 4th one, should drop the first one
    fireEvent.click(screen.getByText('Add Info'))

    expect(container.querySelectorAll('.toast--danger').length).toBe(2)
    expect(container.querySelectorAll('.toast--info').length).toBe(1)
  })

  it('clears timeouts when removed early', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(container.querySelector('.toast')).toHaveTextContent('Info Message')

    // remove all manually
    fireEvent.click(screen.getByText('Remove All'))
    expect(container.querySelector('.toast')).not.toBeInTheDocument()

    // advance timers, should not error or cause updates on unmounted/removed toasts
    act(() => {
      vi.advanceTimersByTime(5000)
    })
  })

  it('has visually hidden aria-live regions for reliable announcements', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    expect(container.querySelector('.sr-only[aria-live="polite"]')).toBeInTheDocument()
    expect(container.querySelector('.sr-only[aria-live="assertive"]')).toBeInTheDocument()
  })

  it('mirrors toast messages to the visually hidden aria-live region', () => {
    const { container } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    
    const politeRegion = container.querySelector('.sr-only[aria-live="polite"]')
    expect(politeRegion).toHaveTextContent('Info Message')
  })
})
