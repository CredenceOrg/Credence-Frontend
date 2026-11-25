import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../components/ToastProvider'
import { validateAndNormalize, type SettingsBlob } from '../lib/settingsSchema'
import type {
  AddressDisplayOption,
  AutoDismissOption,
  NetworkOption,
  SettingsPayload,
} from '../context/SettingsContext'

export interface SettingsDiff {
  key: string
  from: string
  to: string
}

export function computeSettingsDiff(
  current: SettingsPayload,
  incoming: SettingsBlob
): SettingsDiff[] {
  const diffs: SettingsDiff[] = []
  const keys: (keyof SettingsBlob)[] = [
    'themeMode',
    'network',
    'addressDisplay',
    'toastsEnabled',
    'autoDismiss',
    'quietHoursEnabled',
    'quietHoursStart',
    'quietHoursEnd',
  ]
  for (const key of keys) {
    if (String(current[key]) !== String(incoming[key])) {
      diffs.push({ key, from: String(current[key]), to: String(incoming[key]) })
    }
  }
  return diffs
}

export interface UseSettingsBackupOptions {
  currentSettings: SettingsPayload
  onImportConfirm: (payload: SettingsPayload) => void
}

export function useSettingsBackup({
  currentSettings,
  onImportConfirm,
}: UseSettingsBackupOptions) {
  const { t } = useTranslation()
  const { addToast } = useToast()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<SettingsBlob | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [importFileName, setImportFileName] = useState<string | null>(null)

  const resetImportState = useCallback(() => {
    setImportPreview(null)
    setImportError(null)
    setImportConfirmOpen(false)
    setImportFileName(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleExport = useCallback(() => {
    const payload: SettingsBlob = {
      themeMode: currentSettings.themeMode,
      network: currentSettings.network,
      addressDisplay: currentSettings.addressDisplay,
      toastsEnabled: currentSettings.toastsEnabled,
      autoDismiss: currentSettings.autoDismiss,
      quietHoursEnabled: currentSettings.quietHoursEnabled,
      quietHoursStart: currentSettings.quietHoursStart,
      quietHoursEnd: currentSettings.quietHoursEnd,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'credence-settings.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    addToast('success', t('settings.toasts.exported'))
  }, [currentSettings, addToast, t])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setImportFileName(file.name)
      setImportError(null)
      setImportPreview(null)

      const reader = new FileReader()
      reader.onload = (evt) => {
        const text = evt.target?.result
        if (typeof text !== 'string') {
          setImportError(t('settings.backup.fileReadError'))
          return
        }

        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          setImportError(t('settings.backup.invalidJson'))
          return
        }

        const result = validateAndNormalize(parsed)
        if (!result.ok) {
          setImportError(result.errors.join('; '))
          return
        }

        setImportPreview(result.data)
        setImportConfirmOpen(true)
      }
      reader.onerror = () => {
        setImportError(t('settings.backup.fileReadError'))
      }
      reader.readAsText(file)
    },
    [t]
  )

  const handleImportConfirm = useCallback(() => {
    if (!importPreview) return

    const payload: SettingsPayload = {
      themeMode: importPreview.themeMode,
      network: importPreview.network as NetworkOption,
      addressDisplay: importPreview.addressDisplay as AddressDisplayOption,
      toastsEnabled: importPreview.toastsEnabled,
      autoDismiss: importPreview.autoDismiss as AutoDismissOption,
      quietHoursEnabled: importPreview.quietHoursEnabled ?? false,
      quietHoursStart: importPreview.quietHoursStart ?? '22:00',
      quietHoursEnd: importPreview.quietHoursEnd ?? '07:00',
    }

    onImportConfirm(payload)
    addToast('success', t('settings.toasts.imported'))
    resetImportState()
  }, [importPreview, onImportConfirm, addToast, resetImportState, t])

  const handleImportCancel = useCallback(() => {
    resetImportState()
    addToast('info', t('settings.toasts.importCancelled'))
  }, [resetImportState, addToast, t])

  const diffs = importPreview ? computeSettingsDiff(currentSettings, importPreview) : []

  return {
    fileInputRef,
    importPreview,
    importError,
    importConfirmOpen,
    importFileName,
    diffs,
    resetImportState,
    handleExport,
    handleFileChange,
    handleImportConfirm,
    handleImportCancel,
  }
}
