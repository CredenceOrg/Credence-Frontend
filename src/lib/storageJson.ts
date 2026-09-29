/**
 * Small, SSR-safe localStorage JSON helpers with explicit success/failure results.
 *
 * Motivation:
 * - localStorage can throw (quota exceeded, private browsing, blocked cookies).
 * - callers often want "best effort" persistence without crashing the app.
 * - migrations should be resumable: a write failure should not corrupt or delete legacy data.
 */
import { logWarn } from './log'

export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: Error }
export type StorageWriteResult = { ok: true } | { ok: false; error: Error }

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err))
}

export function safeJsonParse<T>(raw: string): StorageResult<T> {
  try {
    return { ok: true, value: JSON.parse(raw) as T }
  } catch (err) {
    return { ok: false, error: toError(err) }
  }
}

export function safeReadJson<T>(key: string): StorageResult<T | null> {
  if (typeof window === 'undefined') return { ok: true, value: null }
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return { ok: true, value: null }
    return safeJsonParse<T>(raw)
  } catch (err) {
    return { ok: false, error: toError(err) }
  }
}

export function safeWriteJson<T>(key: string, value: T): StorageWriteResult {
  if (typeof window === 'undefined') return { ok: true }
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (err) {
    const error = toError(err)
    logWarn('storage_write_failed', { key, message: error.message })
    return { ok: false, error }
  }
}

export function safeRemoveItem(key: string): StorageWriteResult {
  if (typeof window === 'undefined') return { ok: true }
  try {
    window.localStorage.removeItem(key)
    return { ok: true }
  } catch (err) {
    const error = toError(err)
    logWarn('storage_remove_failed', { key, message: error.message })
    return { ok: false, error }
  }
}
