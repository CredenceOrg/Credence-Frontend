// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  DEFAULT_SETTINGS,
  SettingsProvider,
  useSettings,
  type SettingsPayload,
} from './SettingsContext'
import { SETTINGS_EVENTS } from '../events/schema'

const STORAGE_KEY = 'credence:settings'

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
})

afterEach(() => {
  localStorage.clear()
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

  it('resetToDefaults persists canonical defaults and broadcasts settings:updated', () => {
    const listener = vi.fn()
    const { result } = renderHook(() => useSettings(), { wrapper })

    act(() => {
      result.current.saveSettings({
        themeMode: 'dark',
        network: 'test',
        addressDisplay: 'full',
        toastsEnabled: false,
        autoDismiss: '3s',
        quietHoursEnabled: true,
        quietHoursStart: '23:00',
        quietHoursEnd: '06:00',
      })
    })

    window.addEventListener(SETTINGS_EVENTS.UPDATED, listener)

    act(() => {
      result.current.resetToDefaults()
    })

    window.removeEventListener(SETTINGS_EVENTS.UPDATED, listener)

    expect(readStored()).toEqual(DEFAULT_SETTINGS)
    expect(result.current.themeMode).toBe(DEFAULT_SETTINGS.themeMode)
    expect(result.current.network).toBe(DEFAULT_SETTINGS.network)
    expect(result.current.addressDisplay).toBe(DEFAULT_SETTINGS.addressDisplay)
    expect(result.current.toastsEnabled).toBe(DEFAULT_SETTINGS.toastsEnabled)
    expect(result.current.autoDismiss).toBe(DEFAULT_SETTINGS.autoDismiss)
    expect(result.current.quietHoursEnabled).toBe(DEFAULT_SETTINGS.quietHoursEnabled)
    expect(result.current.quietHoursStart).toBe(DEFAULT_SETTINGS.quietHoursStart)
    expect(result.current.quietHoursEnd).toBe(DEFAULT_SETTINGS.quietHoursEnd)
    expect(result.current.hasUnsavedChanges).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    expect((listener.mock.calls[0][0] as CustomEvent<SettingsPayload>).detail).toEqual(
      DEFAULT_SETTINGS
    )
  })
})
