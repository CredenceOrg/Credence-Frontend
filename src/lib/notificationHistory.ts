import { safeReadJson, safeWriteJson, safeRemoveItem } from './storageJson'
import { TOAST_CONFIG } from '../config/toast'
import type { ToastSeverity } from '../events'

export const NOTIFICATION_HISTORY_SCHEMA_VERSION = 1 as const
export const NOTIFICATION_HISTORY_MAX = TOAST_CONFIG.maxHistory
export const NOTIFICATION_HISTORY_LEGACY_PREFIX = 'credence:notification-history'
export const NOTIFICATION_HISTORY_V1_PREFIX = 'credence:notification-history:v1'
export const GUEST_WALLET_SCOPE = 'guest'

const VALID_SEVERITIES: ReadonlySet<string> = new Set<ToastSeverity>([
  'info',
  'success',
  'warning',
  'danger',
])

export interface NotificationHistoryItem {
  id: string
  type: ToastSeverity
  message: string
  timestamp: number
  read: boolean
  suppressed?: boolean
  txHash?: string
  network?: string
}

export interface NotificationHistoryV1Payload {
  schemaVersion: typeof NOTIFICATION_HISTORY_SCHEMA_VERSION
  items: NotificationHistoryItem[]
  migratedFrom?: 'v0'
  migratedAt?: string
}

export interface AppendNotificationInput {
  id?: string
  type: ToastSeverity
  message: string
  timestamp?: number
  read?: boolean
  suppressed?: boolean
  txHash?: string
  network?: string
}

type Listener = () => void

let activeWalletScope: string | null = null
let fallbackIdCounter = 0
const listeners = new Set<Listener>()

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // Keep notification subscribers isolated from one another.
    }
  })
}

export function normalizeWalletScope(walletAddress?: string | null): string {
  if (typeof walletAddress !== 'string') return GUEST_WALLET_SCOPE
  const trimmed = walletAddress.trim()
  return trimmed.length > 0 ? trimmed.toUpperCase() : GUEST_WALLET_SCOPE
}

export function getNotificationStorageKey(walletAddress?: string | null): string {
  return `${NOTIFICATION_HISTORY_V1_PREFIX}:${normalizeWalletScope(walletAddress)}`
}

export function getNotificationLegacyStorageKey(walletAddress?: string | null): string {
  return `${NOTIFICATION_HISTORY_LEGACY_PREFIX}:${normalizeWalletScope(walletAddress)}`
}

export function setActiveNotificationWallet(walletAddress?: string | null): void {
  const next = typeof walletAddress === 'string' && walletAddress.trim().length > 0
    ? walletAddress.trim().toUpperCase()
    : null
  if (activeWalletScope === next) return
  activeWalletScope = next
  notifyListeners()
}

export function getActiveNotificationWallet(): string | null {
  return activeWalletScope
}

export function subscribeNotificationHistory(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function generateNotificationId(timestamp: number): string {
  fallbackIdCounter += 1
  return `notif-${timestamp}-${fallbackIdCounter}`
}

export function sanitizeNotificationHistory(
  raw: unknown,
  max: number = NOTIFICATION_HISTORY_MAX
): NotificationHistoryItem[] {
  if (!Array.isArray(raw)) return []
  const cap = Number.isFinite(max) && max > 0 ? Math.floor(max) : NOTIFICATION_HISTORY_MAX
  const result: NotificationHistoryItem[] = []

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const candidate = entry as Record<string, unknown>
    const id = typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id
      : null
    const type = typeof candidate.type === 'string' && VALID_SEVERITIES.has(candidate.type)
      ? (candidate.type as ToastSeverity)
      : null
    const message = typeof candidate.message === 'string' && candidate.message.trim().length > 0
      ? candidate.message.trim()
      : null
    const timestamp = typeof candidate.timestamp === 'number' && Number.isFinite(candidate.timestamp)
      ? candidate.timestamp
      : null
    const read = typeof candidate.read === 'boolean' ? candidate.read : false

    if (!id || !type || !message || timestamp === null) continue

    const item: NotificationHistoryItem = {
      id,
      type,
      message,
      timestamp,
      read,
    }
    if (candidate.suppressed === true) {
      item.suppressed = true
    }
    if (typeof candidate.txHash === 'string' && candidate.txHash.trim().length > 0) {
      item.txHash = candidate.txHash
    }
    if (typeof candidate.network === 'string' && candidate.network.trim().length > 0) {
      item.network = candidate.network
    }

    result.push(item)
    if (result.length >= cap) break
  }

  return result
}

