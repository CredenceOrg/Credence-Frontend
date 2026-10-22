// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SettingsProvider, useSettings } from '../context/SettingsContext'
import Settings from './Settings'
import { updateSettings } from '../api/settings'

// ── Mocks ───────────────────────────────────────────────────────────
const addToastMock = vi.fn()
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}))

vi.mock('../api/settings', () => ({
  updateSettings: vi.fn(),
}))

const updateSettingsMock = vi.mocked(updateSettings)

const STORAGE_KEY = 'credence:settings'

/** Surfaces the committed context values so the test can prove the page never
 *  touches them before Save. */
function ContextProbe() {
  const { network, toastsEnabled, autoDismiss } = useSettings()
  return (
    <div>
      <span data-testid="ctx-network">{network}</span>
      <span data-testid="ctx-toasts">{String(toastsEnabled)}</span>
      <span data-testid="ctx-auto-dismiss">{autoDismiss}</span>
    </div>
  )
}

function renderSettings() {
  return render(
    <SettingsProvider>
      <Settings />
      <ContextProbe />
    </SettingsProvider>
  )
}

function readStored() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
}

beforeEach(() => {
  localStorage.clear()
  addToastMock.mockReset()
  updateSettingsMock.mockReset()
  updateSettingsMock.mockResolvedValue(undefined)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  localStorage.clear()
})

describe('Settings — single draft model', () => {
  it('Network → Testnet followed by Cancel reverts the draft and reads "Saved"', () => {
    renderSettings()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    fireEvent.change(screen.getByRole('combobox', { name: 'Stellar Network' }), {
      target: { value: 'test' },
    })

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    // The context is untouched while editing the draft.
    expect(screen.getByTestId('ctx-network').textContent).toBe('public')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('ctx-network').textContent).toBe('public')
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
  })

  it('Network → Testnet followed by Save commits to context and localStorage', () => {
    renderSettings()

    fireEvent.change(screen.getByRole('combobox', { name: 'Stellar Network' }), {
      target: { value: 'test' },
    })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByTestId('ctx-network').textContent).toBe('test')
    expect(readStored().network).toBe('test')
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument()
  })

  it('Toasts off followed by Cancel restores the committed value', () => {
    renderSettings()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const toggle = screen.getByRole('switch', { name: 'Enable toasts' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('switch', { name: 'Enable toasts' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByTestId('ctx-toasts').textContent).toBe('true')
  })

  it('Auto-dismiss edits stay in the draft until Save', () => {
    renderSettings()

    fireEvent.change(screen.getByRole('combobox', { name: /Auto-dismiss duration/ }), {
      target: { value: '3s' },
    })

    expect(screen.getByTestId('ctx-auto-dismiss').textContent).toBe('5s')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByTestId('ctx-auto-dismiss').textContent).toBe('3s')
    expect(readStored().autoDismiss).toBe('3s')
  })
})

describe('Settings — server sync is opt-in', () => {
  it('never calls updateSettings while sync is disabled (default)', async () => {
    renderSettings()

    fireEvent.change(screen.getByRole('combobox', { name: 'Stellar Network' }), {
      target: { value: 'test' },
    })
    fireEvent.click(screen.getByRole('switch', { name: 'Enable toasts' }))
    fireEvent.change(screen.getByRole('combobox', { name: /Auto-dismiss duration/ }), {
      target: { value: '3s' },
    })

    await act(async () => {
      vi.advanceTimersByTime(2_000)
    })

    expect(updateSettingsMock).not.toHaveBeenCalled()
  })

  it('skips invalid quiet-hours drafts and PATCHes once on Save when enabled', async () => {
    vi.stubEnv('VITE_SETTINGS_SYNC_ENABLED', 'true')
    renderSettings()

    // Flush the initial committed-settings sync so it does not bleed into the
    // assertions below.
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(updateSettingsMock).toHaveBeenCalledTimes(1)
    updateSettingsMock.mockClear()

    // Invalid draft: the hook is parked, so no PATCH fires.
    fireEvent.change(screen.getByLabelText('Start time (HH:mm)'), {
      target: { value: '2' },
    })
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(updateSettingsMock).not.toHaveBeenCalled()

    // Valid draft + explicit Save: exactly one PATCH with the committed payload.
    fireEvent.change(screen.getByLabelText('Start time (HH:mm)'), {
      target: { value: '23:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })

    expect(updateSettingsMock).toHaveBeenCalledTimes(1)
    expect(updateSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        themeMode: 'system',
        network: 'public',
        addressDisplay: 'short',
        toastsEnabled: true,
        autoDismiss: '5s',
        quietHoursEnabled: false,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
      }),
      expect.any(AbortSignal)
    )
    expect(readStored().quietHoursStart).toBe('23:00')
  })
})
