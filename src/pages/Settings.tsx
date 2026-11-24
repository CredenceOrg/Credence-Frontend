import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings, type SettingsPayload } from '../context/SettingsContext'
import { useToast } from '../components/ToastProvider'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { parseHHmm } from '../lib/quietHours'
import { useDebouncedAutoSave } from '../hooks/useDebouncedAutoSave'
import { useSettingsBackup } from '../hooks/useSettingsBackup'
import { AutoSaveIndicator, type AutoSaveIndicatorLabels } from '../components/indicators'
import { updateSettings } from '../api/settings'
import { AUTO_SAVE_DEFAULTS } from '../config/autoSave'
import AppearanceSection from './settings/AppearanceSection'
import NetworkSection from './settings/NetworkSection'
import DisplaySection from './settings/DisplaySection'
import NotificationsSection from './settings/NotificationsSection'
import BackupSection from './settings/BackupSection'
import './Settings.css'

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

  useDocumentTitle(t('settings.title'))

  // Single settings model: every control on this page edits `draft`. Nothing
  // reaches the context, localStorage or the server until Save (or import
  // confirm). The dirty check compares the draft against the committed context
  // values, which only change through `saveSettings`. The draft deliberately
  // does not auto-resync on context changes so incidental mutations elsewhere
  // cannot silently discard pending edits.
  const [draft, setDraft] = useState<SettingsPayload>(() => ({
    themeMode: themeMode as SettingsPayload['themeMode'],
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

  const updateDraft = <K extends keyof SettingsPayload>(key: K, value: SettingsPayload[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

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

  // Field-by-field equality. Memoized so reference stability keeps the auto-save
  // hook's internal effect from re-firing on every parent render.
  const draftIsEqual = useCallback(
    (a: SettingsPayload, b: SettingsPayload) =>
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
      savedRelative: (relative: string) =>
        t('settings.autoSave.savedRelative', { when: relative }),
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
    setDraft(committedSettings)
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

  const handleImportedPayload = useCallback(
    (payload: SettingsPayload) => {
      // Import is a commit path: mirror the imported values into the draft and
      // hand the same snapshot to `saveSettings`, so the page and the committed
      // context can never diverge.
      setDraft(payload)
      saveSettings(payload)
    },
    [saveSettings]
  )

  const backup = useSettingsBackup({
    currentSettings: committedSettings,
    onImportConfirm: handleImportedPayload,
  })

  return (
    <div className="settings-page">
      <h1 style={{ marginTop: 0 }}>{t('settings.title')}</h1>

      <AppearanceSection
        themeMode={draft.themeMode}
        onChange={(v) => updateDraft('themeMode', v)}
      />

      <NetworkSection
        network={draft.network}
        onChange={(v) => updateDraft('network', v)}
      />

      <DisplaySection
        addressDisplay={draft.addressDisplay}
        onChange={(v) => updateDraft('addressDisplay', v)}
      />

      <NotificationsSection
        toastsEnabled={draft.toastsEnabled}
        autoDismiss={draft.autoDismiss}
        quietHoursEnabled={draft.quietHoursEnabled}
        quietHoursStart={draft.quietHoursStart}
        quietHoursEnd={draft.quietHoursEnd}
        quietHoursError={quietHoursError}
        onToastsEnabledChange={(v) => updateDraft('toastsEnabled', v)}
        onAutoDismissChange={(v) => updateDraft('autoDismiss', v)}
        onQuietHoursEnabledChange={(v) => updateDraft('quietHoursEnabled', v)}
        onQuietHoursStartChange={(v) => updateDraft('quietHoursStart', v)}
        onQuietHoursEndChange={(v) => updateDraft('quietHoursEnd', v)}
        onPreviewToast={() => addToast('info', t('settings.toasts.preview'))}
      />

      <BackupSection
        fileInputRef={backup.fileInputRef}
        importError={backup.importError}
        importConfirmOpen={backup.importConfirmOpen}
        importFileName={backup.importFileName}
        diffs={backup.diffs}
        hasImportPreview={backup.importPreview !== null}
        onExport={backup.handleExport}
        onFileChange={backup.handleFileChange}
        onResetImport={backup.resetImportState}
        onImportConfirm={backup.handleImportConfirm}
        onImportCancel={backup.handleImportCancel}
      />

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
    </div>
  )
}