function readV1(walletAddress?: string | null): NotificationHistoryItem[] | null {
  const key = getNotificationStorageKey(walletAddress)
  const res = safeReadJson<NotificationHistoryV1Payload>(key)
  if (!res.ok) return []
  if (!res.value) return null
  if (res.value.schemaVersion !== NOTIFICATION_HISTORY_SCHEMA_VERSION) return []
  return sanitizeNotificationHistory(res.value.items)
}

function readLegacy(walletAddress?: string | null): NotificationHistoryItem[] | null {
  const key = getNotificationLegacyStorageKey(walletAddress)
  const res = safeReadJson<unknown>(key)
  if (!res.ok) return []
  if (!res.value) return null
  return sanitizeNotificationHistory(res.value)
}

function writeV1(
  items: NotificationHistoryItem[],
  walletAddress?: string | null,
  migrationMeta?: { migratedFrom: 'v0'; migratedAt: string }
): void {
  const key = getNotificationStorageKey(walletAddress)
  const payload: NotificationHistoryV1Payload = {
    schemaVersion: NOTIFICATION_HISTORY_SCHEMA_VERSION,
    items: sanitizeNotificationHistory(items),
    ...(migrationMeta ?? {}),
  }
  safeWriteJson(key, payload)
}

export function loadNotificationHistory(
  walletAddress: string | null | undefined = activeWalletScope
): NotificationHistoryItem[] {
  const v1 = readV1(walletAddress)
  if (v1 !== null) return v1

  const legacy = readLegacy(walletAddress)
  if (legacy !== null) {
    writeV1(legacy, walletAddress, {
      migratedFrom: 'v0',
      migratedAt: new Date().toISOString(),
    })
    return legacy
  }

  return []
}

export function saveNotificationHistory(
  items: NotificationHistoryItem[],
  walletAddress: string | null | undefined = activeWalletScope
): NotificationHistoryItem[] {
  const sanitized = sanitizeNotificationHistory(items)
  writeV1(sanitized, walletAddress)
  notifyListeners()
  return sanitized
}

export function appendNotification(
  input: AppendNotificationInput,
  walletAddress: string | null | undefined = activeWalletScope
): NotificationHistoryItem[] {
  const message = input.message.trim()
  if (!message) return loadNotificationHistory(walletAddress)

  const timestamp =
    typeof input.timestamp === 'number' && Number.isFinite(input.timestamp)
      ? input.timestamp
      : Date.now()
  const item: NotificationHistoryItem = {
    id: input.id && input.id.trim().length > 0 ? input.id : generateNotificationId(timestamp),
    type: VALID_SEVERITIES.has(input.type) ? input.type : 'info',
    message,
    timestamp,
    read: input.read ?? false,
    ...(input.suppressed ? { suppressed: true } : {}),
    ...(input.txHash ? { txHash: input.txHash } : {}),
    ...(input.network ? { network: input.network } : {}),
  }

  const existing = loadNotificationHistory(walletAddress)
  const next = [item, ...existing].slice(0, NOTIFICATION_HISTORY_MAX)
  writeV1(next, walletAddress)
  notifyListeners()
  return next
}

export function markNotificationRead(
  id: string,
  walletAddress: string | null | undefined = activeWalletScope
): NotificationHistoryItem[] {
  const existing = loadNotificationHistory(walletAddress)
  let changed = false
  const next = existing.map((item) => {
    if (item.id === id && !item.read) {
      changed = true
      return { ...item, read: true }
    }
    return item
  })
  if (changed) {
    writeV1(next, walletAddress)
    notifyListeners()
  }
  return next
}

export function markAllNotificationsRead(
  walletAddress: string | null | undefined = activeWalletScope
): NotificationHistoryItem[] {
  const existing = loadNotificationHistory(walletAddress)
  if (existing.every((item) => item.read)) return existing
  const next = existing.map((item) => (item.read ? item : { ...item, read: true }))
  writeV1(next, walletAddress)
  notifyListeners()
  return next
}

export function clearNotificationHistory(
  walletAddress: string | null | undefined = activeWalletScope
): NotificationHistoryItem[] {
  safeRemoveItem(getNotificationStorageKey(walletAddress))
  safeRemoveItem(getNotificationLegacyStorageKey(walletAddress))
  notifyListeners()
  return []
}

export function getUnreadCount(items: readonly NotificationHistoryItem[]): number {
  let count = 0
  for (const item of items) {
    if (!item.read) count += 1
  }
  return count
}
