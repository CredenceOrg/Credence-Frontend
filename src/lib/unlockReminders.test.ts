// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DEFAULT_REMINDER_LEAD_MS,
  NOTIFIED_REMINDERS_STORAGE_KEY,
  computeNextReminder,
  formatUnlockDate,
  getNotificationPermission,
  loadNotifiedReminders,
  nextReminderAt,
  reminderKey,
  requestNotificationPermission,
  saveNotifiedReminders,
  selectDueReminders,
} from './unlockReminders'

const HOUR = 60 * 60 * 1000

/** Local-time constructor so quiet-hours maths never depends on the test TZ. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 0, day, hour, minute, 0, 0)

const QUIET_22_07 = { enabled: true, start: '22:00', end: '07:00' }

describe('reminderKey', () => {
  it('is stable for the same bond and lead time', () => {
    expect(reminderKey('bond-1')).toBe(reminderKey('bond-1'))
  })

  it('distinguishes bonds and thresholds', () => {
    expect(reminderKey('bond-1')).not.toBe(reminderKey('bond-2'))
    expect(reminderKey('bond-1', DEFAULT_REMINDER_LEAD_MS)).not.toBe(
      reminderKey('bond-1', 2 * DEFAULT_REMINDER_LEAD_MS)
    )
  })
})

describe('computeNextReminder', () => {
  it('schedules one lead time before the unlock', () => {
    const now = at(10, 9)
    const unlock = at(11, 12)

    const reminder = computeNextReminder({ id: 'bond-1', maturesAt: unlock.toISOString() }, { now })

    expect(reminder).not.toBeNull()
    expect(reminder!.unlockAt).toBe(unlock.getTime())
    expect(reminder!.dueAt).toBe(unlock.getTime() - DEFAULT_REMINDER_LEAD_MS)
    expect(reminder!.deliverAt).toBe(reminder!.dueAt)
  })

  it('honours a custom lead time', () => {
    const now = at(10, 9)
    const unlock = at(10, 18)

    const reminder = computeNextReminder(
      { id: 'bond-1', maturesAt: unlock.toISOString() },
      { now, leadMs: 2 * HOUR }
    )

    expect(reminder!.dueAt).toBe(unlock.getTime() - 2 * HOUR)
  })

  it('returns null when the unlock date is missing or invalid', () => {
    const now = at(10, 9)

    expect(computeNextReminder({ id: 'a' }, { now })).toBeNull()
    expect(computeNextReminder({ id: 'a', maturesAt: null }, { now })).toBeNull()
    expect(computeNextReminder({ id: 'a', maturesAt: 'not-a-date' }, { now })).toBeNull()
  })

  it('returns null once the bond has unlocked', () => {
    const now = at(10, 12)

    expect(computeNextReminder({ id: 'a', maturesAt: now.toISOString() }, { now })).toBeNull()
    expect(computeNextReminder({ id: 'a', maturesAt: at(9, 12).toISOString() }, { now })).toBeNull()
  })

  it('delivers immediately when already inside the lead window', () => {
    const now = at(10, 9)
    const unlock = at(10, 15) // due 15:00 the previous day

    const reminder = computeNextReminder({ id: 'bond-1', maturesAt: unlock.toISOString() }, { now })

    expect(reminder!.dueAt).toBeLessThan(now.getTime())
    expect(reminder!.deliverAt).toBe(now.getTime())
  })

  it('defers delivery to the end of quiet hours', () => {
    const now = at(10, 23) // inside 22:00–07:00
    const unlock = at(11, 20)

    const reminder = computeNextReminder(
      { id: 'bond-1', maturesAt: unlock.toISOString() },
      { now, quietHours: QUIET_22_07 }
    )

    expect(reminder!.deliverAt).toBe(at(11, 7).getTime())
  })

  it('defers to the same day when the window ends later that day', () => {
    const now = at(10, 13) // inside a 13:00–15:00 window
    const unlock = at(10, 20)

    const reminder = computeNextReminder(
      { id: 'bond-1', maturesAt: unlock.toISOString() },
      { now, quietHours: { enabled: true, start: '13:00', end: '15:00' } }
    )

    expect(reminder!.deliverAt).toBe(at(10, 15).getTime())
  })

  it('does not defer when the window is disabled or inactive', () => {
    const now = at(10, 9)
    const unlock = at(12, 18) // reminder due well outside quiet hours

    const disabled = computeNextReminder(
      { id: 'bond-1', maturesAt: unlock.toISOString() },
      { now, quietHours: { ...QUIET_22_07, enabled: false } }
    )
    const inactive = computeNextReminder(
      { id: 'bond-1', maturesAt: unlock.toISOString() },
      { now, quietHours: QUIET_22_07 }
    )

    expect(disabled!.deliverAt).toBe(disabled!.dueAt)
    expect(inactive!.deliverAt).toBe(inactive!.dueAt)
  })
})

describe('selectDueReminders', () => {
  const now = at(10, 12)
  const dueBond = { id: 'due', maturesAt: at(11, 6).toISOString() } // due at 06:00 today
  const futureBond = { id: 'future', maturesAt: at(12, 12).toISOString() }

  it('returns only reminders that are due and not yet delivered', () => {
    const due = selectDueReminders([dueBond, futureBond], { now })

    expect(due.map((r) => r.bondId)).toEqual(['due'])
  })

  it('skips bonds whose key was already notified', () => {
    const notified = new Set([reminderKey('due')])

    expect(selectDueReminders([dueBond, futureBond], { now, notified })).toEqual([])
  })

  it('sorts multiple due reminders most overdue first', () => {
    const earlier = { id: 'earlier', maturesAt: at(11, 3).toISOString() }
    const later = { id: 'later', maturesAt: at(11, 5).toISOString() }

    const due = selectDueReminders([later, earlier], { now })

    expect(due.map((r) => r.bondId)).toEqual(['earlier', 'later'])
  })

  it('does not deliver reminders that quiet hours deferred into the future', () => {
    const quietNow = at(10, 23)
    const bond = { id: 'quiet', maturesAt: at(11, 20).toISOString() }

    expect(selectDueReminders([bond], { now: quietNow, quietHours: QUIET_22_07 })).toEqual([])
  })

  it('delivers a suppressed reminder once quiet hours have ended', () => {
    const bond = { id: 'quiet', maturesAt: at(11, 20).toISOString() }

    const due = selectDueReminders([bond], { now: at(11, 7, 1), quietHours: QUIET_22_07 })

    expect(due.map((r) => r.bondId)).toEqual(['quiet'])
  })
})

describe('nextReminderAt', () => {
  it('returns the earliest future delivery time', () => {
    const now = at(10, 9)
    const soon = { id: 'soon', maturesAt: at(11, 10).toISOString() }
    const later = { id: 'later', maturesAt: at(12, 10).toISOString() }

    // `soon` unlocks at 10:00 tomorrow, so its reminder is due at 10:00 today.
    expect(nextReminderAt([later, soon], { now })).toBe(at(10, 10).getTime())
  })

  it('returns null when every bond has already unlocked', () => {
    const now = at(10, 9)

    expect(nextReminderAt([{ id: 'past', maturesAt: at(9, 9).toISOString() }], { now })).toBeNull()
  })
})

describe('formatUnlockDate', () => {
  it('renders a readable date', () => {
    expect(formatUnlockDate(at(11, 12).getTime(), 'en-US')).toBe('Jan 11, 2026')
  })
})

describe('notified reminder persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('round-trips delivered keys', () => {
    saveNotifiedReminders(['a', 'b'])

    expect(loadNotifiedReminders()).toEqual(['a', 'b'])
    expect(localStorage.getItem(NOTIFIED_REMINDERS_STORAGE_KEY)).toBe('["a","b"]')
  })

  it('de-duplicates on save', () => {
    saveNotifiedReminders(['a', 'a', 'b'])

    expect(loadNotifiedReminders()).toEqual(['a', 'b'])
  })

  it('degrades to an empty list for corrupt storage', () => {
    localStorage.setItem(NOTIFIED_REMINDERS_STORAGE_KEY, '{not json')
    expect(loadNotifiedReminders()).toEqual([])

    localStorage.setItem(NOTIFIED_REMINDERS_STORAGE_KEY, '{"a":1}')
    expect(loadNotifiedReminders()).toEqual([])

    localStorage.setItem(NOTIFIED_REMINDERS_STORAGE_KEY, '["a",2,null]')
    expect(loadNotifiedReminders()).toEqual(['a'])
  })

  it('returns an empty list when nothing was stored', () => {
    expect(loadNotifiedReminders()).toEqual([])
  })
})

describe('notification permission helpers', () => {
  const originalNotification = (globalThis as { Notification?: unknown }).Notification

  afterEach(() => {
    if (originalNotification === undefined) {
      delete (globalThis as { Notification?: unknown }).Notification
    } else {
      ;(globalThis as { Notification?: unknown }).Notification = originalNotification
    }
    vi.restoreAllMocks()
  })

  it('reports unsupported when the API is missing', async () => {
    delete (globalThis as { Notification?: unknown }).Notification

    expect(getNotificationPermission()).toBe('unsupported')
    await expect(requestNotificationPermission()).resolves.toBe('unsupported')
  })

  it('reads the current permission', () => {
    ;(globalThis as { Notification?: unknown }).Notification = { permission: 'denied' }

    expect(getNotificationPermission()).toBe('denied')
  })

  it('returns the result of a permission request', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    ;(globalThis as { Notification?: unknown }).Notification = {
      permission: 'default',
      requestPermission,
    }

    await expect(requestNotificationPermission()).resolves.toBe('granted')
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('falls back to the current permission when the request throws', async () => {
    ;(globalThis as { Notification?: unknown }).Notification = {
      permission: 'default',
      requestPermission: vi.fn().mockRejectedValue(new Error('blocked')),
    }

    await expect(requestNotificationPermission()).resolves.toBe('default')
  })
})
