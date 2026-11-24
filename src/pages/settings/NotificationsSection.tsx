import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FormField, Input } from '../../components/forms'
import Toggle from '../../components/controls/Toggle'
import Select from '../../components/controls/Select'
import { isQuietHoursActive } from '../../lib/quietHours'
import type { AutoDismissOption } from '../../context/SettingsContext'

export interface NotificationsSectionProps {
  toastsEnabled: boolean
  autoDismiss: AutoDismissOption
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  quietHoursError?: string
  onToastsEnabledChange: (value: boolean) => void
  onAutoDismissChange: (value: AutoDismissOption) => void
  onQuietHoursEnabledChange: (value: boolean) => void
  onQuietHoursStartChange: (value: string) => void
  onQuietHoursEndChange: (value: string) => void
  onPreviewToast: () => void
}

export default function NotificationsSection({
  toastsEnabled,
  autoDismiss,
  quietHoursEnabled,
  quietHoursStart,
  quietHoursEnd,
  quietHoursError,
  onToastsEnabledChange,
  onAutoDismissChange,
  onQuietHoursEnabledChange,
  onQuietHoursStartChange,
  onQuietHoursEndChange,
  onPreviewToast,
}: NotificationsSectionProps) {
  const { t } = useTranslation()

  // Live indicator of whether the configured window would silence toasts at this
  // moment. Recomputed on every render so the user sees the impact immediately.
  const quietHoursCurrentlyActive = useMemo(() => {
    if (!quietHoursEnabled) return false
    if (quietHoursError) return false
    return isQuietHoursActive({
      enabled: true,
      start: quietHoursStart,
      end: quietHoursEnd,
    })
  }, [quietHoursEnabled, quietHoursStart, quietHoursEnd, quietHoursError])

  return (
    <section className="settings-section" aria-labelledby="notifications-heading">
      <h2 id="notifications-heading">{t('settings.notifications.heading')}</h2>
      <p className="settings-section__description">{t('settings.notifications.description')}</p>

      <FormField id="toasts-enabled" label={t('settings.notifications.enableToasts')}>
        <Toggle
          checked={toastsEnabled}
          onChange={onToastsEnabledChange}
          ariaLabel={t('settings.notifications.enableToasts')}
        />
      </FormField>

      <FormField
        id="auto-dismiss"
        label={t('settings.notifications.autoDismissDuration')}
        hint={t('settings.notifications.autoDismissHint')}
      >
        <Select
          value={autoDismiss}
          onChange={(v) => onAutoDismissChange(v as AutoDismissOption)}
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
          onClick={onPreviewToast}
          aria-label={t('settings.notifications.preview')}
        >
          {t('settings.notifications.preview')}
        </button>
        <span className="settings-field-hint">{t('settings.notifications.previewHint')}</span>
      </div>

      {/* Quiet Hours sub-section */}
      <fieldset
        className="settings-fieldset settings-fieldset--card"
        aria-describedby="quiet-hours-desc"
      >
        <legend className="settings-fieldset__legend settings-fieldset__legend--card">
          {t('settings.notifications.quietHours.heading')}
        </legend>
        <p id="quiet-hours-desc" className="settings-section__description">
          {t('settings.notifications.quietHours.description')}
        </p>

        <FormField id="quiet-hours-enabled" label={t('settings.notifications.quietHours.enable')}>
          <Toggle
            checked={quietHoursEnabled}
            onChange={onQuietHoursEnabledChange}
            ariaLabel={t('settings.notifications.quietHours.enable')}
          />
        </FormField>

        <FormField
          id="quiet-hours-start"
          label={t('settings.notifications.quietHours.start')}
          error={quietHoursError}
        >
          <Input
            compact
            value={quietHoursStart}
            onChange={(e) => onQuietHoursStartChange(e.target.value)}
            placeholder={t('settings.notifications.quietHours.startPlaceholder')}
            maxLength={5}
            autoComplete="off"
          />
        </FormField>

        <FormField
          id="quiet-hours-end"
          label={t('settings.notifications.quietHours.end')}
          success={
            !quietHoursError && quietHoursEnabled
              ? quietHoursCurrentlyActive
                ? t('settings.notifications.quietHours.active')
                : t('settings.notifications.quietHours.inactive')
              : undefined
          }
        >
          <Input
            compact
            value={quietHoursEnd}
            onChange={(e) => onQuietHoursEndChange(e.target.value)}
            placeholder={t('settings.notifications.quietHours.endPlaceholder')}
            maxLength={5}
            autoComplete="off"
            aria-invalid={quietHoursError ? 'true' : undefined}
            aria-describedby={quietHoursError ? 'quiet-hours-start-error' : undefined}
          />
        </FormField>
      </fieldset>
    </section>
  )
}
