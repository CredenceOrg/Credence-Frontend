import React, { createContext, useContext, useEffect, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

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

interface StoredSettings {
  themeMode: ThemeMode
  network: string
  addressDisplay: string
  toastsEnabled: boolean
  autoDismiss: string
}

const STORAGE_KEY = 'credence:settings'

const DEFAULTS: StoredSettings = {
  themeMode: 'system',
  network: 'public',
  addressDisplay: 'short',
  toastsEnabled: true,
  autoDismiss: '5s',
}

const defaultState: SettingsState = {
  ...DEFAULTS,
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
  const [storedSettings, persistSettings] = useLocalStorage<StoredSettings>(STORAGE_KEY, DEFAULTS)

  const [themeMode, setThemeMode] = useState<ThemeMode>(storedSettings.themeMode)
  const [network, setNetwork] = useState<string>(storedSettings.network)
  const [addressDisplay, setAddressDisplay] = useState<string>(storedSettings.addressDisplay)
  const [toastsEnabled, setToastsEnabled] = useState<boolean>(storedSettings.toastsEnabled)
  const [autoDismiss, setAutoDismiss] = useState<string>(storedSettings.autoDismiss)

  const [originalSettings, setOriginalSettings] = useState<StoredSettings>(storedSettings)

  const hasUnsavedChanges =
    themeMode !== originalSettings.themeMode ||
    network !== originalSettings.network ||
    addressDisplay !== originalSettings.addressDisplay ||
    toastsEnabled !== originalSettings.toastsEnabled ||
    autoDismiss !== originalSettings.autoDismiss

  useEffect(() => {
    persistSettings({ themeMode, network, addressDisplay, toastsEnabled, autoDismiss })
  }, [themeMode, network, addressDisplay, toastsEnabled, autoDismiss, persistSettings])

  const saveSettings = () => {
    const payload: StoredSettings = { themeMode, network, addressDisplay, toastsEnabled, autoDismiss }
    persistSettings(payload)
    setOriginalSettings(payload)
  }

  const cancelSettings = () => {
    setThemeMode(originalSettings.themeMode)
    setNetwork(originalSettings.network)
    setAddressDisplay(originalSettings.addressDisplay)
    setToastsEnabled(originalSettings.toastsEnabled)
    setAutoDismiss(originalSettings.autoDismiss)
  }

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
