import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmDialog from '../../components/ConfirmDialog'
import { ErrorState } from '../../components/states'
import type { SettingsDiff } from '../../hooks/useSettingsBackup'

export interface BackupSectionProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  importError: string | null
  importConfirmOpen: boolean
  importFileName: string | null
  diffs: SettingsDiff[]
  hasImportPreview: boolean
  onExport: () => void
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onResetImport: () => void
  onImportConfirm: () => void
  onImportCancel: () => void
}

export default function BackupSection({
  fileInputRef,
  importError,
  importConfirmOpen,
  importFileName,
  diffs,
  hasImportPreview,
  onExport,
  onFileChange,
  onResetImport,
  onImportConfirm,
  onImportCancel,
}: BackupSectionProps) {
  const { t } = useTranslation()

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

  const confirmDescription = useMemo(() => {
    if (!hasImportPreview) return null

    if (diffs.length === 0) {
      return <p>{t('settings.importDialog.noChanges')}</p>
    }

    return (
      <div>
        <p>{t('settings.importDialog.changesIntro', { file: importFileName || 'file' })}</p>
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
  }, [hasImportPreview, diffs, importFileName, FIELD_LABELS, t])

  return (
    <>
      <section className="settings-section" aria-labelledby="backup-heading">
        <h2 id="backup-heading">{t('settings.backup.heading')}</h2>
        <p className="settings-section__description">{t('settings.backup.description')}</p>

        <div className="settings-backup-row">
          <button
            type="button"
            className="settings-btn settings-btn--secondary"
            onClick={onExport}
            aria-label={t('settings.backup.exportAriaLabel')}
          >
            {t('settings.backup.exportSettings')}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onFileChange}
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
                onClick: onResetImport,
              }}
            />
          </div>
        )}
      </section>

      <ConfirmDialog
        open={importConfirmOpen}
        title={t('settings.importDialog.title')}
        description={confirmDescription}
        confirmLabel={t('settings.importDialog.confirmLabel')}
        onConfirm={onImportConfirm}
        onCancel={onImportCancel}
      />
    </>
  )
}
