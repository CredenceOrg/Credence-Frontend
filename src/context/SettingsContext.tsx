import React, { createContext, useContext, useEffect, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'system'

interface SettingsState {
  themeMode: ThemeMode
  network: string
  addressDisplay: string
  toastsEnabled: boolean
  autoDismiss: string
  setThemeMode: (m: ThemeMode) => void
  setNetwork: (n: string) => void
  setAddressDisplay: (s: string) => void
  setToastsEnabled: (b: boolean) => void
  setAutoDismiss: (s: string) => void
  saveSettings: () => void
  cancelSettings: () => void
  hasUnsavedChanges: boolean
}

const STORAGE_KEY = 'credence:settings'
const LEGACY_THEME_KEY = 'theme'

const VALID_THEME_MODES = new Set(['light', 'dark', 'system'])

function loadInitialSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : null

    // Read the legacy 'theme' key written by the old ThemeToggle
    const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY)

    // credence:settings wins if it already exists; otherwise promote the legacy value
    const themeMode: ThemeMode =
      ((saved?.themeMode as string | undefined) &&
        VALID_THEME_MODES.has(saved!.themeMode as string)
        ? (saved!.themeMode as ThemeMode)
        : undefined) ??
      (legacyTheme && VALID_THEME_MODES.has(legacyTheme) ? (legacyTheme as ThemeMode) : undefined) ??
      'system'

    // Remove the orphan legacy key — it has been folded in
    try { localStorage.removeItem(LEGACY_THEME_KEY) } catch { /* ignore */ }

    // Persist the migrated value immediately so it becomes the single source of truth
    if (legacyTheme) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          themeMode,
          network: (saved?.network as string) || 'public',
          addressDisplay: (saved?.addressDisplay as string) || 'short',
          toastsEnabled: typeof saved?.toastsEnabled === 'boolean' ? saved.toastsEnabled : true,
          autoDismiss: (saved?.autoDismiss as string) || '5s',
        }))
      } catch { /* ignore */ }
    }

    return {
      themeMode,
      network: (saved?.network as string) || 'public',
      addressDisplay: (saved?.addressDisplay as string) || 'short',
      toastsEnabled: typeof saved?.toastsEnabled === 'boolean' ? saved.toastsEnabled : true,
      autoDismiss: (saved?.autoDismiss as string) || '5s',
    }
  } catch {
    return null
  }
}

const defaultState: SettingsState = {
  themeMode: 'system',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
  setThemeMode: () => {},
  setNetwork: () => {},
  setAddressDisplay: () => {},
  setToastsEnabled: () => {},
  setAutoDismiss: () => {},
  saveSettings: () => {},
  cancelSettings: () => {},
  hasUnsavedChanges: false,
}

const SettingsContext = createContext<SettingsState>(defaultState)

export function useSettings() {
  return useContext(SettingsContext)
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const initial = loadInitialSettings()

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => initial?.themeMode ?? 'system')
  const [network, setNetwork] = useState<string>(() => initial?.network ?? 'public')
  const [addressDisplay, setAddressDisplay] = useState<string>(() => initial?.addressDisplay ?? 'short')
  const [toastsEnabled, setToastsEnabled] = useState<boolean>(() => initial?.toastsEnabled ?? true)
  const [autoDismiss, setAutoDismiss] = useState<string>(() => initial?.autoDismiss ?? '5s')

  // Track the original saved state to detect unsaved changes
  const [originalSettings, setOriginalSettings] = useState(() => ({
    themeMode: initial?.themeMode ?? 'system' as ThemeMode,
    network: initial?.network ?? 'public',
    addressDisplay: initial?.addressDisplay ?? 'short',
    toastsEnabled: initial?.toastsEnabled ?? true,
    autoDismiss: initial?.autoDismiss ?? '5s',
  }))

  // Check if there are unsaved changes
  const hasUnsavedChanges =
    themeMode !== originalSettings.themeMode ||
    network !== originalSettings.network ||
    addressDisplay !== originalSettings.addressDisplay ||
    toastsEnabled !== originalSettings.toastsEnabled ||
    autoDismiss !== originalSettings.autoDismiss

  useEffect(() => {
    try {
      const payload = { themeMode, network, addressDisplay, toastsEnabled, autoDismiss }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
  }, [themeMode, network, addressDisplay, toastsEnabled, autoDismiss])

  // Explicit save function
  const saveSettings = () => {
    try {
      const payload = { themeMode, network, addressDisplay, toastsEnabled, autoDismiss }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      setOriginalSettings({ themeMode, network, addressDisplay, toastsEnabled, autoDismiss })
    } catch {
      // ignore
    }
  }

  // Cancel function - revert to original saved state
  const cancelSettings = () => {
    setThemeMode(originalSettings.themeMode)
    setNetwork(originalSettings.network)
    setAddressDisplay(originalSettings.addressDisplay)
    setToastsEnabled(originalSettings.toastsEnabled)
    setAutoDismiss(originalSettings.autoDismiss)
  }

  // apply theme to document
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
    saveSettings,
    cancelSettings,
    hasUnsavedChanges,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
