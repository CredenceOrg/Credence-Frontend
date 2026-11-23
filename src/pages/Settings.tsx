import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useToast } from '../components/ToastProvider'
import { FormField, Input } from '../components/forms'
import Toggle from '../components/controls/Toggle'
import Select from '../components/controls/Select'
import SegmentedControl from '../components/controls/SegmentedControl'
import ConfirmDialog from '../components/ConfirmDialog'
import { ErrorState } from '../components/states'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { validateAndNormalize, type SettingsBlob } from '../lib/settingsSchema'
import { isQuietHoursActive, parseHHmm } from '../lib/quietHours'
import { readPendingTransactions } from '../lib/pendingTransactionsStorage'
import { getNetworkLabel } from '../lib/networkLabels'
import { useDebouncedAutoSave } from '../hooks/useDebouncedAutoSave'
import { AutoSaveIndicator, type AutoSaveIndicatorLabels } from '../components/indicators'
import { updateSettings } from '../api/settings'
import { AUTO_SAVE_DEFAULTS } from '../config/autoSave'
import type {
  AddressDisplayOption,
  AutoDismissOption,
  NetworkOption,
  SettingsPayload,
} from '../context/SettingsContext'
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

export default function Settings() {
  const { t } = useTranslation()
  const {
    themeMode,
    network,
    addressDisplay,
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    saveSettings,
  } = useSettings()
  const { addToast } = useToast()
  const { address, isConnected } = useWallet()

  useDocumentTitle(t('settings.title'))

  // Friendly labels for the diff table so users see "Quiet hours" instead of
  // "quietHoursEnabled" when reviewing an import preview.
  const FIELD_LABELS: Record<string, string> = useMemo(
    () => ({
      themeMode: t('settings.fieldLabels.themeMode'),
      network: t('settings.fieldLabels.network'),
      addressDisplay: t('settings.fieldLabels.addressDisplay'),
      toastsEnabled: t('settings.fieldLabels.toastsEnabled'),
      autoDismiss: t('settings.fieldLabels.autoDismiss'),
      quietHoursEnabled: t('settings.fieldLabels.quietHoursEnabled'),
      quietHoursStart: t('settings.fieldLabels.quietHoursStart'),
      quietHoursEnd: t('settings.fieldLabels.quietHoursEnd'),
    }),
    [t]
  )

  const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = useMemo(
    () => [
      { value: 'light', label: t('settings.appearance.light') },
      { value: 'dark', label: t('settings.appearance.dark') },
      { value: 'system', label: t('settings.appearance.system') },
    ],
    [t]
  )

  const ADDRESS_OPTIONS: { value: 'full' | 'short' | 'friendly'; label: string }[] = useMemo(
    () => [
      { value: 'full', label: t('settings.display.full') },
      { value: 'short', label: t('settings.display.short') },
      { value: 'friendly', label: t('settings.display.friendly') },
    ],
    [t]
  )

  // Single settings model: every control on this page edits `draft`. Nothing
  // reaches the context, localStorage or the server until Save (or import
  // confirm). The dirty check compares the draft against the committed context
  // values, which only change through `saveSettings`. The draft deliberately
  // does not auto-resync on context changes so incidental mutations elsewhere
  // cannot silently discard pending edits.
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

  const [pendingNetworkSwitch, setPendingNetworkSwitch] = useState<{
    nextNetwork: NetworkOption
    pendingCount: number
  } | null>(null)

  const handleNetworkChange = useCallback(
    (nextNetwork: NetworkOption) => {
      if (nextNetwork === draft.network) return

      const pendingCount =
        isConnected && address
          ? readPendingTransactions(draft.network, address).filter((tx) => tx.status === 'pending')
              .length
          : 0

      if (pendingCount > 0) {
        setPendingNetworkSwitch({ nextNetwork, pendingCount })
        return
      }

      setDraft((prev) => ({ ...prev, network: nextNetwork }))
    },
    [draft.network, isConnected, address]
  )

  const handleNetworkSwitchConfirm = useCallback(() => {
    if (!pendingNetworkSwitch) return
    setDraft((prev) => ({ ...prev, network: pendingNetworkSwitch.nextNetwork }))
    setPendingNetworkSwitch(null)
  }, [pendingNetworkSwitch])

  const handleNetworkSwitchCancel = useCallback(() => {
    setPendingNetworkSwitch(null)
  }, [])

  // Validate quiet hours draft: start and end must be valid HH:mm and must
  // differ. The provider falls back to defaults for invalid values, but we
  // surface the error inline so the user can correct bad input.
  const quietHoursError = useMemo(() => {
    if (parseHHmm(draft.quietHoursStart).ok === false) {
      return t('settings.notifications.quietHours.invalidFormat')
    }
    if (parseHHmm(draft.quietHoursEnd).ok === false) {
      return t('settings.notifications.quietHours.invalidFormat')
    }
    if (draft.quietHoursStart === draft.quietHoursEnd) {
      return t('settings.notifications.quietHours.invalidRange')
    }
    return undefined
  }, [draft.quietHoursStart, draft.quietHoursEnd, t])

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

  // Committed settings live in the context; they only change when the user
  // saves or imports. The auto-save hook syncs *these*, never the draft, so an
  // in-progress edit can never be PATCHed before it is committed.
  const committedSettings = useMemo<SettingsPayload>(
    () => ({
      themeMode: themeMode as SettingsPayload['themeMode'],
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    }),
    [
      themeMode,
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
    ]
  )

  // Server sync is opt-in. Deployments without an API leave this unset, so the
  // hook stays parked (`value: undefined`) and the indicator never errors. When
  // enabled, an invalid quiet-hours draft also parks the hook.
  const settingsSyncEnabled = import.meta.env.VITE_SETTINGS_SYNC_ENABLED === 'true'

  const autoSave = useDebouncedAutoSave<SettingsPayload>({
    value: settingsSyncEnabled && !quietHoursError ? committedSettings : undefined,
    save: updateSettings,
    delayMs: AUTO_SAVE_DEFAULTS.DEBOUNCE_MS,
    isEqual: draftIsEqual,
  })

  const autoSaveLabels = useMemo<AutoSaveIndicatorLabels>(
    () => ({
      saving: t('settings.autoSave.saving'),
      saved: t('settings.autoSave.saved'),
      savedRelative: (relative: string) => t('settings.autoSave.savedRelative', { when: relative }),
      error: t('settings.autoSave.error'),
      retry: t('settings.autoSave.retry'),
    }),
    [t]
  )

  const handleRetry = useCallback(() => {
    void autoSave.saveNow()
  }, [autoSave])

  const handleSave = () => {
    if (!isDirty) return
    if (quietHoursError) return
    // Pass the explicit payload: `saveSettings` persists and commits exactly
    // this snapshot, avoiding the stale-render race that previously reverted
    // the change that was just made.
    saveSettings({ ...draft })
    addToast('success', t('settings.toasts.saved'))
  }

  const handleCancel = () => {
    if (isDirty) {
      const confirmed = window.confirm(t('settings.confirmDiscard'))
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
    addToast('success', t('settings.toasts.exported'))
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
    t,
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
  }, [t])

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

    // Import is a commit path: mirror the imported values into the draft and
    // hand the same snapshot to `saveSettings`, so the page and the committed
    // context can never diverge.
    setDraft(payload)
    saveSettings(payload)
    addToast('success', t('settings.toasts.imported'))
    resetImportState()
  }, [importPreview, saveSettings, addToast, resetImportState, t])

  const handleImportCancel = useCallback(() => {
    resetImportState()
    addToast('info', t('settings.toasts.importCancelled'))
  }, [resetImportState, addToast, t])

  const diffs = importPreview ? computeDiff(currentSettings, importPreview) : []

  const confirmDescription = useMemo(() => {
    if (!importPreview) return null

    if (diffs.length === 0) {
      return <p>{t('settings.importDialog.noChanges')}</p>
    }

    return (
      <div>
        <p>
          {t('settings.importDialog.changesIntro', { file: importFileName || 'file' })}
        </p>
        <table className="settings-diff-table">
          <thead>
            <tr>
              <th>{t('settings.importDialog.setting')}</th>
              <th>{t('settings.importDialog.current')}</th>
              <th>{t('settings.importDialog.imported')}</th>
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
  }, [importPreview, diffs, importFileName, FIELD_LABELS, t])

  return (
    <div className="settings-page">
      <h1 style={{ marginTop: 0 }}>{t('settings.title')}</h1>

      {/* ── Appearance ──────────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">{t('settings.appearance.heading')}</h2>
        <p className="settings-section__description">{t('settings.appearance.description')}</p>

        {/*
         * fieldset + legend groups the three radio-style theme options so that
         * screen readers announce "Theme mode: Light / Dark / System" as a
         * single navigable group, satisfying WCAG 1.3.1 (Info & Relationships).
         * The SegmentedControl renders role="radiogroup" internally, so the
         * outer fieldset provides the additional native form landmark and the
         * legend provides the visible/AT-readable caption.
         */}
        <fieldset className="settings-fieldset">
          <legend className="settings-fieldset__legend">{t('settings.appearance.theme')}</legend>
          <SegmentedControl
            id="theme-mode"
            ariaLabel={t('settings.appearance.theme')}
            value={draft.themeMode}
            onChange={(v) => updateDraft('themeMode', v)}
            options={THEME_OPTIONS}
          />
          <p className="settings-field-hint">{t('settings.appearance.systemHint')}</p>
        </fieldset>
      </section>

      {/* ── Network ─────────────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="network-heading">
        <h2 id="network-heading">{t('settings.network.heading')}</h2>
        <p className="settings-section__description">
          {t('settings.network.description')}
        </p>

        <FormField
          id="network-select"
          label={t('settings.network.stellarNetwork')}
          hint={t('settings.network.hint')}
        >
          <Select
            value={draft.network}
            onChange={(v) => handleNetworkChange(v as NetworkOption)}
            options={[
              { value: 'public', label: t('settings.network.public') },
              { value: 'test', label: t('settings.network.test') },
            ]}
          />
        </FormField>
      </section>

      {/* ── Display ─────────────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="display-heading">
        <h2 id="display-heading">{t('settings.display.heading')}</h2>
        <p className="settings-section__description">
          {t('settings.display.description')}
        </p>

        {/*
         * fieldset + legend provides a native grouping landmark for the three
         * address-format options. The SegmentedControl renders role="radiogroup"
         * internally; the outer fieldset ensures the group is announced even in
         * browsing mode (not just forms mode) for screen readers that do not
         * expose ARIA radiogroup in browsing mode.
         */}
        <fieldset className="settings-fieldset">
          <legend className="settings-fieldset__legend">{t('settings.display.addressFormat')}</legend>
          <SegmentedControl
            id="address-display"
            ariaLabel={t('settings.display.addressFormat')}
            value={draft.addressDisplay}
            onChange={(v) => updateDraft('addressDisplay', v)}
            options={ADDRESS_OPTIONS}
          />
          <p className="settings-field-hint">{t('settings.display.friendlyHint')}</p>
        </fieldset>
      </section>

      {/* ── Notifications ───────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">{t('settings.notifications.heading')}</h2>
        <p className="settings-section__description">
          {t('settings.notifications.description')}
        </p>

        <FormField id="toasts-enabled" label={t('settings.notifications.enableToasts')}>
          <Toggle
            checked={draft.toastsEnabled}
            onChange={(v) => updateDraft('toastsEnabled', v)}
            ariaLabel={t('settings.notifications.enableToasts')}
          />
        </FormField>

        <FormField
          id="auto-dismiss"
          label={t('settings.notifications.autoDismissDuration')}
          hint={t('settings.notifications.autoDismissHint')}
        >
          <Select
            value={draft.autoDismiss}
            onChange={(v) => updateDraft('autoDismiss', v as AutoDismissOption)}
            options={[
              { value: 'off', label: t('settings.notifications.off') },
              { value: '3s', label: t('settings.notifications.3seconds') },
              { value: '5s', label: t('settings.notifications.5seconds') },
              { value: '8s', label: t('settings.notifications.8seconds') },
            ]}
          />
        </FormField>

        <div className="settings-preview-row">
          <button
            type="button"
            className="settings-btn settings-btn--secondary"
            onClick={() => addToast('info', t('settings.toasts.preview'))}
            aria-label={t('settings.notifications.preview')}
          >
            {t('settings.notifications.preview')}
          </button>
          <span className="settings-field-hint">{t('settings.notifications.previewHint')}</span>
        </div>

        {/* Quiet Hours sub-section */}
        <fieldset className="settings-fieldset settings-fieldset--card" aria-describedby="quiet-hours-desc">
          <legend className="settings-fieldset__legend settings-fieldset__legend--card">
            {t('settings.notifications.quietHours.heading')}
          </legend>
          <p id="quiet-hours-desc" className="settings-section__description">
            {t('settings.notifications.quietHours.description')}
          </p>

          <FormField id="quiet-hours-enabled" label={t('settings.notifications.quietHours.enable')}>
            <Toggle
              checked={draft.quietHoursEnabled}
              onChange={(v) => updateDraft('quietHoursEnabled', v)}
              ariaLabel={t('settings.notifications.quietHours.enable')}
            />
          </FormField>

          <FormField id="quiet-hours-start" label={t('settings.notifications.quietHours.start')} error={quietHoursError}>
            <Input
              compact
              value={draft.quietHoursStart}
              onChange={(e) => updateDraft('quietHoursStart', e.target.value)}
              placeholder={t('settings.notifications.quietHours.startPlaceholder')}
              maxLength={5}
              autoComplete="off"
            />
          </FormField>

          <FormField
            id="quiet-hours-end"
            label={t('settings.notifications.quietHours.end')}
            success={
              !quietHoursError && draft.quietHoursEnabled
                ? quietHoursCurrentlyActive
                  ? t('settings.notifications.quietHours.active')
                  : t('settings.notifications.quietHours.inactive')
                : undefined
            }
          >
            <Input
              compact
              value={draft.quietHoursEnd}
              onChange={(e) => updateDraft('quietHoursEnd', e.target.value)}
              placeholder={t('settings.notifications.quietHours.endPlaceholder')}
              maxLength={5}
              autoComplete="off"
              aria-invalid={quietHoursError ? 'true' : undefined}
              aria-describedby={quietHoursError ? 'quiet-hours-start-error' : undefined}
            />
          </FormField>
        </fieldset>
      </section>

      {/* ── Backup & Restore ────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="backup-heading">
        <h2 id="backup-heading">{t('settings.backup.heading')}</h2>
        <p className="settings-section__description">
          {t('settings.backup.description')}
        </p>

        <div className="settings-backup-row">
          <button
            type="button"
            className="settings-btn settings-btn--secondary"
            onClick={handleExport}
            aria-label={t('settings.backup.exportAriaLabel')}
          >
            {t('settings.backup.exportSettings')}
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
            aria-label={t('settings.backup.importAriaLabel')}
          >
            {t('settings.backup.importSettings')}
          </button>
        </div>

        {importError && (
          <div role="alert" className="settings-import-error">
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

      {/* ── Actions bar ─────────────────────────────────────────── */}
      <div className="settings-actions" role="group" aria-label={t('settings.actions.ariaLabel')}>
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
          {isDirty ? t('settings.actions.save') : t('settings.actions.saved')}
        </button>
        <button
          type="button"
          className="settings-btn settings-btn--secondary"
          onClick={handleCancel}
        >
          {t('settings.actions.cancel')}
        </button>
      </div>

      <ConfirmDialog
        open={importConfirmOpen}
        title={t('settings.importDialog.title')}
        description={confirmDescription}
        confirmLabel={t('settings.importDialog.confirmLabel')}
        onConfirm={handleImportConfirm}
        onCancel={handleImportCancel}
      />

      <ConfirmDialog
        open={pendingNetworkSwitch !== null}
        title={t('settings.networkSwitchDialog.title')}
        subtitle={t('settings.networkSwitchDialog.subtitle')}
        description={
          pendingNetworkSwitch ? (
            <p>
              {t('settings.networkSwitchDialog.description', {
                count: pendingNetworkSwitch.pendingCount,
                currentNetwork: getNetworkLabel(draft.network),
                targetNetwork: getNetworkLabel(pendingNetworkSwitch.nextNetwork),
              })}
            </p>
          ) : null
        }
        confirmLabel={t('settings.networkSwitchDialog.confirmLabel')}
        confirmHint={t('settings.networkSwitchDialog.confirmHint', {
          currentNetwork: getNetworkLabel(draft.network),
        })}
        variant="info"
        onConfirm={handleNetworkSwitchConfirm}
        onCancel={handleNetworkSwitchCancel}
      />
    </div>
  )
}
