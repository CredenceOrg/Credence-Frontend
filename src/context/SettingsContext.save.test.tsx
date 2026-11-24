// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SettingsProvider, useSettings, type SettingsPayload } from './SettingsContext'
import { SETTINGS_EVENTS } from '../events/schema'
import { updateSettings } from '../api/settings'
import { getIdentityEpoch } from '../lib/identityEpoch'
import {
  clearOutbox,
  enqueueSettingsPatch,
  flushOutbox,
  readOutbox,
} from '../lib/offlineOutbox'

vi.mock('../api/settings', () => ({
  updateSettings: vi.fn(),
}))

vi.mock('../lib/identityEpoch', () => ({
  getIdentityEpoch: vi.fn(() => 'epoch-1'),
}))

const STORAGE_KEY = 'credence:settings'
const mockedUpdateSettings = vi.mocked(updateSettings)
const mockedGetIdentityEpoch = vi.mocked(getIdentityEpoch)
=======

const DEFAULTS: SettingsPayload = {
  themeMode: 'system',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

function wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>
}

function readStored(): Partial<SettingsPayload> {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
}

beforeEach(() => {
  localStorage.clear()
  clearOutbox()
  mockedUpdateSettings.mockReset()
  mockedGetIdentityEpoch.mockReturnValue('epoch-1')
})

afterEach(() => {
  localStorage.clear()
  clearOutbox()
  vi.restoreAllMocks()
})

describe('SettingsContext.saveSettings', () => {
  it('persists and broadcasts the explicit payload without any prior setter calls', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    const details: SettingsPayload[] = []
    const listener = (event: Event) => {
      details.push((event as CustomEvent<SettingsPayload>).detail)
    }
    window.addEventListener(SETTINGS_EVENTS.UPDATED, listener)

    act(() => {
      result.current.saveSettings({ ...DEFAULTS, themeMode: 'dark' })
    })

    window.removeEventListener(SETTINGS_EVENTS.UPDATED, listener)

    expect(readStored().themeMode).toBe('dark')
    expect(details).toHaveLength(1)
    expect(details[0]).toEqual({ ...DEFAULTS, themeMode: 'dark' })
    // The explicit payload is also committed to the in-memory state.
    expect(result.current.themeMode).toBe('dark')
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('commits the current context state when no payload is supplied', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    act(() => {
      result.current.setThemeMode('dark')
      result.current.setNetwork('test')
    })

    act(() => {
      result.current.saveSettings()
    })

    expect(readStored().themeMode).toBe('dark')
    expect(readStored().network).toBe('test')
  })

  it('does not write localStorage when setters run without saveSettings', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    act(() => {
      result.current.setThemeMode('dark')
      result.current.setNetwork('test')
      result.current.setToastsEnabled(false)
      result.current.setAutoDismiss('3s')
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    // In-memory state still reflects the pending edits.
    expect(result.current.themeMode).toBe('dark')
    expect(result.current.hasUnsavedChanges).toBe(true)
  })

  it('saveSettings(payload) resets the committed baseline used by cancelSettings', () => {
    const { result } = renderHook(() => useSettings(), { wrapper })

    act(() => {
      result.current.saveSettings({ ...DEFAULTS, network: 'test' })
    })
    expect(result.current.hasUnsavedChanges).toBe(false)

    act(() => {
      result.current.setNetwork('public')
    })
    expect(result.current.hasUnsavedChanges).toBe(true)

    act(() => {
      result.current.cancelSettings()
    })

    expect(result.current.network).toBe('test')
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('broadcasts exactly one settings:updated event per save', () => {
    const listener = vi.fn()
    window.addEventListener(SETTINGS_EVENTS.UPDATED, listener)

    const { result } = renderHook(() => useSettings(), { wrapper })

    act(() => {
      result.current.saveSettings({ ...DEFAULTS, addressDisplay: 'friendly' })
    })

    window.removeEventListener(SETTINGS_EVENTS.UPDATED, listener)

    expect(listener).toHaveBeenCalledTimes(1)
    expect((listener.mock.calls[0][0] as CustomEvent<SettingsPayload>).detail.addressDisplay).toBe(
      'friendly'
    )
  })
})

describe('SettingsContext offline outbox', () => {
  it('persists the patch body in the outbox when updateSettings fails offline', async () => {
    mockedUpdateSettings.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useSettings(), { wrapper })

    await act(async () => {
      await result.current.saveSettings({ ...DEFAULTS, themeMode: 'dark' })
    })

    const entries = readOutbox()
    expect(entries).toHaveLength(1)
    expect(entries[0].epoch).toBe('epoch-1')
    expect(entries[0].body).toEqual({ ...DEFAULTS, themeMode: 'dark' })
    expect(entries[0].attempts).toBe(0)
    // Local state is still committed so the UI reflects the edit.
    expect(result.current.themeMode).toBe('dark')
    expect(readStored().themeMode).toBe('dark')
  })

  it('coalesces repeated offline saves into a single latest entry', async () => {
    mockedUpdateSettings.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useSettings(), { wrapper })

    await act(async () => {
      await result.current.saveSettings({ ...DEFAULTS, themeMode: 'dark' })
    })
    await act(async () => {
      await result.current.saveSettings({ ...DEFAULTS, themeMode: 'light', network: 'test' })
    })

    const entries = readOutbox()
    expect(entries).toHaveLength(1)
    expect(entries[0].body).toEqual({ ...DEFAULTS, themeMode: 'light', network: 'test' })
  })

  it('drops outbox entries queued under a previous identity epoch', async () => {
    mockedUpdateSettings.mockRejectedValue(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useSettings(), { wrapper })

    await act(async () => {
      await result.current.saveSettings({ ...DEFAULTS, themeMode: 'dark' })
    })
    expect(readOutbox()).toHaveLength(1)

    // Simulate a wallet switch: the identity epoch changes.
    mockedGetIdentityEpoch.mockReturnValue('epoch-2')
    mockedUpdateSettings.mockResolvedValue(undefined)

    await act(async () => {
      await flushOutbox()
    })

    expect(readOutbox()).toHaveLength(0)
    expect(mockedUpdateSettings).toHaveBeenCalledTimes(1)
  })

  it('replays queued writes on the online event and clears the outbox', async () => {
    mockedUpdateSettings.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const { result } = renderHook(() => useSettings(), { wrapper })

    await act(async () => {
      await result.current.saveSettings({ ...DEFAULTS, themeMode: 'dark' })
    })
    expect(readOutbox()).toHaveLength(1)

    mockedUpdateSettings.mockResolvedValue(undefined)

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await flushOutbox()
    })

    expect(readOutbox()).toHaveLength(0)
    expect(mockedUpdateSettings).toHaveBeenCalledTimes(2)
    expect(mockedUpdateSettings).toHaveBeenLastCalledWith({ ...DEFAULTS, themeMode: 'dark' })
    expect(readStored().themeMode).toBe('dark')
  })

  it('replays entries in order and stops on a failed attempt', async () => {
    enqueueSettingsPatch({ ...DEFAULTS, themeMode: 'dark' })
    enqueueSettingsPatch({ ...DEFAULTS, themeMode: 'light' })

    mockedUpdateSettings.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await act(async () => {
      await flushOutbox()
    })

    // First entry failed, so the second must not have been attempted yet.
    expect(mockedUpdateSettings).toHaveBeenCalledTimes(1)
    expect(readOutbox()).toHaveLength(2)
    expect(readOutbox()[0].attempts).toBe(1)
  })
})
