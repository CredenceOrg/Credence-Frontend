import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NOTIFICATION_HISTORY_MAX,
  NOTIFICATION_HISTORY_SCHEMA_VERSION,
  appendNotification,
  clearNotificationHistory,
  getNotificationLegacyStorageKey,
  getNotificationStorageKey,
  getUnreadCount,
  loadNotificationHistory,
  markAllNotificationsRead,
  markNotificationRead,
  setActiveNotificationWallet,
  subscribeNotificationHistory,
} from './notificationHistory'

const WALLET_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
const WALLET_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

describe('notificationHistory', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setActiveNotificationWallet(null)
  })

  it('persists notifications in versioned storage and survives reload', () => {
    appendNotification({ type: 'success', message: 'Bond created', timestamp: 1000 }, WALLET_A)
    appendNotification(
      { type: 'info', message: 'Quiet update', timestamp: 2000, suppressed: true },
      WALLET_A
    )

    const raw = window.localStorage.getItem(getNotificationStorageKey(WALLET_A))
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.schemaVersion).toBe(NOTIFICATION_HISTORY_SCHEMA_VERSION)
    expect(parsed.items).toHaveLength(2)

    const reloaded = loadNotificationHistory(WALLET_A)
    expect(reloaded).toHaveLength(2)
    expect(reloaded[0].message).toBe('Quiet update')
    expect(reloaded[0].suppressed).toBe(true)
    expect(reloaded[1].message).toBe('Bond created')
  })

  it('migrates legacy v0 array storage to v1 on load', () => {
    const legacyKey = getNotificationLegacyStorageKey(WALLET_A)
    window.localStorage.setItem(
      legacyKey,
      JSON.stringify([
        { id: 'old-1', type: 'warning', message: 'Legacy alert', timestamp: 500, read: false },
      ])
    )

    const items = loadNotificationHistory(WALLET_A)
    expect(items).toHaveLength(1)
    expect(items[0].message).toBe('Legacy alert')

    const v1Raw = window.localStorage.getItem(getNotificationStorageKey(WALLET_A))
    expect(v1Raw).not.toBeNull()
    const v1 = JSON.parse(v1Raw!)
    expect(v1.schemaVersion).toBe(1)
    expect(v1.migratedFrom).toBe('v0')
    expect(v1.items).toHaveLength(1)
  })

  it('enforces the 50-item cap keeping newest notifications', () => {
    for (let i = 1; i <= NOTIFICATION_HISTORY_MAX + 15; i += 1) {
      appendNotification({ type: 'info', message: `Message ${i}`, timestamp: i * 1000 }, WALLET_A)
    }

    const items = loadNotificationHistory(WALLET_A)
    expect(items).toHaveLength(NOTIFICATION_HISTORY_MAX)
    expect(items[0].message).toBe(`Message ${NOTIFICATION_HISTORY_MAX + 15}`)
    expect(items[items.length - 1].message).toBe('Message 16')
  })

  it('isolates history per wallet and guest scope', () => {
    appendNotification({ type: 'info', message: 'Wallet A msg', timestamp: 1000 }, WALLET_A)
    appendNotification({ type: 'danger', message: 'Wallet B msg', timestamp: 2000 }, WALLET_B)
    appendNotification({ type: 'success', message: 'Guest msg', timestamp: 3000 }, null)

    expect(loadNotificationHistory(WALLET_A).map((i) => i.message)).toEqual(['Wallet A msg'])
    expect(loadNotificationHistory(WALLET_B).map((i) => i.message)).toEqual(['Wallet B msg'])
    expect(loadNotificationHistory(null).map((i) => i.message)).toEqual(['Guest msg'])
  })

  it('tracks unread count, marks individual and all read, and clears history', () => {
    appendNotification({ id: 'n1', type: 'info', message: 'First', timestamp: 1000 }, WALLET_A)
    appendNotification({ id: 'n2', type: 'warning', message: 'Second', timestamp: 2000 }, WALLET_A)
    appendNotification({ id: 'n3', type: 'success', message: 'Third', timestamp: 3000 }, WALLET_A)

    expect(getUnreadCount(loadNotificationHistory(WALLET_A))).toBe(3)

    const afterOne = markNotificationRead('n2', WALLET_A)
    expect(getUnreadCount(afterOne)).toBe(2)

    const afterAll = markAllNotificationsRead(WALLET_A)
    expect(getUnreadCount(afterAll)).toBe(0)

    const afterClear = clearNotificationHistory(WALLET_A)
    expect(afterClear).toEqual([])
    expect(loadNotificationHistory(WALLET_A)).toEqual([])
  })

  it('notifies subscribers on mutations and handles corrupt storage safely', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeNotificationHistory(listener)

    appendNotification({ type: 'info', message: 'Hello', timestamp: 1000 }, WALLET_A)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    appendNotification({ type: 'info', message: 'World', timestamp: 2000 }, WALLET_A)
    expect(listener).toHaveBeenCalledTimes(1)

    window.localStorage.setItem(getNotificationStorageKey(WALLET_B), '{corrupt json')
    expect(loadNotificationHistory(WALLET_B)).toEqual([])
  })
})
