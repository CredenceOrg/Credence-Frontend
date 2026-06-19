import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsProvider } from '../context/SettingsContext'
import ToastProvider, { useToast } from './ToastProvider'

afterEach(() => {
  localStorage.clear()
})

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

function ToastTrigger({ severity = 'info' as const, message = 'hello' } = {}) {
  const { addToast, removeAllToasts } = useToast()
  return (
    <>
      <button onClick={() => addToast(severity, message)}>add toast</button>
      <button onClick={removeAllToasts}>remove all</button>
    </>
  )
}

function renderWithProviders(settingsOverrides?: Record<string, unknown>) {
  if (settingsOverrides) {
    localStorage.setItem('credence:settings', JSON.stringify(settingsOverrides))
  }
  return render(
    <SettingsProvider>
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>
    </SettingsProvider>
  )
}

describe('ToastProvider wiring with SettingsProvider', () => {
  it('adds a toast when toastsEnabled is true', async () => {
    const user = userEvent.setup()
    renderWithProviders({ toastsEnabled: true })
    await user.click(screen.getByRole('button', { name: 'add toast' }))
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('suppresses toasts when toastsEnabled is false', async () => {
    const user = userEvent.setup()
    renderWithProviders({ toastsEnabled: false })
    await user.click(screen.getByRole('button', { name: 'add toast' }))
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })

  it('renders Dismiss All button when multiple toasts are present', async () => {
    const user = userEvent.setup()
    renderWithProviders({ toastsEnabled: true, autoDismiss: 'off' })
    await user.click(screen.getByRole('button', { name: 'add toast' }))
    await user.click(screen.getByRole('button', { name: 'add toast' }))
    expect(screen.getByRole('button', { name: 'Dismiss All' })).toBeInTheDocument()
  })

  it('removeAllToasts clears every toast', async () => {
    const user = userEvent.setup()
    renderWithProviders({ toastsEnabled: true, autoDismiss: 'off' })
    await user.click(screen.getByRole('button', { name: 'add toast' }))
    await user.click(screen.getByRole('button', { name: 'remove all' }))
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })

  it('auto-dismisses toast according to autoDismiss setting', () => {
    vi.useFakeTimers()
    renderWithProviders({ toastsEnabled: true, autoDismiss: '3s' })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'add toast' })) })
    expect(screen.getByText('hello')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3100) })
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('does not auto-dismiss when autoDismiss is off', () => {
    vi.useFakeTimers()
    renderWithProviders({ toastsEnabled: true, autoDismiss: 'off' })
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'add toast' })) })
    act(() => { vi.advanceTimersByTime(30000) })
    expect(screen.getByText('hello')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('throws when useToast is used outside ToastProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ToastTrigger />)).toThrow('useToast must be used within ToastProvider')
    spy.mockRestore()
  })
})
