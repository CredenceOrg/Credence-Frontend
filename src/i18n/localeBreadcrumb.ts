/**
 * Pure helper that owns the `previousLng` state for the languageChanged
 * breadcrumb log. Lives outside `src/i18n/config.ts` so unit tests can
 * exercise it without spinning up the i18next instance.
 */

import { logInfo } from '../lib/log'

let previousLng: string | null = null

export const setPreviousLng = (lng: string | null): void => {
  previousLng = lng
}

export const getPreviousLng = (): string | null => previousLng

export interface LanguageChangedFields {
  reason?: string
  namespace?: string
}

export const handleLanguageChanged = (lng: string, fields: LanguageChangedFields = {}): void => {
  const from = previousLng ?? 'none'
  logInfo('language_changed', {
    from,
    to: lng,
    ...(fields.reason ? { reason: fields.reason } : {}),
    ...(fields.namespace ? { namespace: fields.namespace } : {}),
  })
  previousLng = lng
}
