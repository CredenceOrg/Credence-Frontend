import React, { createContext, useContext, useEffect, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
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
  locale: SupportedLocale
  setThemeMode: (m: ThemeMode) => void
  setNetwork: (n: NetworkOption) => void
  setAddressDisplay: (s: AddressDisplayOption) => void
  setToastsEnabled: (b: boolean) => void
  setAutoDismiss: (s: AutoDismissOption) => void
  setQuietHoursEnabled: (b: boolean) => void
  setQuietHoursStart: (value: string) => void
  setQuietHoursEnd: (value: string) => void
  setLocale: (l: SupportedLocale) => Promise<void>
  /** True while a locale bundle is being fetched. */
  isLocaleLoading: boolean
  /**
   * Persist settings. Pass an explicit payload to save immediately (avoids the
   * stale-state race when called right after the individual setters); omit it to
   * persist the current context state.
   */
  saveSettings: (next?: SettingsPayload) => void
  cancelSettings: () => void
  hasUnsavedChanges: boolean
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
  locale: SupportedLocale
}

const STORAGE_KEY = 'credence:settings'
const LEGACY_THEME_KEY = 'theme'

const VALID_THEMES: ThemeMode[] = ['light', 'dark', 'system']

const defaultPersistedSettings: PersistedSettings = {
  themeMode: 'system',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
  quietHoursEnabled: false,
  quietHoursStart: QUIET_HOURS_DEFAULTS.start,
  quietHoursEnd: QUIET_HOURS_DEFAULTS.end,
  locale: 'en',
}

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
  setLocale: async () => {},
  isLocaleLoading: false,
  saveSettings: (_payload?: SettingsPayload) => {},
  cancelSettings: () => {},
  hasUnsavedChanges: false,
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
      JSON.stringify({ ...defaultPersistedSettings, themeMode: legacyTheme as ThemeMode }),
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
  const [persistedSettingsRaw, setPersistedSettings] = useLocalStorage<PersistedSettings>(
    STORAGE_KEY,
    defaultPersistedSettings,
  )

  // Validation helpers for persisted values
  const VALID_NETWORKS: NetworkOption[] = ['public', 'test']
  const VALID_ADDRESS_DISPLAYS: AddressDisplayOption[] = ['full', 'short', 'friendly']
  const VALID_AUTO_DISMISSES: AutoDismissOption[] = ['off', '3s', '5s', '8s']

  const coerceNetwork = (v: string): NetworkOption =>
    (VALID_NETWORKS.includes(v as NetworkOption) ? v : defaultPersistedSettings.network) as NetworkOption
  const coerceAddressDisplay = (v: string): AddressDisplayOption =>
    (VALID_ADDRESS_DISPLAYS.includes(v as AddressDisplayOption) ? v : defaultPersistedSettings.addressDisplay) as AddressDisplayOption
  const coerceAutoDismiss = (v: string): AutoDismissOption =>
    (VALID_AUTO_DISMISSES.includes(v as AutoDismissOption) ? v : defaultPersistedSettings.autoDismiss) as AutoDismissOption
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

  const persistedSettings: PersistedSettings = {
    ...persistedSettingsRaw,
    network: coerceNetwork(persistedSettingsRaw.network as unknown as string),
    addressDisplay: coerceAddressDisplay(persistedSettingsRaw.addressDisplay as unknown as string),
    autoDismiss: coerceAutoDismiss(persistedSettingsRaw.autoDismiss as unknown as string),
    quietHoursStart: coerceHHmm(
      persistedSettingsRaw.quietHoursStart,
      defaultPersistedSettings.quietHoursStart,
    ),
    quietHoursEnd: coerceHHmm(
      persistedSettingsRaw.quietHoursEnd,
      defaultPersistedSettings.quietHoursEnd,
    ),
    locale: coerceLocale(persistedSettingsRaw.locale),
  }

  const [themeMode, setThemeMode] = useState<ThemeMode>(persistedSettings.themeMode)
  const [network, setNetwork] = useState<NetworkOption>(persistedSettings.network)
  const [addressDisplay, setAddressDisplay] = useState<AddressDisplayOption>(persistedSettings.addressDisplay)
  const [toastsEnabled, setToastsEnabled] = useState<boolean>(persistedSettings.toastsEnabled)
  const [autoDismiss, setAutoDismiss] = useState<AutoDismissOption>(persistedSettings.autoDismiss)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState<boolean>(
    persistedSettings.quietHoursEnabled,
  )
  const [quietHoursStart, setQuietHoursStart] = useState<string>(persistedSettings.quietHoursStart)
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>(persistedSettings.quietHoursEnd)

  // useLocale owns bundle loading, i18n.changeLanguage(), and its own localStorage key.
  // We initialise it with the coerced persisted value so the two stores stay in sync.
  const { locale, setLocale, isLoading: isLocaleLoading } = useLocale()

  // Tracks the last explicitly saved state; drives unsaved-changes detection and cancel.
  const [originalSettings, setOriginalSettings] = useState<PersistedSettings>(persistedSettings)

  const hasUnsavedChanges =
    themeMode !== originalSettings.themeMode ||
    network !== originalSettings.network ||
    addressDisplay !== originalSettings.addressDisplay ||
    toastsEnabled !== originalSettings.toastsEnabled ||
    autoDismiss !== originalSettings.autoDismiss ||
    quietHoursEnabled !== originalSettings.quietHoursEnabled ||
    quietHoursStart !== originalSettings.quietHoursStart ||
    quietHoursEnd !== originalSettings.quietHoursEnd ||
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
    setOriginalSettings(payload)
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
    void setLocale(originalSettings.locale)
  }

  // Apply theme to document and keep it in sync with the system preference.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = window.document.documentElement

    const apply = () => {
      if (themeMode === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.setAttribute('data-theme', isDark ? 'dark' : 'light')
      } else {
        root.setAttribute('data-theme', themeMode)
      }
    }

    apply()

    if (themeMode !== 'system') return

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => apply()
    mql.addEventListener?.('change', handler)
    return () => mql.removeEventListener?.('change', handler)
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
    locale,
    setThemeMode,
    setNetwork,
    setAddressDisplay,
    setToastsEnabled,
    setAutoDismiss,
    setQuietHoursEnabled,
    setQuietHoursStart,
    setQuietHoursEnd,
    setLocale,
    isLocaleLoading,
    saveSettings,
    cancelSettings,
    hasUnsavedChanges,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
