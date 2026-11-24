import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettings } from '../context/SettingsContext'
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
import { useDebouncedAutoSave } from '../hooks/useDebouncedAutoSave'
import { AutoSaveIndicator, type AutoSaveIndicatorLabels } from '../components/indicators'
import { updateSettings } from '../api/settings'
import { AUTO_SAVE_DEFAULTS } from '../config/autoSave'
import { useAddressBook } from '../hooks/useAddressBook'
import { formatAddressForDisplay, type AddressDisplayMode } from '../lib/stellar'
import type { AutoDismissOption } from '../context/SettingsContext'
import './Settings.css'

function computeDiff(
  current: SettingsBlob,
  incoming: SettingsBlob
): { key: string; from: string; to: string }[] {
  const diffs: { key: string; from: string; to: string }[] = []
  const keys: (keyof Omit<SettingsBlob, 'addressBook'>)[] = [
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
  if (incoming.addressBook !== undefined) {
    const currentCount = current.addressBook?.length ?? 0
    const incomingCount = incoming.addressBook.length
    const currentSig = JSON.stringify(
      (current.addressBook ?? []).map((e) => [e.label, e.address])
    )
    const incomingSig = JSON.stringify(incoming.addressBook.map((e) => [e.label, e.address]))
    if (currentSig !== incomingSig) {
      diffs.push({
        key: 'addressBook',
        from: `${currentCount} ${currentCount === 1 ? 'entry' : 'entries'}`,
        to: `${incomingCount} ${incomingCount === 1 ? 'entry' : 'entries'}`,
      })
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
  addressBook: 'Address book',
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
  const { t } = useTranslation()
  const {
    themeMode,
    network,
    addressDisplay,
    toastsEnabled,
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
  const {
    entries: addressBookEntries,
    addEntry,
    updateEntry,
    removeEntry,
    replaceEntries,
    maxEntries,
  } = useAddressBook()

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

  // Address book form state
  const [newLabel, setNewLabel] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [addressBookError, setAddressBookError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const handleAddAddressBookEntry = (e: React.FormEvent) => {
    e.preventDefault()
    const result = addEntry(newLabel, newAddress)
    if (!result.ok) {
      setAddressBookError(result.error)
      return
    }
    setAddressBookError(null)
    setNewLabel('')
    setNewAddress('')
    addToast('success', `Saved "${result.entry.label}" to address book`)
  }

  const handleStartEdit = (id: string, label: string, address: string) => {
    setEditingId(id)
    setEditLabel(label)
    setEditAddress(address)
    setEditError(null)
  }

  const handleSaveEdit = (id: string) => {
    const result = updateEntry(id, editLabel, editAddress)
    if (!result.ok) {
      setEditError(result.error)
      return
    }
    setEditingId(null)
    setEditError(null)
    addToast('success', `Updated "${result.entry.label}"`)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditError(null)
  }

  const handleRemoveEntry = (id: string, label: string) => {
    removeEntry(id)
    if (editingId === id) {
      setEditingId(null)
      setEditError(null)
    }
    addToast('info', `Removed "${label}" from address book`)
  }

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

  const currentSettings = useMemo<SettingsBlob>(() => {
    return {
      themeMode: themeMode as 'light' | 'dark' | 'system',
      network,
      addressDisplay,
      toastsEnabled,
      autoDismiss,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      addressBook: addressBookEntries,
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
    addressBookEntries,
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
      addressBook: addressBookEntries,
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
    addressBookEntries,
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

    setThemeMode(importPreview.themeMode)
    setNetwork(importPreview.network as 'public' | 'test')
    setAddressDisplay(importPreview.addressDisplay as 'full' | 'short' | 'friendly')
    setToastsEnabled(importPreview.toastsEnabled)
    setAutoDismiss(importPreview.autoDismiss as AutoDismissOption)
    setQuietHoursEnabled(importPreview.quietHoursEnabled ?? false)
    setQuietHoursStart(importPreview.quietHoursStart ?? '22:00')
    setQuietHoursEnd(importPreview.quietHoursEnd ?? '07:00')
    if (importPreview.addressBook !== undefined) {
      replaceEntries(importPreview.addressBook)
    }

    // Import is a commit path: mirror the imported values into the draft and
    // hand the same snapshot to `saveSettings`, so the page and the committed
    // context can never diverge.
    setDraft(payload)
    saveSettings(payload)
    addToast('success', t('settings.toasts.imported'))
    resetImportState()
  }, [importPreview, saveSettings, addToast, resetImportState, t])
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
    replaceEntries,
    saveSettings,
    addToast,
    resetImportState,
  ])

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
            onChange={(v) => updateDraft('network', v as NetworkOption)}
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

      {/* ── Address Book ────────────────────────────────────────── */}
      <section className="settings-section" aria-labelledby="address-book-heading">
        <h2 id="address-book-heading">Address Book</h2>
        <p className="settings-section__description">
          Save trusted Stellar counterparties for quick selection ({addressBookEntries.length} /{' '}
          {maxEntries}).
        </p>

        <form onSubmit={handleAddAddressBookEntry} className="settings-address-book-form" noValidate>
          <FormField id="address-book-label" label="Label">
            <Input
              value={newLabel}
              onChange={(e) => {
                setNewLabel(e.target.value)
                if (addressBookError) setAddressBookError(null)
              }}
              placeholder="e.g. Treasury, Alice"
              maxLength={64}
              autoComplete="off"
            />
          </FormField>

          <FormField id="address-book-address" label="Stellar address">
            <Input
              value={newAddress}
              onChange={(e) => {
                setNewAddress(e.target.value)
                if (addressBookError) setAddressBookError(null)
              }}
              placeholder="G..."
              autoComplete="off"
            />
          </FormField>

          {addressBookError && (
            <div role="alert" className="settings-address-book-error">
              {addressBookError}
            </div>
          )}

          <button type="submit" className="settings-btn settings-btn--secondary">
            Add address
          </button>
        </form>

        {addressBookEntries.length === 0 ? (
          <p className="settings-field-hint">No saved addresses yet for this wallet and network.</p>
        ) : (
          <ul className="settings-address-book-list" aria-label="Saved addresses">
            {addressBookEntries.map((entry) => (
              <li key={entry.id} className="settings-address-book-item">
                {editingId === entry.id ? (
                  <div className="settings-address-book-edit">
                    <Input
                      aria-label="Edit label"
                      value={editLabel}
                      onChange={(e) => {
                        setEditLabel(e.target.value)
                        if (editError) setEditError(null)
                      }}
                      maxLength={64}
                    />
                    <Input
                      aria-label="Edit Stellar address"
                      value={editAddress}
                      onChange={(e) => {
                        setEditAddress(e.target.value)
                        if (editError) setEditError(null)
                      }}
                    />
                    {editError && (
                      <div role="alert" className="settings-address-book-error">
                        {editError}
                      </div>
                    )}
                    <div className="settings-address-book-item-actions">
                      <button
                        type="button"
                        className="settings-btn settings-btn--primary"
                        onClick={() => handleSaveEdit(entry.id)}
                      >
                        Save entry
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn--secondary"
                        onClick={handleCancelEdit}
                      >
                        Cancel edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="settings-address-book-row">
                    <div className="settings-address-book-info">
                      <strong>{entry.label}</strong>{' '}
                      <code>
                        {formatAddressForDisplay(
                          entry.address,
                          addressDisplay as AddressDisplayMode
                        )}
                      </code>
                    </div>
                    <div className="settings-address-book-item-actions">
                      <button
                        type="button"
                        className="settings-btn settings-btn--secondary"
                        onClick={() => handleStartEdit(entry.id, entry.label, entry.address)}
                        aria-label={`Edit ${entry.label}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn--secondary"
                        onClick={() => handleRemoveEntry(entry.id, entry.label)}
                        aria-label={`Remove ${entry.label}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
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

      <ConfirmDialog
        open={importConfirmOpen}
        title="Confirm settings import"
        description={confirmDescription}
        confirmLabel="Apply settings"
        cancelLabel="Cancel"
        onConfirm={handleImportConfirm}
        onCancel={handleImportCancel}
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

      <ConfirmDialog
        open={importConfirmOpen}
        title={t('settings.importDialog.title')}
        description={confirmDescription}
        confirmLabel={t('settings.importDialog.confirmLabel')}
        onConfirm={handleImportConfirm}
        onCancel={handleImportCancel}
      />
    </div>
  )
}
