// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from './Settings'

// ── Mocks ───────────────────────────────────────────────────────────
const mockUseSettings = vi.fn()
vi.mock('../context/SettingsContext', () => ({
  useSettings: () => mockUseSettings(),
}))

const mockUseWallet = vi.fn()
vi.mock('../context/WalletContext', () => ({
  useWallet: () => mockUseWallet(),
}))

const mockReadPendingTransactions = vi.fn()
vi.mock('../lib/pendingTransactionsStorage', () => ({
  readPendingTransactions: (...args: unknown[]) => mockReadPendingTransactions(...args),
}))

vi.mock('../hooks/useDebouncedAutoSave', () => ({
  useDebouncedAutoSave: () => ({
    status: 'idle',
    lastSavedAt: null,
    error: null,
    isDirty: false,
    saveNow: vi.fn(),
    cancel: vi.fn(),
  }),
}))

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../hooks/useDocumentTitle', () => ({
  useDocumentTitle: () => undefined,
}))

const addToastMock = vi.fn()
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}))

vi.mock('../components/ThemeToggle', () => ({
  default: () => <div data-testid="theme-toggle" />,
}))

// ── Default fixture ─────────────────────────────────────────────────
const BASE_SETTINGS = {
  themeMode: 'light',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  unlockRemindersEnabled: false,
}

/** Build a complete useSettings return value with the given overrides. */
function settingsFixture(overrides: Partial<ReturnType<typeof mockUseSettings>> = {}) {
  return {
    ...BASE_SETTINGS,
    setThemeMode: vi.fn(),
    setNetwork: vi.fn(),
    setAddressDisplay: vi.fn(),
    setToastsEnabled: vi.fn(),
    setAutoDismiss: vi.fn(),
    setQuietHoursEnabled: vi.fn(),
    setQuietHoursStart: vi.fn(),
    setQuietHoursEnd: vi.fn(),
    setUnlockRemindersEnabled: vi.fn(),
    saveSettings: vi.fn(),
    cancelSettings: vi.fn(),
    hasUnsavedChanges: false,
    ...overrides,
  }
}

