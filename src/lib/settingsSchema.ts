import { QUIET_HOURS_TIME_PATTERN } from '../config/notifications'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface SettingsBlob {
  themeMode: ThemeMode
  network: string
  addressDisplay: string
  toastsEnabled: boolean
  autoDismiss: string
  /** When true, non-critical toasts are silenced during the configured window. */
  quietHoursEnabled: boolean
  /** Inclusive `HH:mm` start of the quiet window. */
  quietHoursStart: string
  /** Inclusive `HH:mm` end of the quiet window. */
  quietHoursEnd: string
}

const VALID_THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']
const VALID_NETWORKS = ['public', 'test'] as const
const VALID_ADDRESS_DISPLAYS = ['full', 'short', 'friendly'] as const
const VALID_AUTO_DISMISS = ['off', '3s', '5s', '8s'] as const
const MIN_REAUTH_THRESHOLD = 1
const MAX_REAUTH_THRESHOLD = 1440

const DEFAULT_SETTINGS: SettingsBlob = {
  themeMode: 'system',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
}

export function defaultSettings(): SettingsBlob {
  return { ...DEFAULT_SETTINGS }
}

interface ValidationSuccess {
  ok: true
  data: SettingsBlob
}

interface ValidationFailure {
  ok: false
  errors: string[]
}

export type ValidationResult = ValidationSuccess | ValidationFailure

export function validateAndNormalize(raw: unknown): ValidationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['Imported value must be a JSON object'] }
  }

  const input = raw as Record<string, unknown>
  const errors: string[] = []
  const result: SettingsBlob = { ...DEFAULT_SETTINGS }

  if (input.themeMode !== undefined) {
    if (VALID_THEME_MODES.includes(input.themeMode as ThemeMode)) {
      result.themeMode = input.themeMode as ThemeMode
    } else {
      errors.push(`themeMode must be one of: ${VALID_THEME_MODES.join(', ')}`)
    }
  }

  if (input.network !== undefined) {
    if (typeof input.network === 'string' && (VALID_NETWORKS as readonly string[]).includes(input.network)) {
      result.network = input.network
    } else {
      errors.push(`network must be one of: ${VALID_NETWORKS.join(', ')}`)
    }
  }

  if (input.addressDisplay !== undefined) {
    if (typeof input.addressDisplay === 'string' && (VALID_ADDRESS_DISPLAYS as readonly string[]).includes(input.addressDisplay)) {
      result.addressDisplay = input.addressDisplay
    } else {
      errors.push(`addressDisplay must be one of: ${VALID_ADDRESS_DISPLAYS.join(', ')}`)
    }
  }

  if (input.toastsEnabled !== undefined) {
    result.toastsEnabled = Boolean(input.toastsEnabled)
  }

  if (input.autoDismiss !== undefined) {
    if (typeof input.autoDismiss === 'string' && (VALID_AUTO_DISMISS as readonly string[]).includes(input.autoDismiss)) {
      result.autoDismiss = input.autoDismiss
    } else {
      errors.push(`autoDismiss must be one of: ${VALID_AUTO_DISMISS.join(', ')}`)
    }
  }

  // Quiet hours fields are OPTIONAL on import so older exports keep working.
  if (input.quietHoursEnabled !== undefined) {
    result.quietHoursEnabled = Boolean(input.quietHoursEnabled)
  }

  if (input.quietHoursStart !== undefined) {
    if (typeof input.quietHoursStart === 'string' && QUIET_HOURS_TIME_PATTERN.test(input.quietHoursStart)) {
      result.quietHoursStart = input.quietHoursStart
    } else {
      errors.push('quietHoursStart must match HH:mm (24-hour)')
    }
  }

  if (input.quietHoursEnd !== undefined) {
    if (typeof input.quietHoursEnd === 'string' && QUIET_HOURS_TIME_PATTERN.test(input.quietHoursEnd)) {
      result.quietHoursEnd = input.quietHoursEnd
    } else {
      errors.push('quietHoursEnd must match HH:mm (24-hour)')
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, data: result }
}
