import { ONBOARDING_STEP_STORAGE_KEY } from '../config/onboarding'
import { PINNED_WIDGETS_STORAGE_KEY } from '../config/pinnedWidgets'

/**
 * Keys that carry user-specific form state and should be removed on logout.
 * Preferences (theme, settings, onboarding completion) are intentionally preserved.
 */
const FORM_STATE_KEYS: string[] = [
  'credence:recent-lookups',
  ONBOARDING_STEP_STORAGE_KEY,
  'credence:pendingTransactions',
  PINNED_WIDGETS_STORAGE_KEY,
]

/**
 * Clear user-specific form state from localStorage while preserving
 * persistent preferences such as theme and settings.
 *
 * Call this on logout / session expiry to prevent stale form data
 * from leaking across sessions.
 */
export function clearSessionStorage(): void {
  if (typeof window === 'undefined') return
  try {
    for (const key of FORM_STATE_KEYS) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // Storage may be unavailable (private browsing, storage quota, etc.)
  }
}