import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings, defaultPersistedSettings } from '../context/SettingsContext'
import ThemeToggle from '../components/ThemeToggle'
import { useToast } from '../components/ToastProvider'
import { FormField } from '../components/forms/FormField'
import Toggle from '../components/controls/Toggle'
import Select from '../components/controls/Select'
import ConfirmDialog from '../components/ConfirmDialog'
import { ErrorState } from '../components/states'
import { useSeo } from '../hooks/useSeo'
import { validateAndNormalize, type SettingsBlob } from '../lib/settingsSchema'
import './Settings.css'


function computeDiff(current: Omit<SettingsBlob, keyof unknown>, incoming: SettingsBlob): { key: string; from: string; to: string }[] {
  const diffs: { key: string; from: string; to: string }[] = []
  const keys: (keyof SettingsBlob)[] = ['themeMode', 'network', 'addressDisplay', 'toastsEnabled', 'autoDismiss']
  for (const key of keys) {
    if (String(current[key as keyof typeof current]) !== String(incoming[key])) {
      diffs.push({ key, from: String(current[key as keyof typeof current]), to: String(incoming[key]) })
    }
  }
  return diffs
}

export default function Settings() {
  const { t } = useTranslation()
  const {
    themeMode,
    setThemeMode,
    network,
    setNetwork,
    addressDisplay,
    setAddressDisplay,
    toastsEnabled,
    setToastsEnabled,
    autoDismiss,
    setAutoDismiss,
    resetToDefaults,
    saveSettings,
  } = useSettings()
  const { addToast } = useToast()

  useSeo({
    title: 'Settings',
    description: 'Configure your Credence app preferences: theme, network, address display, and toast notifications.',
  })

  const [draft, setDraft] = useState({
    themeMode: themeMode as 'light' | 'dark' | 'system',
    network,
    addressDisplay,
    toastsEnabled,
    autoDismiss,
  })

  const isDirty =
    draft.themeMode !== themeMode ||
    draft.network !== network ||
    draft.addressDisplay !== addressDisplay ||
    draft.toastsEnabled !== toastsEnabled ||
    draft.autoDismiss !== autoDismiss

  const updateDraft = (key: string, value: string | boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = () => {
    if (!isDirty) return
    const payload = {
      themeMode: draft.themeMode,
      network: draft.network,
      addressDisplay: draft.addressDisplay,
      toastsEnabled: draft.toastsEnabled,
      autoDismiss: draft.autoDismiss,
    }
    setThemeMode(payload.themeMode)
    setNetwork(payload.network)
    setAddressDisplay(payload.addressDisplay)
    setToastsEnabled(payload.toastsEnabled)
    setAutoDismiss(payload.autoDismiss)
    saveSettings(payload)
    addToast('success', 'Settings saved successfully')
  }

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        t('settings.actions.cancel')
      )
      if (!confirmed) return
    }
    setDraft({
      themeMode: themeMode as 'light' | 'dark' | 'system',
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
    })
    addToast('info', t('settings.toasts.reverted'))
  }

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const resetTriggerRef = useRef<HTMLButtonElement>(null)
  const [importPreview, setImportPreview] = useState<SettingsBlob | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importConfirmOpen, setImportConfirmOpen] = useState(false)
  const [importFileName, setImportFileName] = useState<string | null>(null)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const resetImportState = useCallback(() => {
    setImportPreview(null)
    setImportError(null)
    setImportConfirmOpen(false)
    setImportFileName(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const currentSettings = useMemo(() => {
    return { themeMode, network, addressDisplay, toastsEnabled, autoDismiss }
  }, [themeMode, network, addressDisplay, toastsEnabled, autoDismiss])

  const handleExport = useCallback(() => {
    const payload: SettingsBlob = {
      themeMode: themeMode as 'light' | 'dark' | 'system',
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
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
  }, [themeMode, network, addressDisplay, toastsEnabled, autoDismiss, addToast])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFileName(file.name)
    setImportError(null)
    setImportPreview(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result
      if (typeof text !== 'string') {
        setImportError(t('settings.backup.invalidFile'))
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        setImportError(t('settings.backup.invalidFile'))
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
      setImportError(t('settings.backup.invalidFile'))
    }
    reader.readAsText(file)
  }, [])

  const handleImportConfirm = useCallback(() => {
    if (!importPreview) return

    setThemeMode(importPreview.themeMode)
    setNetwork(importPreview.network)
    setAddressDisplay(importPreview.addressDisplay)
    setToastsEnabled(importPreview.toastsEnabled)
    setAutoDismiss(importPreview.autoDismiss)
    saveSettings(importPreview)
    addToast('success', 'Settings imported successfully')
    resetImportState()
  }, [importPreview, setThemeMode, setNetwork, setAddressDisplay, setToastsEnabled, setAutoDismiss, saveSettings, addToast, resetImportState])

  const handleImportCancel = useCallback(() => {
    resetImportState()
    addToast('info', t('settings.toasts.importCancelled'))
  }, [resetImportState, addToast])

  const handleResetRequest = useCallback(() => {
    setResetConfirmOpen(true)
  }, [])

  const handleResetConfirm = useCallback(() => {
    const nextDraft = {
      themeMode: defaultPersistedSettings.themeMode as 'light' | 'dark' | 'system',
      network: defaultPersistedSettings.network,
      addressDisplay: defaultPersistedSettings.addressDisplay,
      toastsEnabled: defaultPersistedSettings.toastsEnabled,
      autoDismiss: defaultPersistedSettings.autoDismiss,
    }

    setDraft(nextDraft)
    resetToDefaults()
    setResetConfirmOpen(false)
    addToast('success', 'Settings reset to defaults.')
  }, [resetToDefaults, addToast])

  const handleResetCancel = useCallback(() => {
    setResetConfirmOpen(false)
  }, [])

  const diffs = importPreview ? computeDiff(currentSettings, importPreview) : []

  const confirmDescription = useMemo(() => {
    if (!importPreview) return null

    if (diffs.length === 0) {
      return <p>{t('settings.importDialog.noChanges')}</p>
    }

    return (
      <div>
        <p>{t('settings.importDialog.changesIntro', { file: importFileName || 'file' })}</p>
        <table style={{ marginTop: '0.75rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-default)' }}>{t('settings.importDialog.setting')}</th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-default)' }}>{t('settings.importDialog.current')}</th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-default)' }}>{t('settings.importDialog.imported')}</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d) => (
              <tr key={d.key}>
                <td style={{ padding: '0.25rem 0.5rem' }}>{FIELD_LABELS[d.key] || d.key}</td>
                <td style={{ padding: '0.25rem 0.5rem' }}><code>{d.from}</code></td>
                <td style={{ padding: '0.25rem 0.5rem' }}><code>{d.to}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }, [importPreview, diffs, importFileName])

  return (
    <div className="settings-page">
      <h1 style={{ marginTop: 0 }}>{t('settings.title')}</h1>

      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">{t('settings.appearance.heading')}</h2>
        <p className="form-hint">{t('settings.appearance.description')}</p>

        <FormField id="theme-seg" label={t('settings.appearance.theme')}>
          <div role="radiogroup" aria-label="Theme mode" style={{ display: 'flex', gap: '0.5rem' }}>
            <label>
              <input
                type="radio"
                name="theme"
                checked={themeMode === 'light'}
                onChange={() => setThemeMode('light')}
              />{' '}
              {t('settings.appearance.light')}
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                checked={themeMode === 'dark'}
                onChange={() => setThemeMode('dark')}
              />{' '}
              {t('settings.appearance.dark')}
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                checked={themeMode === 'system'}
                onChange={() => setThemeMode('system')}
              />{' '}
              {t('settings.appearance.system')}
            </label>
          </div>
        </FormField>

        <FormField id="theme-toggle" label={t('settings.appearance.quickToggle')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ThemeToggle />
            <span className="form-hint">
              {t('settings.appearance.quickToggleHint')}
            </span>
          </div>
        </FormField>
      </section>

      <section className="settings-section" aria-labelledby="network-heading">
        <h2 id="network-heading">{t('settings.network.heading')}</h2>
        <p className="form-hint">{t('settings.network.description')}</p>

        <FormField id="network-select" label={t('settings.network.stellarNetwork')}>
          <Select
            value={network}
            onChange={setNetwork}
            options={[
              { value: 'public', label: t('settings.network.public') },
              { value: 'test', label: t('settings.network.test') },
            ]}
          />
        </FormField>
      </section>

      <section className="settings-section" aria-labelledby="display-heading">
        <h2 id="display-heading">{t('settings.display.heading')}</h2>
        <p className="form-hint">{t('settings.display.description')}</p>

        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend className="sr-only">{t('settings.display.addressFormat')}</legend>
          <FormField id="address-display" label={t('settings.display.addressFormat')}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label>
                <input
                  type="radio"
                  name="address"
                  checked={addressDisplay === 'full'}
                  onChange={() => setAddressDisplay('full')}
                />{' '}
                {t('settings.display.full')}
              </label>
              <label>
                <input
                  type="radio"
                  name="address"
                  checked={addressDisplay === 'short'}
                  onChange={() => setAddressDisplay('short')}
                />{' '}
                {t('settings.display.short')}
              </label>
              <label>
                <input
                  type="radio"
                  name="address"
                  checked={addressDisplay === 'friendly'}
                  onChange={() => setAddressDisplay('friendly')}
                />{' '}
                {t('settings.display.friendly')}
              </label>
            </div>
          </FormField>
        </fieldset>
      </section>

      <section className="settings-section" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">{t('settings.notifications.heading')}</h2>
        <p className="form-hint">{t('settings.notifications.description')}</p>

        <FormField id="toasts-enabled" label={t('settings.notifications.enableToasts')}>
          <Toggle
            checked={draft.toastsEnabled}
            onChange={(v) => updateDraft('toastsEnabled', v)}
            ariaLabel={t('settings.notifications.enableToasts')}
          />
        </FormField>

        <FormField id="auto-dismiss" label={t('settings.notifications.autoDismissDuration')}>
          <Select
            value={draft.autoDismiss}
            onChange={(v) => updateDraft('autoDismiss', v)}
            options={[
              { value: 'off', label: t('settings.notifications.off') },
              { value: '3s', label: t('settings.notifications.3seconds') },
              { value: '5s', label: t('settings.notifications.5seconds') },
              { value: '8s', label: t('settings.notifications.8seconds') },
            ]}
          />
        </FormField>

        <FormField id="toast-preview" label={t('settings.notifications.preview')}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => addToast('info', 'This is a preview notification')}
              style={{ padding: '0.5rem 0.75rem' }}
              aria-label={t('settings.notifications.showPreview')}
            >
              {t('settings.notifications.showPreview')}
            </button>
            <span className="form-hint">{t('settings.notifications.previewHint')}</span>
          </div>
        </FormField>
      </section>

      <section className="settings-section" aria-labelledby="backup-heading">
        <h2 id="backup-heading">{t('settings.backup.heading')}</h2>
        <p className="form-hint">{t('settings.backup.description')}</p>

        <div className="settings-backup-row">
          <button
            type="button"
            onClick={handleExport}
            style={{ padding: '0.5rem 0.75rem' }}
            aria-label={t('settings.backup.exportSettings')}
          >
            {t('settings.backup.exportSettings')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '0.5rem 0.75rem' }}
            aria-label={t('settings.backup.importSettings')}
          >
            {t('settings.backup.importSettings')}
          </button>
        </div>

        {importError && (
          <div role="alert" style={{ marginTop: '0.75rem' }}>
            <ErrorState
              type="validation"
              title={t('settings.backup.invalidFile')}
              message={importError}
              action={{
                label: t('settings.backup.clearError'),
                onClick: resetImportState,
              }}
            />
          </div>
        )}
      </section>

      <div className="settings-actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty}
          aria-disabled={!isDirty}
          style={{ padding: '0.5rem 0.75rem' }}
        >
          {isDirty ? t('settings.actions.save') : t('settings.actions.saved')}
        </button>
        <button type="button" onClick={handleCancel} style={{ padding: '0.5rem 0.75rem' }}>
          {t('settings.actions.cancel')}
        </button>
        <button
          ref={resetTriggerRef}
          type="button"
          onClick={handleResetRequest}
          style={{ padding: '0.5rem 0.75rem' }}
          aria-label="Reset settings to defaults"
        >
          Reset to defaults
        </button>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset settings?"
        subtitle="This will restore every setting to the default values."
        description={<p>This action cannot be undone and will overwrite your current preferences.</p>}
        confirmPhrase="RESET"
        confirmLabel="Reset settings"
        confirmHint="Type RESET to confirm restoring the default settings."
        variant="danger"
        onConfirm={handleResetConfirm}
        onCancel={handleResetCancel}
        returnFocusRef={resetTriggerRef}
      />

      <ConfirmDialog
        open={importConfirmOpen}
        title={t('settings.importDialog.title')}
        subtitle={diffs.length > 0 ? t('settings.importDialog.subtitle') : undefined}
        description={confirmDescription}
        confirmPhrase="IMPORT"
        confirmHint={t('settings.importDialog.confirmHint')}
        confirmLabel={t('settings.importDialog.confirmLabel')}
        onConfirm={handleImportConfirm}
        onCancel={handleImportCancel}
      />
    </div>
  )
}
