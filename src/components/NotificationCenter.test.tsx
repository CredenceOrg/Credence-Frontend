import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationCenter from './NotificationCenter'
import ToastProvider, { useToast } from './ToastProvider'
import {
  appendNotification,
  setActiveNotificationWallet,
} from '../lib/notificationHistory'
import * as WalletContextModule from '../context/WalletContext'
import * as SettingsContextModule from '../context/SettingsContext'

vi.mock('../context/WalletContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/WalletContext')>()
  return {
    ...actual,
    useWallet: vi.fn(),
  }
})

vi.mock('../context/SettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/SettingsContext')>()
  return {
    ...actual,
    useSettings: vi.fn(),
  }
})

const WALLET_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
const WALLET_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

function mockWallet(address: string, isConnected = true) {
  vi.mocked(WalletContextModule.useWallet).mockReturnValue({
    address,
    isConnected,
    connected: isConnected,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    network: 'test',
    lastReauthTime: null,
    reauth: vi.fn(),
    requestReauth: vi.fn(),
    isReauthRequired: () => false,
  })
}

function mockSettings(overrides: Record<string, unknown> = {}) {
  vi.mocked(SettingsContextModule.useSettings).mockReturnValue({
    toastsEnabled: true,
    autoDismiss: '5s',
    quietHoursEnabled: false,
    quietHoursStart: '00:00',
    quietHoursEnd: '23:59',
    ...overrides,
  } as ReturnType<typeof SettingsContextModule.useSettings>)
}

describe('NotificationCenter', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setActiveNotificationWallet(WALLET_A)
    mockWallet(WALLET_A, true)
    mockSettings()
  })

  it('renders bell button with unread badge and updates/resets unread count', () => {
    appendNotification({ id: '1', type: 'info', message: 'First event', timestamp: 1000 }, WALLET_A)
    appendNotification({ id: '2', type: 'success', message: 'Second event', timestamp: 2000 }, WALLET_A)

    render(<NotificationCenter />)

    const trigger = screen.getByRole('button', { name: /notifications/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger.textContent).toContain('2')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('First event')).toBeInTheDocument()
    expect(screen.getByText('Second event')).toBeInTheDocument()

    // Mark all read resets unread count
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(trigger.textContent).not.toContain('2')

    // Clear removes all items
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()
  })

  it('handles Escape key and returns focus to the bell trigger button', async () => {
    appendNotification({ id: '1', type: 'warning', message: 'Watch out', timestamp: 1000 }, WALLET_A)

    render(<NotificationCenter />)

    const trigger = screen.getByRole('button', { name: /notifications/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
    })
  })

  it('traps Tab focus inside the open dialog', () => {
    appendNotification({ id: '1', type: 'info', message: 'Trap test', timestamp: 1000 }, WALLET_A)

    render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    const dialog = screen.getByRole('dialog')
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    expect(buttons.length).toBeGreaterThan(1)

    const first = buttons[0]
    const last = buttons[buttons.length - 1]

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('records quiet-hours-suppressed toasts in history and shows them in the center', () => {
    mockSettings({
      quietHoursEnabled: true,
      quietHoursStart: '00:00',
      quietHoursEnd: '23:59',
    })

    function TriggerToast() {
      const { addToast } = useToast()
      return (
        <button type="button" onClick={() => addToast('info', 'Suppressed during quiet hours')}>
          Fire Toast
        </button>
      )
    }

    render(
      <ToastProvider>
        <NotificationCenter />
        <TriggerToast />
      </ToastProvider>
    )

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Fire Toast' }))
    })

    // Toast should NOT be rendered transiently during quiet hours
    expect(screen.queryByText('Suppressed during quiet hours')).not.toBeInTheDocument()

    // But NotificationCenter should have 1 unread item
    const bell = screen.getByRole('button', { name: /notifications/i })
    expect(bell.textContent).toContain('1')

    fireEvent.click(bell)
    expect(screen.getByText('Suppressed during quiet hours')).toBeInTheDocument()
    expect(screen.getByText('Quiet hours')).toBeInTheDocument()
  })

  it('scopes history to the connected wallet', () => {
    appendNotification({ id: 'a1', type: 'info', message: 'Wallet A only', timestamp: 1000 }, WALLET_A)
    appendNotification({ id: 'b1', type: 'info', message: 'Wallet B only', timestamp: 2000 }, WALLET_B)

    const { rerender } = render(<NotificationCenter />)
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByText('Wallet A only')).toBeInTheDocument()
    expect(screen.queryByText('Wallet B only')).not.toBeInTheDocument()

    mockWallet(WALLET_B, true)
    rerender(<NotificationCenter />)
    expect(screen.getByText('Wallet B only')).toBeInTheDocument()
    expect(screen.queryByText('Wallet A only')).not.toBeInTheDocument()
  })
})
