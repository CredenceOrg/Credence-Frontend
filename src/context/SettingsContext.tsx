import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { validateAndNormalize } from '../lib/settingsSchema'

type ThemeMode = 'light' | 'dark' | 'system'
/** Network option literal union */
export type NetworkOption = 'public' | 'test'
/** Address display option literal union */
export type AddressDisplayOption = 'full' | 'short' | 'friendly'
/** Auto dismiss option literal union */
export type AutoDismissOption = 'off' | '3s' | '5s' | '8s'

/** The persisted settings payload (the subset of state written to localStorage). */
export interface SettingsPayload {
  themeMode: ThemeMode
  network: NetworkOption
  addressDisplay: AddressDisplayOption
  toastsEnabled: boolean
  autoDismiss: AutoDismissOption
}

export interface SettingsState {
  themeMode: ThemeMode
  network: NetworkOption
  addressDisplay: AddressDisplayOption
  toastsEnabled: boolean
  autoDismiss: AutoDismissOption
  setThemeMode: (m: ThemeMode) => void
  setNetwork: (n: NetworkOption) => void
  setAddressDisplay: (s: AddressDisplayOption) => void
  setToastsEnabled: (b: boolean) => void
  setAutoDismiss: (s: AutoDismissOption) => void
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
}

const STORAGE_KEY = 'credence:settings'
const LEGACY_THEME_KEY = 'theme'

const VALID_THEMES: ThemeMode[] = ['light', 'dark', 'system']

export const defaultPersistedSettings: PersistedSettings = {
  themeMode: 'system',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
}

const defaultState: SettingsState = {
  ...defaultPersistedSettings,
  setThemeMode: () => {},
  setNetwork: () => {},
  setAddressDisplay: () => {},
  setToastsEnabled: () => {},
  setAutoDismiss: () => {},
  resetToDefaults: () => {},
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

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Migrate legacy 'theme' key before useLocalStorage reads from storage.
  useMigrateLegacyTheme()

  // Single localStorage read — replaces five individual JSON.parse calls on every mount.
  const [persistedSettingsRaw, setPersistedSettings] = useLocalStorage<PersistedSettings>(
    STORAGE_KEY,
    defaultPersistedSettings,
  )

  const normalizedPersistedSettings = useMemo(() => {
    const normalized = validateAndNormalize(persistedSettingsRaw)
    return normalized.ok ? normalized.data : defaultPersistedSettings
  }, [persistedSettingsRaw])

  const [themeMode, setThemeMode] = useState<ThemeMode>(normalizedPersistedSettings.themeMode as ThemeMode)
  const [network, setNetwork] = useState<NetworkOption>(normalizedPersistedSettings.network as NetworkOption)
  const [addressDisplay, setAddressDisplay] = useState<AddressDisplayOption>(normalizedPersistedSettings.addressDisplay as AddressDisplayOption)
  const [toastsEnabled, setToastsEnabled] = useState<boolean>(normalizedPersistedSettings.toastsEnabled)
  const [autoDismiss, setAutoDismiss] = useState<AutoDismissOption>(normalizedPersistedSettings.autoDismiss as AutoDismissOption)

  // Tracks the last explicitly saved state; drives unsaved-changes detection and cancel.
  const [originalSettings, setOriginalSettings] = useState<PersistedSettings>(normalizedPersistedSettings as PersistedSettings)

  useEffect(() => {
    const isEquivalent =
      persistedSettingsRaw.themeMode === normalizedPersistedSettings.themeMode &&
      persistedSettingsRaw.network === normalizedPersistedSettings.network &&
      persistedSettingsRaw.addressDisplay === normalizedPersistedSettings.addressDisplay &&
      persistedSettingsRaw.toastsEnabled === normalizedPersistedSettings.toastsEnabled &&
      persistedSettingsRaw.autoDismiss === normalizedPersistedSettings.autoDismiss

    if (!isEquivalent) {
      setPersistedSettings(normalizedPersistedSettings as PersistedSettings)
      setOriginalSettings(normalizedPersistedSettings as PersistedSettings)
    }
  }, [normalizedPersistedSettings, persistedSettingsRaw, setPersistedSettings])

  const hasUnsavedChanges =
    themeMode !== originalSettings.themeMode ||
    network !== originalSettings.network ||
    addressDisplay !== originalSettings.addressDisplay ||
    toastsEnabled !== originalSettings.toastsEnabled ||
    autoDismiss !== originalSettings.autoDismiss

  // Auto-persist any draft change immediately so values survive a page reload.
  useEffect(() => {
    setPersistedSettings({ themeMode, network, addressDisplay, toastsEnabled, autoDismiss })
  }, [themeMode, network, addressDisplay, toastsEnabled, autoDismiss, setPersistedSettings])

  const saveSettings = (next?: SettingsPayload) => {
    const payload = next ?? { themeMode, network, addressDisplay, toastsEnabled, autoDismiss }
    setPersistedSettings(payload)
    setOriginalSettings(payload)
  }

  const resetToDefaults = () => {
    const payload = { ...defaultPersistedSettings }
    setThemeMode(payload.themeMode)
    setNetwork(payload.network)
    setAddressDisplay(payload.addressDisplay)
    setToastsEnabled(payload.toastsEnabled)
    setAutoDismiss(payload.autoDismiss)
    saveSettings(payload)
  }

  const cancelSettings = () => {
    setThemeMode(originalSettings.themeMode)
    setNetwork(originalSettings.network)
    setAddressDisplay(originalSettings.addressDisplay)
    setToastsEnabled(originalSettings.toastsEnabled)
    setAutoDismiss(originalSettings.autoDismiss)
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
    setThemeMode,
    setNetwork,
    setAddressDisplay,
    setToastsEnabled,
    setAutoDismiss,
    resetToDefaults,
    saveSettings,
    cancelSettings,
    hasUnsavedChanges,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
