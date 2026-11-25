import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createTypedCustomEvent, SETTINGS_EVENTS } from '../events/schema'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { QUIET_HOURS_DEFAULTS, parseHHmm } from '../lib/quietHours'
import { updateSettings } from '../api/settings'
import {
  clearOutbox,
  flushOutbox,
  getOutboxPendingCount,
  subscribeOutbox,
} from '../lib/offlineOutbox'
import { defaultSettings } from '../lib/settingsSchema'

export type ThemeMode = 'light' | 'dark' | 'system'
import { useLocale } from '../hooks/useLocale'
import { isSupportedLocale, type SupportedLocale } from '../i18n/config'
import { QUIET_HOURS_DEFAULTS, parseHHmm } from '../lib/quietHours'

type ThemeMode = 'light' | 'dark' | 'system'
/** Network option literal union */
export type NetworkOption = 'public' | 'test'
/** Address display option literal union */
export type AddressDisplayOption = 'full' | 'short' | 'friendly'
/** Auto dismiss option literal union */
export type AutoDismissOption = 'off' | '3s' | '5s' | '8s'
/** Re-export so consumers can import from one place. */
export type { SupportedLocale }

/** The persisted settings payload (the subset of state written to localStorage). */
export interface SettingsPayload {
  themeMode: ThemeMode
  network: NetworkOption
  addressDisplay: AddressDisplayOption
  toastsEnabled: boolean
  autoDismiss: AutoDismissOption
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  unlockRemindersEnabled: boolean
  locale: SupportedLocale
}

export interface SettingsState {
  themeMode: ThemeMode
  network: NetworkOption
  addressDisplay: AddressDisplayOption
  toastsEnabled: boolean
  autoDismiss: AutoDismissOption
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  unlockRemindersEnabled: boolean
  locale: SupportedLocale
  setThemeMode: (m: ThemeMode) => void
  setNetwork: (n: NetworkOption) => void
  setAddressDisplay: (s: AddressDisplayOption) => void
  setToastsEnabled: (b: boolean) => void
  setAutoDismiss: (s: AutoDismissOption) => void
  setQuietHoursEnabled: (b: boolean) => void
  setQuietHoursStart: (value: string) => void
  setQuietHoursEnd: (value: string) => void
  setUnlockRemindersEnabled: (b: boolean) => void
  setLocale: (l: SupportedLocale) => Promise<void>
  /** True while a locale bundle is being fetched. */
  isLocaleLoading: boolean
  /**
   * Persist settings. Pass an explicit payload to save immediately (avoids the
   * stale-state race when called right after the individual setters); omit it to
   * persist the current context state.
   */
  saveSettings: (next?: SettingsPayload) => void
  /**
   * Apply and persist only the theme mode (e.g. from the `T` shortcut), leaving any
   * other unsaved edits in the settings form untouched.
   */
  applyThemeMode: (m: ThemeMode) => void
  resetToDefaults: () => void
  cancelSettings: () => void
  hasUnsavedChanges: boolean
  /** True when at least one settings PATCH is queued in the offline outbox. */
  hasPendingOfflineSave: boolean
  /** Number of settings PATCHes currently queued in the offline outbox. */
  pendingOfflineSaveCount: number
  /** Manually attempt to replay queued settings PATCHes (e.g. on reconnect). */
  flushPendingOfflineSaves: () => void
}

type PersistedSettings = {
  themeMode: ThemeMode
  network: NetworkOption
  addressDisplay: AddressDisplayOption
  toastsEnabled: boolean
  autoDismiss: AutoDismissOption
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  unlockRemindersEnabled: boolean
  locale: SupportedLocale
}

const STORAGE_KEY = 'credence:settings'
const LEGACY_THEME_KEY = 'theme'

const VALID_THEMES: ThemeMode[] = ['light', 'dark', 'system']

const schemaDefaults = defaultSettings()

export const DEFAULT_SETTINGS: Readonly<SettingsPayload> = {
  themeMode: schemaDefaults.themeMode,
  network: schemaDefaults.network as NetworkOption,
  addressDisplay: schemaDefaults.addressDisplay as AddressDisplayOption,
  toastsEnabled: schemaDefaults.toastsEnabled,
  autoDismiss: schemaDefaults.autoDismiss as AutoDismissOption,
  quietHoursEnabled: schemaDefaults.quietHoursEnabled,
  quietHoursStart: QUIET_HOURS_DEFAULTS.start,
  quietHoursEnd: QUIET_HOURS_DEFAULTS.end,
  unlockRemindersEnabled: false,
  locale: 'en',
}