beforeEach(() => {
  mockUseSettings.mockReturnValue(settingsFixture())
  mockUseWallet.mockReturnValue({ address: '', isConnected: false, connected: false, network: null })
  mockReadPendingTransactions.mockReturnValue([])
  addToastMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Helpers ─────────────────────────────────────────────────────────
async function selectTheme(mode: 'Light' | 'Dark' | 'System') {
  const user = userEvent.setup()
  await user.click(screen.getByRole('radio', { name: mode }))
}

async function clickCancel() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
}

/** Update the mock to return context values that match the given overrides.
 *  Use this to simulate what happens after saveSettings propagates through
 *  real React state (the context values catch up to the draft). */
function setContext(overrides: Partial<ReturnType<typeof mockUseSettings>> = {}) {
  mockUseSettings.mockReturnValue(settingsFixture(overrides))
}

// ── Tests ───────────────────────────────────────────────────────────
describe('Settings — unsaved-changes guard', () => {
  describe('prompt-on-navigate (Cancel button)', () => {
    it('does NOT show window.confirm when there are no unsaved changes', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm')

      render(<Settings />)
      await clickCancel()

      expect(confirmSpy).not.toHaveBeenCalled()
    })

    it('shows window.confirm when there are unsaved changes', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<Settings />)
      await selectTheme('Dark')
      await clickCancel()

      expect(confirmSpy).toHaveBeenCalledTimes(1)
      expect(confirmSpy).toHaveBeenCalledWith(
        'You have unsaved changes. Are you sure you want to discard them?'
      )
    })

    it('discards changes and resets draft when confirm returns true', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      render(<Settings />)
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

      await selectTheme('Dark')
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

      await clickCancel()

      expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
      expect(addToastMock).toHaveBeenCalledWith('info', 'Settings reverted to last saved state')
    })

    it('keeps changes when confirm returns false (user cancels the navigation)', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      render(<Settings />)
      await selectTheme('Dark')
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

      await clickCancel()

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(addToastMock).not.toHaveBeenCalled()
    })
  })

  describe('prompt-on-close (beforeunload)', () => {
    it('registers a beforeunload handler when there are unsaved changes', async () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener')

      render(<Settings />)
      expect(addListenerSpy.mock.calls.filter(([event]) => event === 'beforeunload')).toHaveLength(
        0
      )

      await selectTheme('Dark')

      const beforeunloadCalls = addListenerSpy.mock.calls.filter(
        ([event]) => event === 'beforeunload'
      )
      expect(beforeunloadCalls).toHaveLength(1)
      expect(beforeunloadCalls[0][0]).toBe('beforeunload')
      expect(typeof beforeunloadCalls[0][1]).toBe('function')
    })

    it('does NOT register a beforeunload handler when there are no unsaved changes', () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener')

      render(<Settings />)

      const beforeunloadCalls = addListenerSpy.mock.calls.filter(
        ([event]) => event === 'beforeunload'
      )
      expect(beforeunloadCalls).toHaveLength(0)
    })

    it('removes the beforeunload handler when changes are discarded via Cancel', async () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener')

      render(<Settings />)

      await selectTheme('Dark')

      const registeredHandlers = addListenerSpy.mock.calls.filter(
        ([event]) => event === 'beforeunload'
      )
      expect(registeredHandlers).toHaveLength(1)
      const handler = registeredHandlers[0][1]

      vi.spyOn(window, 'confirm').mockReturnValue(true)
      await clickCancel()

      const removedCalls = removeListenerSpy.mock.calls.filter(
        ([event]) => event === 'beforeunload'
      )
      expect(removedCalls).toHaveLength(1)
      expect(removedCalls[0][1]).toBe(handler)
    })

    it('removes the beforeunload handler when save happens (isDirty flips to false)', async () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { rerender } = render(<Settings />)
      await selectTheme('Dark')

      const registeredHandlers = addListenerSpy.mock.calls.filter(
        ([event]) => event === 'beforeunload'
      )
      expect(registeredHandlers).toHaveLength(1)
      const handler = registeredHandlers[0][1]

      // Simulate the context values catching up after saveSettings propagates
      // through React state — context now matches the draft.
      setContext({ themeMode: 'dark' })
      rerender(<Settings />)

      const removedCalls = removeListenerSpy.mock.calls.filter(
        ([event]) => event === 'beforeunload'
      )
      expect(removedCalls).toHaveLength(1)
      expect(removedCalls[0][1]).toBe(handler)
    })

    it('re-registers the beforeunload handler after save and re-dirty', async () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener')

      const { rerender } = render(<Settings />)

      // Cycle 1: dirty → register.
      await selectTheme('Dark')
      expect(addListenerSpy.mock.calls.filter(([e]) => e === 'beforeunload')).toHaveLength(1)

      // Cycle 1: save → clean → deregister.
      setContext({ themeMode: 'dark' })
      rerender(<Settings />)
      expect(removeListenerSpy.mock.calls.filter(([e]) => e === 'beforeunload')).toHaveLength(1)

      // Cycle 2: dirty again → re-register.
      // Move context to a third value so isDirty re-computes as true when
      // the user changes the draft below.
      setContext({ themeMode: 'system' })
      rerender(<Settings />)
      await selectTheme('Light')
      expect(addListenerSpy.mock.calls.filter(([e]) => e === 'beforeunload')).toHaveLength(2)
    })

    it('Save button is disabled when there are no unsaved changes', () => {
      render(<Settings />)

      const saveButton = screen.getByRole('button', { name: 'Saved' })
      expect(saveButton).toBeDisabled()
      expect(saveButton).toHaveAttribute('aria-disabled', 'true')
    })

    it('calls preventDefault when beforeunload fires while dirty', async () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener')

      render(<Settings />)
      await selectTheme('Dark')
      await act(async () => {})

      const handler = addListenerSpy.mock.calls.find(([event]) => event === 'beforeunload')?.[1] as
        | ((e: Event) => void)
        | undefined
      expect(handler).toBeDefined()

      const event = new Event('beforeunload', { cancelable: true })
      vi.spyOn(event, 'preventDefault')
      handler!(event)

      expect(event.preventDefault).toHaveBeenCalled()
    })
  })
})

