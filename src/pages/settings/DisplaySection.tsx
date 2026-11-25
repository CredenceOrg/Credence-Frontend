import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SegmentedControl from '../../components/controls/SegmentedControl'
import type { AddressDisplayOption } from '../../context/SettingsContext'

export interface DisplaySectionProps {
  addressDisplay: AddressDisplayOption
  onChange: (value: AddressDisplayOption) => void
}

export default function DisplaySection({ addressDisplay, onChange }: DisplaySectionProps) {
  const { t } = useTranslation()

  const ADDRESS_OPTIONS: { value: 'full' | 'short' | 'friendly'; label: string }[] = useMemo(
    () => [
      { value: 'full', label: t('settings.display.full') },
      { value: 'short', label: t('settings.display.short') },
      { value: 'friendly', label: t('settings.display.friendly') },
    ],
    [t]
  )

  return (
    <section className="settings-section" aria-labelledby="display-heading">
      <h2 id="display-heading">{t('settings.display.heading')}</h2>
      <p className="settings-section__description">{t('settings.display.description')}</p>

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
          value={addressDisplay}
          onChange={onChange}
          options={ADDRESS_OPTIONS}
        />
        <p className="settings-field-hint">{t('settings.display.friendlyHint')}</p>
      </fieldset>
    </section>
  )
}