const defaultPersistedSettings: PersistedSettings = { ...DEFAULT_SETTINGS }

const defaultState: SettingsState = {
  ...defaultPersistedSettings,
  setThemeMode: () => {},
  setNetwork: () => {},
  setAddressDisplay: () => {},
  setToastsEnabled: () => {},
  setAutoDismiss: () => {},
  setQuietHoursEnabled: () => {},
  setQuietHoursStart: () => {},
  setQuietHoursEnd: () => {},
  setUnlockRemindersEnabled: () => {},
  setLocale: async () => {},
  isLocaleLoading: false,
  saveSettings: (_payload?: SettingsPayload) => {},
  applyThemeMode: (_m: ThemeMode) => {},
  resetToDefaults: () => {},
  cancelSettings: () => {},
  hasUnsavedChanges: false,
  hasPendingOfflineSave: false,
  pendingOfflineSaveCount: 0,
  flushPendingOfflineSaves: () => {},
}

const SettingsContext = createContext<SettingsState>(defaultState)

export function useSettings() {
  return useContext(SettingsContext)
}

/**
 * One-time migration hook: reads the legacy standalone `theme` key (if present), removes
 * it, and — when no `credence:settings` record exists yet — bootstraps that record with
 * the legacy value so that `useLocalStorage` picks it up on the very next read.
 *
 * Uses a `useState` lazy initializer so the migration runs exactly once per mount,
 * synchronously, before `useLocalStorage` reads from storage.
 */
