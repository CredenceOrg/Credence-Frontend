import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSettings } from '../context/SettingsContext'
import ThemeToggle from '../components/ThemeToggle'
import { useToast } from '../components/ToastProvider'
import { FormField } from '../components/forms/FormField'
import Toggle from '../components/controls/Toggle'
import Select from '../components/controls/Select'
import ConfirmDialog from '../components/ConfirmDialog'
import { ErrorState } from '../components/states'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { validateAndNormalize, type SettingsBlob } from '../lib/settingsSchema'
import './Settings.css'

const FIELD_LABELS: Record<string, string> = {
  themeMode: 'Theme',
  network: 'Network',
  addressDisplay: 'Address display',
  toastsEnabled: 'Toasts enabled',
  autoDismiss: 'Auto-dismiss',
}

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
    saveSettings,
  } = useSettings()
  const { addToast } = useToast()

  useDocumentTitle('Settings')

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
    saveSettings()
    addToast('success', 'Settings saved successfully')
  }

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to discard them?'
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
    addToast('info', 'Settings reverted to last saved state')
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
    addToast('success', 'Settings exported successfully')
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
        setImportError('Failed to read file')
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        setImportError('File does not contain valid JSON')
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
      setImportError('Failed to read file')
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
    saveSettings()
    addToast('success', 'Settings imported successfully')
    resetImportState()
  }, [importPreview, setThemeMode, setNetwork, setAddressDisplay, setToastsEnabled, setAutoDismiss, saveSettings, addToast, resetImportState])

  const handleImportCancel = useCallback(() => {
    resetImportState()
    addToast('info', 'Import cancelled')
  }, [resetImportState, addToast])

  const diffs = importPreview ? computeDiff(currentSettings, importPreview) : []

  const confirmDescription = useMemo(() => {
    if (!importPreview) return null

    if (diffs.length === 0) {
      return <p>Imported settings match your current settings. No changes will be made.</p>
    }

    return (
      <div>
        <p>The following settings from <strong>{importFileName || 'file'}</strong> will be applied:</p>
        <table style={{ marginTop: '0.75rem', borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-default)' }}>Setting</th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-default)' }}>Current</th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--border-default)' }}>Imported</th>
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
      <h1 style={{ marginTop: 0 }}>Settings</h1>

      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <p className="form-hint">Controls for theme and visual preferences.</p>

        <FormField id="theme-seg" label="Theme">
          <div role="radiogroup" aria-label="Theme mode" style={{ display: 'flex', gap: '0.5rem' }}>
            <label>
              <input
                type="radio"
                name="theme"
                checked={themeMode === 'light'}
                onChange={() => setThemeMode('light')}
              />{' '}
              Light
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                checked={themeMode === 'dark'}
                onChange={() => setThemeMode('dark')}
              />{' '}
              Dark
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                checked={themeMode === 'system'}
                onChange={() => setThemeMode('system')}
              />{' '}
              System
            </label>
          </div>
        </FormField>

        <FormField id="theme-toggle" label="Quick toggle">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ThemeToggle />
            <span className="form-hint">
              Use the quick toggle to flip light/dark immediately. Theme radio buttons above apply
              on Save.
            </span>
          </div>
        </FormField>
      </section>

      <section className="settings-section" aria-labelledby="network-heading">
        <h2 id="network-heading">Network</h2>
        <p className="form-hint">Choose the Stellar network to interact with.</p>

        <FormField id="network-select" label="Stellar Network">
          <Select
            value={network}
            onChange={setNetwork}
            options={[
              { value: 'public', label: 'Public (Mainnet)' },
              { value: 'test', label: 'Test (Testnet)' },
            ]}
          />
        </FormField>
      </section>

      <section className="settings-section" aria-labelledby="display-heading">
        <h2 id="display-heading">Display</h2>
        <p className="form-hint">How addresses and identifiers are presented in the UI.</p>

        <fieldset style={{ border: 'none', padding: 0 }}>
          <legend className="sr-only">Address display format</legend>
          <FormField id="address-display" label="Address format">
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <label>
                <input
                  type="radio"
                  name="address"
                  checked={addressDisplay === 'full'}
                  onChange={() => setAddressDisplay('full')}
                />{' '}
                Full (G...)
              </label>
              <label>
                <input
                  type="radio"
                  name="address"
                  checked={addressDisplay === 'short'}
                  onChange={() => setAddressDisplay('short')}
                />{' '}
                Short (G...…)
              </label>
              <label>
                <input
                  type="radio"
                  name="address"
                  checked={addressDisplay === 'friendly'}
                  onChange={() => setAddressDisplay('friendly')}
                />{' '}
                Friendly (when available)
              </label>
            </div>
          </FormField>
        </fieldset>
      </section>

      <section className="settings-section" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">Notifications</h2>
        <p className="form-hint">Control toast and notification behavior.</p>

        <FormField id="toasts-enabled" label="Enable toasts">
          <Toggle
            checked={draft.toastsEnabled}
            onChange={(v) => updateDraft('toastsEnabled', v)}
            ariaLabel="Enable toasts"
          />
        </FormField>

        <FormField id="auto-dismiss" label="Auto-dismiss duration">
          <Select
            value={draft.autoDismiss}
            onChange={(v) => updateDraft('autoDismiss', v)}
            options={[
              { value: 'off', label: 'Off (require manual dismiss)' },
              { value: '3s', label: '3 seconds' },
              { value: '5s', label: '5 seconds' },
              { value: '8s', label: '8 seconds' },
            ]}
          />
        </FormField>

        <FormField id="toast-preview" label="Preview">
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => addToast('info', 'This is a preview notification')}
              style={{ padding: '0.5rem 0.75rem' }}
              aria-label="Show preview toast"
            >
              Show preview
            </button>
            <span className="form-hint">Preview respects current toast settings.</span>
          </div>
        </FormField>
      </section>

      <section className="settings-section" aria-labelledby="backup-heading">
        <h2 id="backup-heading">Backup &amp; Restore</h2>
        <p className="form-hint">Export your settings as a JSON file, or import settings from a previous export.</p>

        <div className="settings-backup-row">
          <button
            type="button"
            onClick={handleExport}
            style={{ padding: '0.5rem 0.75rem' }}
            aria-label="Export settings to JSON file"
          >
            Export settings
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
            aria-label="Import settings from JSON file"
          >
            Import settings
          </button>
        </div>

        {importError && (
          <div role="alert" style={{ marginTop: '0.75rem' }}>
            <ErrorState
              type="validation"
              title="Invalid settings file"
              message={importError}
              action={{
                label: 'Clear error',
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
          {isDirty ? 'Save' : 'Saved'}
        </button>
        <button type="button" onClick={handleCancel} style={{ padding: '0.5rem 0.75rem' }}>
          Cancel
        </button>
      </div>

      <ConfirmDialog
        open={importConfirmOpen}
        title="Import Settings"
        subtitle={diffs.length > 0 ? 'Review the changes below before applying.' : undefined}
        description={confirmDescription}
        confirmPhrase="IMPORT"
        confirmHint="This will overwrite your current settings with the imported values."
        confirmLabel="Import settings"
        onConfirm={handleImportConfirm}
        onCancel={handleImportCancel}
      />
    </div>
  )
}
