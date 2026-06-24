export type ThemeMode = 'light' | 'dark' | 'system'

export interface SettingsBlob {
  themeMode: ThemeMode
  network: string
  addressDisplay: string
  toastsEnabled: boolean
  autoDismiss: string
}

const VALID_THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system']
const VALID_NETWORKS = ['public', 'test'] as const
const VALID_ADDRESS_DISPLAYS = ['full', 'short', 'friendly'] as const
const VALID_AUTO_DISMISS = ['off', '3s', '5s', '8s'] as const

const DEFAULT_SETTINGS: SettingsBlob = {
  themeMode: 'system',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
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

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, data: result }
}