function useMigrateLegacyTheme(): void {
  useState<null>(() => {
    if (typeof window === 'undefined') return null

    const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY)
    if (!legacyTheme) return null

    // Always clean up the orphaned key regardless of whether we use its value.
    localStorage.removeItem(LEGACY_THEME_KEY)

    if (!VALID_THEMES.includes(legacyTheme as ThemeMode)) return null

    // credence:settings already exists — it is the source of truth; legacy key wins nothing.
    if (localStorage.getItem(STORAGE_KEY) !== null) return null

    // Bootstrap credence:settings so useLocalStorage reads the migrated theme.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...defaultPersistedSettings, themeMode: legacyTheme as ThemeMode })
    )

    return null
  })
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Migrate legacy 'theme' key before useLocalStorage reads from storage.
  useMigrateLegacyTheme()

  // Single localStorage read — replaces five individual JSON.parse calls on every mount.
  const [initialReadError, setInitialReadError] = useState<Error | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw !== null) {
        JSON.parse(raw)
      }
      return null
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err))
    }
  })

  const [persistedSettingsRaw, setPersistedSettings, storageMeta] =
    useLocalStorage<PersistedSettings>(STORAGE_KEY, defaultPersistedSettings)

  const lastError = storageMeta.error ?? initialReadError
  const canPersist = lastError === null

  // Validation helpers for persisted values
  const VALID_NETWORKS: NetworkOption[] = ['public', 'test']
  const VALID_ADDRESS_DISPLAYS: AddressDisplayOption[] = ['full', 'short', 'friendly']
  const VALID_AUTO_DISMISSES: AutoDismissOption[] = ['off', '3s', '5s', '8s']

  const coerceThemeMode = (v: string): ThemeMode =>
    (VALID_THEMES.includes(v as ThemeMode) ? v : defaultPersistedSettings.themeMode) as ThemeMode
  const coerceNetwork = (v: string): NetworkOption =>
    (VALID_NETWORKS.includes(v as NetworkOption)
      ? v
      : defaultPersistedSettings.network) as NetworkOption
  const coerceAddressDisplay = (v: string): AddressDisplayOption =>
    (VALID_ADDRESS_DISPLAYS.includes(v as AddressDisplayOption)
      ? v
      : defaultPersistedSettings.addressDisplay) as AddressDisplayOption
  const coerceAutoDismiss = (v: string): AutoDismissOption =>
    (VALID_AUTO_DISMISSES.includes(v as AutoDismissOption)
      ? v
      : defaultPersistedSettings.autoDismiss) as AutoDismissOption
  /**
   * Coerce an `HH:mm` value from storage back to a canonical string. Falls back
   * to the configured default when the persisted value is missing, malformed, or
   * not a string — this is the recovery path for legacy payloads (no quiet hours
   * field) without throwing.
   */
  const coerceHHmm = (v: unknown, fallback: string): string => {
    const parsed = parseHHmm(v)
    return parsed.ok ? `${pad2(parsed.hours)}:${pad2(parsed.minutes)}` : fallback
  }
  const coerceLocale = (v: unknown): SupportedLocale =>
    isSupportedLocale(v) ? v : defaultPersistedSettings.locale

  const hasPersistedSettings = (
    value: Partial<PersistedSettings> | undefined
  ): value is Partial<PersistedSettings> => {
    if (!value || typeof value !== 'object') return false

    const entries = Object.entries(value) as Array<[keyof PersistedSettings, unknown]>
    for (const [key, entryValue] of entries) {
      if (key === 'themeMode' && typeof entryValue === 'string') {
        if (!VALID_THEMES.includes(entryValue as ThemeMode)) return false
      }
      if (key === 'network' && typeof entryValue === 'string') {
        if (!VALID_NETWORKS.includes(entryValue as NetworkOption)) return false
      }
      if (key === 'addressDisplay' && typeof entryValue === 'string') {
        if (!VALID_ADDRESS_DISPLAYS.includes(entryValue as AddressDisplayOption)) return false
      }
      if (key === 'autoDismiss' && typeof entryValue === 'string') {
        if (!VALID_AUTO_DISMISSES.includes(entryValue as AutoDismissOption)) return false
      }
      if (key === 'toastsEnabled' && typeof entryValue !== 'boolean') return false
      if (key === 'quietHoursEnabled' && typeof entryValue !== 'boolean') return false
      if (key === 'quietHoursStart' && typeof entryValue !== 'string') return false
      if (key === 'quietHoursEnd' && typeof entryValue !== 'string') return false
      if (key === 'unlockRemindersEnabled' && typeof entryValue !== 'boolean') return false
    }

    return true
  }

  const safePersistedSettingsRaw = hasPersistedSettings(persistedSettingsRaw)
    ? persistedSettingsRaw
    : defaultPersistedSettings

  const persistedSettings: PersistedSettings = {
    ...safePersistedSettingsRaw,
    themeMode: coerceThemeMode(safePersistedSettingsRaw.themeMode as unknown as string),
    network: coerceNetwork(safePersistedSettingsRaw.network as unknown as string),
    addressDisplay: coerceAddressDisplay(
      safePersistedSettingsRaw.addressDisplay as unknown as string
    ),
    autoDismiss: coerceAutoDismiss(safePersistedSettingsRaw.autoDismiss as unknown as string),
    quietHoursStart: coerceHHmm(
      safePersistedSettingsRaw.quietHoursStart,
      defaultPersistedSettings.quietHoursStart
    ),
    quietHoursEnd: coerceHHmm(
      safePersistedSettingsRaw.quietHoursEnd,
      defaultPersistedSettings.quietHoursEnd
    ),
    locale: coerceLocale(persistedSettingsRaw.locale),
  }

  const [themeMode, setThemeMode] = useState<ThemeMode>(persistedSettings.themeMode)
  const [network, setNetwork] = useState<NetworkOption>(persistedSettings.network)
  const [addressDisplay, setAddressDisplay] = useState<AddressDisplayOption>(
    persistedSettings.addressDisplay
  )
  const [toastsEnabled, setToastsEnabled] = useState<boolean>(persistedSettings.toastsEnabled)
  const [autoDismiss, setAutoDismiss] = useState<AutoDismissOption>(persistedSettings.autoDismiss)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState<boolean>(
    persistedSettings.quietHoursEnabled
  )
  const [quietHoursStart, setQuietHoursStart] = useState<string>(persistedSettings.quietHoursStart)
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>(persistedSettings.quietHoursEnd)
  const [unlockRemindersEnabled, setUnlockRemindersEnabled] = useState<boolean>(
    persistedSettings.unlockRemindersEnabled
  )

  // useLocale owns bundle loading, i18n.changeLanguage(), and its own localStorage key.
  // We initialise it with the coerced persisted value so the two stores stay in sync.
  const { locale, setLocale, isLoading: isLocaleLoading } = useLocale()

  // Tracks the last explicitly saved state; drives unsaved-changes detection and cancel.
  const [originalSettings, setOriginalSettings] = useState<PersistedSettings>(persistedSettings)

  // Offline outbox state: number of queued settings PATCHes awaiting replay.
  const [pendingOfflineSaveCount, setPendingOfflineSaveCount] = useState<number>(() =>
    getOutboxPendingCount()
  )

  // Keep the pending count in sync with the outbox (enqueue, flush, clear).
  useEffect(() => {
    setPendingOfflineSaveCount(getOutboxPendingCount())
    return subscribeOutbox(() => {
      setPendingOfflineSaveCount(getOutboxPendingCount())
    })
  }, [])

  // Replay queued settings PATCHes whenever connectivity returns.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      void flushOutbox()
    }

    window.addEventListener('online', handleOnline)
    // Opportunistically flush on mount in case we came back online while unmounted.
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      void flushOutbox()
    }

    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Drop queued writes belonging to a previous identity epoch (wallet/network change).
  useEffect(() => {
    clearOutbox()
    setPendingOfflineSaveCount(getOutboxPendingCount())
  }, [network])

  const flushPendingOfflineSaves = useCallback(() => {
    void flushOutbox()
  }, [])

  const hasUnsavedChanges =
    themeMode !== originalSettings.themeMode ||
    network !== originalSettings.network ||
    addressDisplay !== originalSettings.addressDisplay ||
    toastsEnabled !== originalSettings.toastsEnabled ||
    autoDismiss !== originalSettings.autoDismiss ||
    quietHoursEnabled !== originalSettings.quietHoursEnabled ||
    quietHoursStart !== originalSettings.quietHoursStart ||
    quietHoursEnd !== originalSettings.quietHoursEnd ||
    unlockRemindersEnabled !== originalSettings.unlockRemindersEnabled

  const saveSettings = (next?: SettingsPayload) => {
    // A caller that just changed state in the same event handler cannot rely on
    // the render closure (React batches updates), so prefer the explicit payload
    // when one is supplied. Omitting it commits the current context state.
    const payload: SettingsPayload = next ?? {
    locale !== originalSettings.locale

  // Auto-persist any draft change immediately so values survive a page reload.
  useEffect(() => {
    setPersistedSettings({
      themeMode,
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      unlockRemindersEnabled,
    }

    setThemeMode(payload.themeMode)
    setNetwork(payload.network)
    setAddressDisplay(payload.addressDisplay)
    setToastsEnabled(payload.toastsEnabled)
    setAutoDismiss(payload.autoDismiss)
    setQuietHoursEnabled(payload.quietHoursEnabled)
    setQuietHoursStart(payload.quietHoursStart)
    setQuietHoursEnd(payload.quietHoursEnd)
    setUnlockRemindersEnabled(payload.unlockRemindersEnabled)
      locale,
    })
  }, [
    themeMode,
    network,
    addressDisplay,
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    locale,
    setPersistedSettings,
  ])

  const saveSettings = () => {
    const payload: PersistedSettings = {
      themeMode,
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      locale,
    }
    setPersistedSettings(payload)
    setInitialReadError(null)
    setOriginalSettings(payload)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(createTypedCustomEvent(SETTINGS_EVENTS.UPDATED, payload))
    }

    // Persist to the backend through the outbox-aware client. Network failures are
    // queued for replay; other failures are surfaced by updateSettings itself.
    void updateSettings(payload).catch(() => {
      // updateSettings already enqueues network failures; swallow here so the
      // local save still succeeds and the indicator reflects the queued state.
    })
  }

  const applyThemeMode = (mode: ThemeMode) => {
    const next: PersistedSettings = { ...persistedSettings, themeMode: mode }
    setThemeMode(mode)
    setPersistedSettings(next)
    setOriginalSettings((prev) => ({ ...prev, themeMode: mode }))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(createTypedCustomEvent(SETTINGS_EVENTS.UPDATED, next))
    }
  }

  const retryPersist = async () => {
    setInitialReadError(null)
    storageMeta.retry()
    const payload: SettingsPayload = {
      themeMode,
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    }
    setPersistedSettings(payload)
    setOriginalSettings(payload)
  }

  const resetToDefaults = () => {
    const defaults = {
      themeMode: defaultPersistedSettings.themeMode,
      network: defaultPersistedSettings.network,
      addressDisplay: defaultPersistedSettings.addressDisplay,
      toastsEnabled: defaultPersistedSettings.toastsEnabled,
      autoDismiss: defaultPersistedSettings.autoDismiss,
      quietHoursEnabled: defaultPersistedSettings.quietHoursEnabled,
      quietHoursStart: defaultPersistedSettings.quietHoursStart,
      quietHoursEnd: defaultPersistedSettings.quietHoursEnd,
      unlockRemindersEnabled: defaultPersistedSettings.unlockRemindersEnabled,
    }

    setThemeMode(defaults.themeMode)
    setNetwork(defaults.network)
    setAddressDisplay(defaults.addressDisplay)
    setToastsEnabled(defaults.toastsEnabled)
    setAutoDismiss(defaults.autoDismiss)
    setQuietHoursEnabled(defaults.quietHoursEnabled)
    setQuietHoursStart(defaults.quietHoursStart)
    setQuietHoursEnd(defaults.quietHoursEnd)
    setUnlockRemindersEnabled(defaults.unlockRemindersEnabled)
    setPersistedSettings(defaults)
    setOriginalSettings(defaults)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(createTypedCustomEvent(SETTINGS_EVENTS.UPDATED, defaults))
    }
    saveSettings({ ...DEFAULT_SETTINGS })
  }

  const cancelSettings = () => {
    setThemeMode(originalSettings.themeMode)
    setNetwork(originalSettings.network)
    setAddressDisplay(originalSettings.addressDisplay)
    setToastsEnabled(originalSettings.toastsEnabled)
    setAutoDismiss(originalSettings.autoDismiss)
    setQuietHoursEnabled(originalSettings.quietHoursEnabled)
    setQuietHoursStart(originalSettings.quietHoursStart)
    setQuietHoursEnd(originalSettings.quietHoursEnd)
    setUnlockRemindersEnabled(originalSettings.unlockRemindersEnabled)
    void setLocale(originalSettings.locale)
  }

  // Apply theme to document and keep it in sync with the system preference.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = window.document.documentElement

    const apply = () => {
      if (themeMode === 'system') {
        let isDark = false
        try {
          if (typeof window.matchMedia === 'function') {
            isDark = window.matchMedia('(prefers-color-scheme: dark)')?.matches === true
          }
        } catch {
          isDark = false
        }
        root.setAttribute('data-theme', isDark ? 'dark' : 'light')
      } else {
        root.setAttribute('data-theme', themeMode)
      }
    }

    apply()

    if (themeMode !== 'system') return

    let mql: MediaQueryList | undefined
    try {
      if (typeof window.matchMedia === 'function') {
        mql = window.matchMedia('(prefers-color-scheme: dark)')
      }
    } catch {
      return
    }
    if (!mql || typeof mql !== 'object') return
    const handler = () => apply()
    try {
      mql.addEventListener?.('change', handler)
    } catch {
      return
    }
    return () => {
      try {
        mql?.removeEventListener?.('change', handler)
      } catch {
        // Ignore cleanup errors on broken MediaQueryList implementations
      }
    }
  }, [themeMode])

  const value: SettingsState = {
    themeMode,
    network,
    addressDisplay,
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    unlockRemindersEnabled,
    locale,
    setThemeMode,
    setNetwork,
    setAddressDisplay,
    setToastsEnabled,
    setAutoDismiss,
    setQuietHoursEnabled,
    setQuietHoursStart,
    setQuietHoursEnd,
    setUnlockRemindersEnabled,
    setLocale,
    isLocaleLoading,
    saveSettings,
    applyThemeMode,
    resetToDefaults,
    cancelSettings,
    hasUnsavedChanges,
    hasPendingOfflineSave: pendingOfflineSaveCount > 0,
    pendingOfflineSaveCount,
    flushPendingOfflineSaves,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function SettingsErrorBoundary({ children }: { children: React.ReactNode }) {
  const { lastError } = useSettings()
  if (lastError) {
    return <div>Settings could not be saved.</div>
  }
  return <>{children}</>
}
