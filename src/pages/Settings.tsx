import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../components/ToastProvider'
import { FormField } from '../components/forms/FormField'
import Toggle from '../components/controls/Toggle'
import Select from '../components/controls/Select'
import SegmentedControl from '../components/controls/SegmentedControl'
import ConfirmDialog from '../components/ConfirmDialog'
import { ErrorState } from '../components/states'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { validateAndNormalize, type SettingsBlob } from '../lib/settingsSchema'
import { isQuietHoursActive, parseHHmm } from '../lib/quietHours'
import { useDebouncedAutoSave } from '../hooks/useDebouncedAutoSave'
import { AutoSaveIndicator, type AutoSaveIndicatorLabels } from '../components/indicators'
import { apiFetch } from '../api/client'
import { AUTO_SAVE_DEFAULTS } from '../config/autoSave'
import { DOM_EVENTS } from '../config/domEvents'
import type { AutoDismissOption } from '../context/SettingsContext'
import './Settings.css'

function computeDiff(
  current: Omit<SettingsBlob, keyof unknown>,
  incoming: SettingsBlob
): { key: string; from: string; to: string }[] {
  const diffs: { key: string; from: string; to: string }[] = []
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

// Friendly labels for the diff table so users see "Quiet hours" instead of
// "quietHoursEnabled" when reviewing an import preview.
const FIELD_LABELS: Record<string, string> = {
  themeMode: 'Theme mode',
  network: 'Network',
  addressDisplay: 'Address display',
  toastsEnabled: 'Enable toasts',
  autoDismiss: 'Auto-dismiss',
  quietHoursEnabled: 'Quiet hours enabled',
  quietHoursStart: 'Quiet hours start',
  quietHoursEnd: 'Quiet hours end',
}

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const ADDRESS_OPTIONS: { value: 'full' | 'short' | 'friendly'; label: string }[] = [
  { value: 'full', label: 'Full (G…)' },
  { value: 'short', label: 'Short (G……)' },
  { value: 'friendly', label: 'Friendly' },
]

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
    quietHoursEnabled,
    setQuietHoursEnabled,
    quietHoursStart,
    setQuietHoursStart,
    quietHoursEnd,
    setQuietHoursEnd,
    saveSettings,
  } = useSettings()
  const { addToast } = useToast()

  useDocumentTitle('Settings')

  // Settings draft mirrors the persisted state at mount and is what the user
  // edits locally before pressing Save. The dirty detection below intentionally
  // compares draft against the live context values so the Save button reflects
  // the user's actual changes. Save / Cancel / Reset / Import paths each feed
  // the draft explicitly, so the page does not auto-resync on every context
  // change -- clicking ThemeToggle (or any other incidental context mutation)
  // must not silently discard pending edits.
  const [draft, setDraft] = useState(() => ({
    themeMode: themeMode as 'light' | 'dark' | 'system',
    network,
    addressDisplay,
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
  }))

  const isDirty =
    draft.themeMode !== themeMode ||
    draft.network !== network ||
    draft.addressDisplay !== addressDisplay ||
    draft.toastsEnabled !== toastsEnabled ||
    draft.autoDismiss !== autoDismiss ||
    draft.quietHoursEnabled !== quietHoursEnabled ||
    draft.quietHoursStart !== quietHoursStart ||
    draft.quietHoursEnd !== quietHoursEnd

  const updateDraft = (key: string, value: string | boolean | number) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  // Validate quiet hours draft: start and end must be valid HH:mm and must
  // differ. The provider falls back to defaults for invalid values, but we
  // surface the error inline so the user can correct bad input.
  const quietHoursError = useMemo(() => {
    if (parseHHmm(draft.quietHoursStart).ok === false) {
      return 'Start and end times must be in HH:mm format (e.g. 22:00, 07:30).'
    }
    if (parseHHmm(draft.quietHoursEnd).ok === false) {
      return 'Start and end times must be in HH:mm format (e.g. 22:00, 07:30).'
    }
    if (draft.quietHoursStart === draft.quietHoursEnd) {
      return 'Start and end times must differ.'
    }
    return undefined
  }, [draft.quietHoursStart, draft.quietHoursEnd])

  // Live indicator of whether the configured window would silence toasts at this
  // moment. Recomputed on every render so the user sees the impact immediately.
  const quietHoursCurrentlyActive = useMemo(() => {
    if (!draft.quietHoursEnabled) return false
    if (quietHoursError) return false
    return isQuietHoursActive({
      enabled: true,
      start: draft.quietHoursStart,
      end: draft.quietHoursEnd,
    })
  }, [draft.quietHoursEnabled, draft.quietHoursStart, draft.quietHoursEnd, quietHoursError])

  // Field-by-field equality. Memoized so reference stability keeps the auto-save
  // hook's internal effect from re-firing on every parent render.
  const draftIsEqual = useCallback(
    (a: typeof draft, b: typeof draft) =>
      a.themeMode === b.themeMode &&
      a.network === b.network &&
      a.addressDisplay === b.addressDisplay &&
      a.toastsEnabled === b.toastsEnabled &&
      a.autoDismiss === b.autoDismiss &&
      a.quietHoursEnabled === b.quietHoursEnabled &&
      a.quietHoursStart === b.quietHoursStart &&
      a.quietHoursEnd === b.quietHoursEnd,
    []
  )

  // Debounced auto-save: every field change triggers a PATCH against the
  // backend after AUTO_SAVE_DEFAULTS.DEBOUNCE_MS of stability. The hook
  // owns the AbortController lifecycle and supersedes in-flight saves per
  // change. This flow is *additive* — the existing manual `Save` button
  // still commits to `localStorage` via `SettingsContext` so it is also
  // available offline.
  const autoSave = useDebouncedAutoSave({
    value: draft,
    save: (next, signal) => apiFetch<void>('/settings', { method: 'PATCH', body: next, signal }),
    delayMs: AUTO_SAVE_DEFAULTS.DEBOUNCE_MS,
    isEqual: draftIsEqual,
  })

  const autoSaveLabels = useMemo<AutoSaveIndicatorLabels>(
    () => ({
      saving: 'Saving…',
      saved: 'Saved',
      savedRelative: (relative: string) => `Saved ${relative}`,
      error: "Couldn't save. Try again.",
      retry: 'Retry',
    }),
    []
  )

  const handleRetry = useCallback(() => {
    void autoSave.saveNow()
  }, [autoSave])

  const handleSave = () => {
    if (!isDirty) return
    if (quietHoursError) return
    const payload = {
      themeMode: draft.themeMode,
      network: draft.network,
      addressDisplay: draft.addressDisplay,
      toastsEnabled: draft.toastsEnabled,
      autoDismiss: draft.autoDismiss,
      quietHoursEnabled: draft.quietHoursEnabled,
      quietHoursStart: draft.quietHoursStart,
      quietHoursEnd: draft.quietHoursEnd,
    }
    setThemeMode(payload.themeMode)
    setNetwork(payload.network)
    setAddressDisplay(payload.addressDisplay)
    setToastsEnabled(payload.toastsEnabled)
    setAutoDismiss(payload.autoDismiss)
    setQuietHoursEnabled(draft.quietHoursEnabled)
    setQuietHoursStart(draft.quietHoursStart)
    setQuietHoursEnd(draft.quietHoursEnd)
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
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    })
    addToast('info', 'Settings reverted to last saved state')
  }

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener(DOM_EVENTS.BEFORE_UNLOAD, handler)
    return () => window.removeEventListener(DOM_EVENTS.BEFORE_UNLOAD, handler)
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
    return {
      themeMode,
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    }
  }, [
    themeMode,
    network,
    addressDisplay,
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
  ])

  const handleExport = useCallback(() => {
    const payload: SettingsBlob = {
      themeMode: themeMode as 'light' | 'dark' | 'system',
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
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
  }, [
    themeMode,
    network,
    addressDisplay,
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    addToast,
  ])

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
    setNetwork(importPreview.network as 'public' | 'test')
    setAddressDisplay(importPreview.addressDisplay as 'full' | 'short' | 'friendly')
    setToastsEnabled(importPreview.toastsEnabled)
    setAutoDismiss(importPreview.autoDismiss as AutoDismissOption)
    setQuietHoursEnabled(importPreview.quietHoursEnabled ?? false)
    setQuietHoursStart(importPreview.quietHoursStart ?? '22:00')
    setQuietHoursEnd(importPreview.quietHoursEnd ?? '07:00')
    saveSettings()
    addToast('success', 'Settings imported successfully')
    resetImportState()
  }, [
    importPreview,
    setThemeMode,
    setNetwork,
    setAddressDisplay,
    setToastsEnabled,
    setAutoDismiss,
    setQuietHoursEnabled,
    setQuietHoursStart,
    setQuietHoursEnd,
    saveSettings,
    addToast,
    resetImportState,
  ])

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
        <p>
          The following settings from <strong>{importFileName || 'file'}</strong> will be applied:
        </p>
        <table className="settings-diff-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Current</th>
              <th>Imported</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d) => (
              <tr key={d.key}>
                <td>{FIELD_LABELS[d.key] || d.key}</td>
                <td>
                  <code>{d.from}</code>
                </td>
                <td>
                  <code>{d.to}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }, [importPreview, diffs, importFileName])

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {/* ── Appearance ──────────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <p className="settings-section__description">Controls for theme and visual preferences.</p>

        {/*
         * fieldset + legend groups the three radio-style theme options so that
         * screen readers announce "Theme mode: Light / Dark / System" as a
         * single navigable group, satisfying WCAG 1.3.1 (Info & Relationships).
         * The SegmentedControl renders role="radiogroup" internally, so the
         * outer fieldset provides the additional native form landmark and the
         * legend provides the visible/AT-readable caption.
         */}
        <fieldset className="settings-fieldset">
          <legend className="settings-fieldset__legend">Theme mode</legend>
          <SegmentedControl
            id="theme-mode"
            ariaLabel="Theme mode"
            value={draft.themeMode}
            onChange={(v) => updateDraft('themeMode', v)}
            options={THEME_OPTIONS}
          />
          <p className="settings-field-hint">
            <em>System</em> follows your OS preference automatically.
          </p>
        </fieldset>
      </section>

      {/* ── Network ─────────────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="network-heading">
        <h2 id="network-heading">Network</h2>
        <p className="settings-section__description">
          Choose the Stellar network to interact with.
        </p>

        <FormField
          id="network-select"
          label="Stellar Network"
          hint="Changing to Testnet uses isolated, non-real assets."
        >
          <Select
            value={draft.network}
            onChange={(v) => updateDraft('network', v)}
            options={[
              { value: 'public', label: 'Public (Mainnet)' },
              { value: 'test', label: 'Test (Testnet)' },
            ]}
          />
        </FormField>
      </section>

      {/* ── Display ─────────────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="display-heading">
        <h2 id="display-heading">Display</h2>
        <p className="settings-section__description">
          How addresses and identifiers are presented in the UI.
        </p>

        {/*
         * fieldset + legend provides a native grouping landmark for the three
         * address-format options. The SegmentedControl renders role="radiogroup"
         * internally; the outer fieldset ensures the group is announced even in
         * browsing mode (not just forms mode) for screen readers that do not
         * expose ARIA radiogroup in browsing mode.
         */}
        <fieldset className="settings-fieldset">
          <legend className="settings-fieldset__legend">Address format</legend>
          <SegmentedControl
            id="address-display"
            ariaLabel="Address display format"
            value={draft.addressDisplay}
            onChange={(v) => updateDraft('addressDisplay', v)}
            options={ADDRESS_OPTIONS}
          />
          <p className="settings-field-hint">
            <em>Friendly</em> shows a registered name when available, otherwise falls back to{' '}
            <em>Short</em>.
          </p>
        </fieldset>
      </section>

      {/* ── Notifications ───────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">Notifications</h2>
        <p className="settings-section__description">
          Control toast and notification behavior.
        </p>

        <FormField id="toasts-enabled" label="Enable toasts">
          <Toggle
            checked={draft.toastsEnabled}
            onChange={(v) => updateDraft('toastsEnabled', v)}
            ariaLabel="Enable toasts"
          />
        </FormField>

        <FormField
          id="auto-dismiss"
          label="Auto-dismiss duration"
          hint="How long before a toast automatically closes. Danger toasts always require manual dismissal."
        >
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

        <div className="settings-preview-row">
          <button
            type="button"
            className="settings-btn settings-btn--secondary"
            onClick={() => addToast('info', 'This is a preview notification')}
            aria-label="Show preview toast notification"
          >
            Show preview
          </button>
          <span className="settings-field-hint">Preview respects current toast settings.</span>
        </div>

        {/* Quiet Hours sub-section */}
        <fieldset className="settings-fieldset settings-fieldset--card" aria-describedby="quiet-hours-desc">
          <legend className="settings-fieldset__legend settings-fieldset__legend--card">
            Quiet Hours
          </legend>
          <p id="quiet-hours-desc" className="settings-section__description">
            When enabled, non-critical toasts will be suppressed during the configured window.
            Critical (danger) toasts always surface regardless.
          </p>

          <FormField id="quiet-hours-enabled" label="Enable quiet hours">
            <Toggle
              checked={draft.quietHoursEnabled}
              onChange={(v) => updateDraft('quietHoursEnabled', v)}
              ariaLabel="Enable quiet hours"
            />
          </FormField>

          <div className="quiet-hours-fields">
            <FormField
              id="quiet-hours-start"
              label="Start time"
              hint="When toasts begin to be suppressed"
              error={quietHoursError && !parseHHmm(draft.quietHoursStart).ok ? quietHoursError : undefined}
            >
              <input
                type="time"
                className="control-time"
                value={draft.quietHoursStart}
                onChange={(e) => updateDraft('quietHoursStart', e.target.value)}
                disabled={!draft.quietHoursEnabled}
                aria-disabled={!draft.quietHoursEnabled}
              />
            </FormField>

            <FormField
              id="quiet-hours-end"
              label="End time"
              hint="When toasts resume"
              error={quietHoursError && !parseHHmm(draft.quietHoursEnd).ok ? quietHoursError : undefined}
            >
              <input
                type="time"
                className="control-time"
                value={draft.quietHoursEnd}
                onChange={(e) => updateDraft('quietHoursEnd', e.target.value)}
                disabled={!draft.quietHoursEnabled}
                aria-disabled={!draft.quietHoursEnabled}
              />
            </FormField>
          </div>

          {quietHoursError && parseHHmm(draft.quietHoursStart).ok && parseHHmm(draft.quietHoursEnd).ok && (
            <p id="quiet-hours-times-error" role="alert" className="form-error settings-quiet-hours-status">
              {quietHoursError}
            </p>
          )}

          {!quietHoursError && draft.quietHoursEnabled && (
            <p className={`settings-quiet-hours-status${quietHoursCurrentlyActive ? ' settings-quiet-hours-status--active' : ''}`}>
              {quietHoursCurrentlyActive
                ? 'Quiet hours are currently active — non-critical toasts are suppressed.'
                : 'Quiet hours are not currently active.'}
            </p>
          )}
        </fieldset>
      </section>

      {/* ── Backup & Restore ────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="backup-heading">
        <h2 id="backup-heading">Backup &amp; Restore</h2>
        <p className="settings-section__description">
          Export your settings as a JSON file, or import settings from a previous export.
        </p>

        <div className="settings-backup-row">
          <button
            type="button"
            className="settings-btn settings-btn--secondary"
            onClick={handleExport}
            aria-label="Export settings to JSON file"
          >
            Export settings
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />
          <button
            type="button"
            className="settings-btn settings-btn--secondary"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Import settings from JSON file"
          >
            Import settings
          </button>
        </div>

        {importError && (
          <div role="alert" className="settings-import-error">
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

      {/* ── Actions bar ─────────────────────────────────────────── */}
      <div className="settings-actions" role="group" aria-label="Save or discard settings">
        <AutoSaveIndicator
          status={autoSave.status}
          lastSavedAt={autoSave.lastSavedAt}
          labels={autoSaveLabels}
          onRetry={handleRetry}
        />
        <button
          type="button"
          className="settings-btn settings-btn--primary"
          onClick={handleSave}
          disabled={!isDirty || !!quietHoursError}
          aria-disabled={!isDirty || !!quietHoursError}
        >
          {isDirty ? 'Save' : 'Saved'}
        </button>
        <button
          type="button"
          className="settings-btn settings-btn--secondary"
          onClick={handleCancel}
        >
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
