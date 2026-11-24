// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useUnlockReminders } from './useUnlockReminders'
import { NOTIFIED_REMINDERS_STORAGE_KEY } from '../lib/unlockReminders'

const state = vi.hoisted(() => ({
  bonds: [] as Array<{ id: string; maturesAt?: string }>,
  settings: {
    unlockRemindersEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
}))

vi.mock('./useBonds', () => ({
  useBonds: () => ({ data: state.bonds, isLoading: false, error: null, refetch: vi.fn() }),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ ...state.settings }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${String(options.date)}` : key,
  }),
}))

const notifications: Array<{ title: string; options: NotificationOptions }> = []

class NotificationMock {
  static permission: NotificationPermission = 'granted'
  static requestPermission = vi.fn()

  constructor(title: string, options: NotificationOptions = {}) {
    notifications.push({ title, options })
  }
}

const originalNotification = Object.getOwnPropertyDescriptor(globalThis, 'Notification')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0))
  localStorage.clear()
  notifications.length = 0
  NotificationMock.permission = 'granted'
  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    writable: true,
    value: NotificationMock,
  })
  state.bonds = []
  state.settings = {
    unlockRemindersEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  }
})

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  if (originalNotification) {
    Object.defineProperty(globalThis, 'Notification', originalNotification)
  } else {
    delete (globalThis as { Notification?: unknown }).Notification
  }
})

const bondUnlockingIn = (id: string, hours: number) => ({
  id,
  maturesAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
})

describe('useUnlockReminders', () => {
  it('does nothing while the setting is off', () => {
    state.settings.unlockRemindersEnabled = false
    state.bonds = [bondUnlockingIn('bond-1', 2)]

    renderHook(() => useUnlockReminders())

    expect(notifications).toHaveLength(0)
  })

  it('does nothing when the user has not granted notification permission', () => {
    NotificationMock.permission = 'denied'
    state.bonds = [bondUnlockingIn('bond-1', 2)]

    renderHook(() => useUnlockReminders())

    expect(notifications).toHaveLength(0)
  })

  it('notifies once for a bond inside its reminder window', () => {
    state.bonds = [bondUnlockingIn('bond-1', 2)]

    renderHook(() => useUnlockReminders())

    expect(notifications).toHaveLength(1)
    expect(notifications[0]!.title).toBe('notifications.unlockReminder.title')
    expect(notifications[0]!.options.tag).toMatch(/^bond-1@/)
    const stored = JSON.parse(localStorage.getItem(NOTIFIED_REMINDERS_STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
  })

  it('never repeats a notification for the same bond', () => {
    state.bonds = [bondUnlockingIn('bond-1', 2)]

    const { rerender } = renderHook(() => useUnlockReminders())
    rerender()

    vi.advanceTimersByTime(5 * 60 * 1000)

    expect(notifications).toHaveLength(1)
  })

  it('leaves bonds whose unlock is further away than the lead time alone', () => {
    state.bonds = [bondUnlockingIn('bond-later', 72)]

    renderHook(() => useUnlockReminders())

    expect(notifications).toHaveLength(0)
  })

  it('holds reminders until quiet hours end', () => {
    vi.setSystemTime(new Date(2026, 0, 10, 23, 0, 0))
    state.settings.quietHoursEnabled = true
    state.bonds = [bondUnlockingIn('bond-1', 21)] // unlocks at 20:00 tomorrow

    renderHook(() => useUnlockReminders())
    expect(notifications).toHaveLength(0)

    // Move past the 07:00 end of the window; the next poll delivers.
    vi.setSystemTime(new Date(2026, 0, 11, 7, 1, 0))
    vi.advanceTimersByTime(60 * 1000)

    expect(notifications).toHaveLength(1)
  })

  it('does not record a reminder that the Notification API refused', () => {
    state.bonds = [bondUnlockingIn('bond-1', 2)]

    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: class {
        static permission: NotificationPermission = 'granted'
        constructor() {
          throw new Error('blocked')
        }
      },
    })

    renderHook(() => useUnlockReminders())

    expect(localStorage.getItem(NOTIFIED_REMINDERS_STORAGE_KEY)).toBeNull()
  })
})