describe('Settings — Address Book', () => {
  const VALID_KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

  beforeEach(() => {
    window.localStorage.clear()
  })

  it('adds, edits, and removes an address book entry', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Stellar address'), { target: { value: VALID_KEY } })
    await user.click(screen.getByRole('button', { name: 'Add address' }))

    expect(screen.getByText('Alice')).toBeInTheDocument()

    // Edit entry
    await user.click(screen.getByRole('button', { name: 'Edit Alice' }))
    const editLabelInput = screen.getByLabelText('Edit label')
    fireEvent.change(editLabelInput, { target: { value: 'Alice Treasury' } })
    await user.click(screen.getByRole('button', { name: 'Save entry' }))

    expect(screen.getByText('Alice Treasury')).toBeInTheDocument()

    // Remove entry
    await user.click(screen.getByRole('button', { name: 'Remove Alice Treasury' }))
    expect(screen.queryByText('Alice Treasury')).toBeNull()
  })

  it('rejects invalid and duplicate addresses with clear messages', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    // Invalid address
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Bad' } })
    fireEvent.change(screen.getByLabelText('Stellar address'), {
      target: { value: 'not-a-valid-key' },
    })
    await user.click(screen.getByRole('button', { name: 'Add address' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid stellar address/i)

    // Add valid address
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Stellar address'), { target: { value: VALID_KEY } })
    await user.click(screen.getByRole('button', { name: 'Add address' }))

    // Duplicate address
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Alice Dup' } })
    fireEvent.change(screen.getByLabelText('Stellar address'), { target: { value: VALID_KEY } })
    await user.click(screen.getByRole('button', { name: 'Add address' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/already in your address book/i)
describe('Settings — network switch confirmation', () => {
  const TEST_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

  const makePendingTx = (overrides: Record<string, unknown> = {}) => ({
    id: 'tx-1',
    type: 'deposit',
    timestamp: new Date().toISOString(),
    status: 'pending',
    hash: 'abc123',
    _network: 'public',
    ...overrides,
  })

  it('skips ConfirmDialog and switches network immediately when no pending transactions exist', async () => {
    mockUseWallet.mockReturnValue({
      address: TEST_ADDRESS,
      isConnected: true,
      connected: true,
      network: 'public',
    })
    mockReadPendingTransactions.mockReturnValue([])

    const user = userEvent.setup()
    render(<Settings />)

    const networkSelect = screen.getByLabelText('Stellar Network') as HTMLSelectElement
    expect(networkSelect.value).toBe('public')

    await user.selectOptions(networkSelect, 'test')

    expect(mockReadPendingTransactions).toHaveBeenCalledWith('public', TEST_ADDRESS)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(networkSelect.value).toBe('test')
  })

  it('skips ConfirmDialog when wallet is disconnected', async () => {
    const user = userEvent.setup()
    render(<Settings />)

    const networkSelect = screen.getByLabelText('Stellar Network') as HTMLSelectElement
    await user.selectOptions(networkSelect, 'test')

    expect(mockReadPendingTransactions).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(networkSelect.value).toBe('test')
  })

  it('skips ConfirmDialog when stored transactions are no longer pending', async () => {
    mockUseWallet.mockReturnValue({
      address: TEST_ADDRESS,
      isConnected: true,
      connected: true,
      network: 'public',
    })
    mockReadPendingTransactions.mockReturnValue([makePendingTx({ status: 'failed' })])
describe('Settings — unlock reminders', () => {
  const originalNotificationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Notification')

  const stubNotification = (
    permission: NotificationPermission,
    requestPermission?: () => Promise<NotificationPermission>
  ) => {
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: { permission, requestPermission: requestPermission ?? vi.fn() },
    })
  }

  afterEach(() => {
    if (originalNotificationDescriptor) {
      Object.defineProperty(globalThis, 'Notification', originalNotificationDescriptor)
    } else {
      // jsdom does not implement Notification; remove the stub we installed.
      delete (globalThis as { Notification?: unknown }).Notification
    }
  })

  it('renders the toggle and, when enabled, the permission status', async () => {
    stubNotification('granted')
    mockUseSettings.mockReturnValue(settingsFixture({ unlockRemindersEnabled: true }))

    render(<Settings />)

    expect(screen.getByRole('switch', { name: 'Enable unlock reminders' })).toBeChecked()
    expect(screen.getByText('Browser notifications are allowed for this site.')).toBeInTheDocument()
  })

  it('explains how to unblock reminders when permission was denied', async () => {
    stubNotification('denied')
    mockUseSettings.mockReturnValue(settingsFixture({ unlockRemindersEnabled: true }))

    render(<Settings />)

    expect(screen.getByText(/notifications are blocked/i)).toBeInTheDocument()
  })

  it('offers a permission request button while permission is undecided', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    stubNotification('default', requestPermission)
    mockUseSettings.mockReturnValue(settingsFixture({ unlockRemindersEnabled: true }))

    const user = userEvent.setup()
    render(<Settings />)

    const networkSelect = screen.getByLabelText('Stellar Network') as HTMLSelectElement
    await user.selectOptions(networkSelect, 'test')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(networkSelect.value).toBe('test')
  })

  it('shows ConfirmDialog when pending transactions exist and keeps old network on Cancel', async () => {
    mockUseWallet.mockReturnValue({
      address: TEST_ADDRESS,
      isConnected: true,
      connected: true,
      network: 'public',
    })
    mockReadPendingTransactions.mockReturnValue([makePendingTx()])

    const user = userEvent.setup()
    render(<Settings />)

    const networkSelect = screen.getByLabelText('Stellar Network') as HTMLSelectElement
    await user.selectOptions(networkSelect, 'test')

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Switch network?')
    expect(dialog).toHaveTextContent(/1 pending transaction/i)
    expect(networkSelect.value).toBe('public')

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
    const dialogCancel = cancelButtons.find((btn) => dialog.contains(btn))!
    await user.click(dialogCancel)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(networkSelect.value).toBe('public')
  })

  it('applies the new network after confirming in ConfirmDialog', async () => {
    mockUseWallet.mockReturnValue({
      address: TEST_ADDRESS,
      isConnected: true,
      connected: true,
      network: 'public',
    })
    mockReadPendingTransactions.mockReturnValue([
      makePendingTx({ id: 'tx-1', hash: 'hash-1' }),
      makePendingTx({ id: 'tx-2', hash: 'hash-2' }),
    ])
    await user.click(screen.getByRole('button', { name: 'Allow browser notifications' }))

    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText('Browser notifications are allowed for this site.')
    ).toBeInTheDocument()
  })

  it('round-trips the setting through backup import', async () => {
    const saveSettings = vi.fn()
    mockUseSettings.mockReturnValue(settingsFixture({ saveSettings }))

    const { container } = render(<Settings />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(
      [JSON.stringify({ themeMode: 'light', unlockRemindersEnabled: true })],
      'credence-settings.json',
      { type: 'application/json' }
    )

    fireEvent.change(fileInput, { target: { files: [file] } })

    // The import dialog is type-to-confirm, so unlock it before applying.
    const phraseInput = await screen.findByPlaceholderText('CONFIRM')
    fireEvent.change(phraseInput, { target: { value: 'CONFIRM' } })
    fireEvent.click(screen.getByText('Apply settings'))

    await waitFor(() => {
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ unlockRemindersEnabled: true })
      )
    })
  })

  it('requests permission when the toggle is turned on from the undecided state', async () => {
    const requestPermission = vi.fn().mockResolvedValue('default')
    stubNotification('default', requestPermission)

    const user = userEvent.setup()
    render(<Settings />)

    const networkSelect = screen.getByLabelText('Stellar Network') as HTMLSelectElement
    await user.selectOptions(networkSelect, 'test')

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(/2 pending transactions/i)

    const confirmInput = screen.getByPlaceholderText('CONFIRM')
    await user.type(confirmInput, 'CONFIRM')

    const confirmButton = screen.getByRole('button', { name: 'Switch network' })
    await user.click(confirmButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(networkSelect.value).toBe('test')
    await user.click(screen.getByRole('switch', { name: 'Enable unlock reminders' }))

    expect(requestPermission).toHaveBeenCalledTimes(1)
  })
})
