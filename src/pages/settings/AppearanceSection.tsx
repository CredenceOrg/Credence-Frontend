import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SegmentedControl from '../../components/controls/SegmentedControl'

export interface AppearanceSectionProps {
  themeMode: 'light' | 'dark' | 'system'
  onChange: (value: 'light' | 'dark' | 'system') => void
}

export default function AppearanceSection({ themeMode, onChange }: AppearanceSectionProps) {
  const { t } = useTranslation()

  const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string }[] = useMemo(
    () => [
      { value: 'light', label: t('settings.appearance.light') },
      { value: 'dark', label: t('settings.appearance.dark') },
      { value: 'system', label: t('settings.appearance.system') },
    ],
    [t]
  )

  return (
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
          value={themeMode}
          onChange={onChange}
          options={THEME_OPTIONS}
        />
        <p className="settings-field-hint">{t('settings.appearance.systemHint')}</p>
      </fieldset>
    </section>
  )
}
