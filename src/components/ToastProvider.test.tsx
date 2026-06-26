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
      <button onClick={() => addToast('info', 'Toast One')}>Add Toast One</button>
      <button onClick={() => addToast('success', 'Toast Two')}>Add Toast Two</button>
      <button onClick={() => addToast('warning', 'Toast Three')}>Add Toast Three</button>
      <button onClick={() => addToast('info', 'Toast Four')}>Add Toast Four</button>
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
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(screen.getByText('Info Message')).toBeInTheDocument()

    // autoDismiss is 5s
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(screen.getByText('Info Message')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('Info Message')).not.toBeInTheDocument()
  })

  it('respects toastsEnabled changes mid-session', () => {
    const { rerender } = render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(screen.getByText('Info Message')).toBeInTheDocument()

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
    expect(screen.queryByText('Danger Message')).not.toBeInTheDocument()
  })

  it('respects autoDismiss changes mid-session', () => {
    const { rerender } = render(
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
    expect(screen.getByText('Info Message')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Should be dismissed now
    expect(screen.queryByText('Info Message')).not.toBeInTheDocument()
  })

  it('danger toasts stay sticky (0 timeout)', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Danger'))
    expect(screen.getByText('Danger Message')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(100000)
    })

    expect(screen.getByText('Danger Message')).toBeInTheDocument()
  })

  it('enforces maximum 3 toasts', () => {
    render(
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

    expect(screen.getAllByText('Danger Message').length).toBe(3)

    // Add a 4th one, should drop the first one
    fireEvent.click(screen.getByText('Add Info'))

    expect(screen.getAllByText('Danger Message').length).toBe(2)
    expect(screen.getAllByText('Info Message').length).toBe(1)
  })

  it('dismisses the oldest toast first when the queue exceeds 3 items', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
      toastsEnabled: true,
      autoDismiss: 'off',
    } as ReturnType<typeof SettingsContextModule.useSettings>)

    fireEvent.click(screen.getByText('Add Toast One'))
    fireEvent.click(screen.getByText('Add Toast Two'))
    fireEvent.click(screen.getByText('Add Toast Three'))

    expect(screen.getByText('Toast One')).toBeInTheDocument()
    expect(screen.getByText('Toast Two')).toBeInTheDocument()
    expect(screen.getByText('Toast Three')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Add Toast Four'))

    expect(screen.queryByText('Toast One')).not.toBeInTheDocument()
    expect(screen.getByText('Toast Two')).toBeInTheDocument()
    expect(screen.getByText('Toast Three')).toBeInTheDocument()
    expect(screen.getByText('Toast Four')).toBeInTheDocument()
    expect(screen.getAllByRole('status')).toHaveLength(3)
  })

  it('clears timeouts when removed early', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    fireEvent.click(screen.getByText('Add Info'))
    expect(screen.getByText('Info Message')).toBeInTheDocument()

    // remove all manually
    fireEvent.click(screen.getByText('Remove All'))
    expect(screen.queryByText('Info Message')).not.toBeInTheDocument()

    // advance timers, should not error or cause updates on unmounted/removed toasts
    act(() => {
      vi.advanceTimersByTime(5000)
    })
  })

  it('has aria-live="polite" region', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )

    expect(screen.getByLabelText('Notifications')).toHaveAttribute('aria-live', 'polite')
  })
})
