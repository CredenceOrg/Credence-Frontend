// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from './Settings'

// ── Mocks ───────────────────────────────────────────────────────────
const mockUseSettings = vi.fn()
vi.mock('../context/SettingsContext', () => ({
  DEFAULT_SETTINGS: {
    themeMode: 'system',
    network: 'public',
    addressDisplay: 'short',
    toastsEnabled: true,
    autoDismiss: '5s',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
  useSettings: () => mockUseSettings(),
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
    saveSettings: vi.fn(),
    resetToDefaults: vi.fn(),
    cancelSettings: vi.fn(),
    hasUnsavedChanges: false,
    ...overrides,
  }
}

beforeEach(() => {
  mockUseSettings.mockReturnValue(settingsFixture())
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

describe('Settings — reset to defaults', () => {
  const CUSTOM_SETTINGS = {
    themeMode: 'dark' as const,
    network: 'test' as const,
    addressDisplay: 'full' as const,
    toastsEnabled: false,
    autoDismiss: '3s' as const,
    quietHoursEnabled: true,
    quietHoursStart: '23:00',
    quietHoursEnd: '06:00',
  }

  it('opens ConfirmDialog and resets all fields on confirm', async () => {
    const user = userEvent.setup()
    const resetToDefaults = vi.fn()
    setContext({ ...CUSTOM_SETTINGS, resetToDefaults })

    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()

    const confirmInput = screen.getByPlaceholderText('CONFIRM')
    await user.type(confirmInput, 'CONFIRM')

    const confirmButtons = screen.getAllByRole('button', { name: 'Reset to defaults' })
    const dialogConfirmButton = confirmButtons[confirmButtons.length - 1]
    await user.click(dialogConfirmButton)

    expect(resetToDefaults).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(screen.getByLabelText('Stellar Network')).toHaveValue('public')
    expect(screen.getByRole('radio', { name: 'Short (G……)' })).toBeChecked()
    expect(screen.getByLabelText('Auto-dismiss duration')).toHaveValue('5s')
    expect(screen.getByLabelText('Start time (HH:mm)')).toHaveValue('22:00')
    expect(screen.getByLabelText('End time (HH:mm)')).toHaveValue('07:00')
    expect(addToastMock).toHaveBeenCalledWith('success', 'Settings reset to defaults')
  })

  it('changes nothing when reset is cancelled', async () => {
    const user = userEvent.setup()
    const resetToDefaults = vi.fn()
    setContext({ ...CUSTOM_SETTINGS, resetToDefaults })

    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
    const dialogCancelButton = cancelButtons[cancelButtons.length - 1]
    await user.click(dialogCancelButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(resetToDefaults).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(screen.getByLabelText('Stellar Network')).toHaveValue('test')
    expect(screen.getByLabelText('Start time (HH:mm)')).toHaveValue('23:00')
    expect(addToastMock).not.toHaveBeenCalled()
  })

  it('keeps previous values and shows rollback toast when reset fails', async () => {
    const user = userEvent.setup()
    const resetToDefaults = vi.fn(() => {
      throw new Error('Storage quota exceeded')
    })
    setContext({ ...CUSTOM_SETTINGS, resetToDefaults })

    render(<Settings />)

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))

    const confirmInput = screen.getByPlaceholderText('CONFIRM')
    await user.type(confirmInput, 'CONFIRM')

    const confirmButtons = screen.getAllByRole('button', { name: 'Reset to defaults' })
    const dialogConfirmButton = confirmButtons[confirmButtons.length - 1]
    await user.click(dialogConfirmButton)

    expect(resetToDefaults).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(screen.getByLabelText('Stellar Network')).toHaveValue('test')
    expect(screen.getByLabelText('Start time (HH:mm)')).toHaveValue('23:00')
    expect(addToastMock).toHaveBeenCalledWith(
      'danger',
      'Failed to reset settings. Previous values were kept.'
    )
  })
})
