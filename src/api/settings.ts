import { apiFetch } from './client'
import type { SettingsBlob } from '../lib/settingsSchema'

/** Persist the authenticated user's settings through the typed API boundary. */
export function updateSettings(settings: SettingsBlob, signal?: AbortSignal): Promise<void> {
  return apiFetch<void>('/settings', {
    method: 'PATCH',
    body: settings,
    signal,
  })
}
