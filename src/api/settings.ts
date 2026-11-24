import { apiFetch } from './client'
import type { SettingsBlob } from '../lib/settingsSchema'
import { enqueueSettings } from '../lib/offlineOutbox'

/**
 * Result of a settings update.
 * - `'synced'`: the PATCH succeeded immediately.
 * - `'queued'`: the PATCH failed due to a network/offline error and the body
 *   was persisted to the offline outbox for replay on reconnect.
 */
export type UpdateSettingsResult = 'synced' | 'queued'

function isNetworkError(error: unknown): boolean {
  if (!error) return false
  // AbortError should not be queued; it's a caller-initiated cancellation.
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name
    if (name === 'AbortError') return false
    const status = (error as { status?: unknown }).status
    if (typeof status === 'number') {
      // Any HTTP status means the request reached the server; do not queue.
      return false
    }
  }
  // A fetch rejection (TypeError: Failed to fetch) or offline error.
  return true
}

/**
 * Persist the authenticated user's settings through the typed API boundary.
 *
 * On network failure (offline / fetch rejection) the PATCH body is enqueued
 * into the offline outbox and `'queued'` is returned. Validation errors (4xx)
 * and aborts are re-thrown so callers can surface them.
 */
export async function updateSettings(
  settings: SettingsBlob,
  signal?: AbortSignal,
): Promise<UpdateSettingsResult> {
  try {
    await apiFetch<void>('/settings', {
      method: 'PATCH',
      body: settings as unknown as Record<string, unknown>,
      signal,
    })
    return 'synced'
  } catch (error) {
    if (isNetworkError(error)) {
      enqueueSettings(settings)
      return 'queued'
    }
    throw error
  }
}