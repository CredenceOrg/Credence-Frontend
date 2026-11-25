import { useTranslation } from 'react-i18next'
import { FormField } from '../../components/forms'
import Select from '../../components/controls/Select'
import type { NetworkOption } from '../../context/SettingsContext'

export interface NetworkSectionProps {
  network: NetworkOption
  onChange: (value: NetworkOption) => void
}

export default function NetworkSection({ network, onChange }: NetworkSectionProps) {
  const { t } = useTranslation()

  return (
    <section className="settings-section" aria-labelledby="network-heading">
      <h2 id="network-heading">{t('settings.network.heading')}</h2>
      <p className="settings-section__description">{t('settings.network.description')}</p>

      <FormField
        id="network-select"
        label={t('settings.network.stellarNetwork')}
        hint={t('settings.network.hint')}
      >
        <Select
          value={network}
          onChange={(v) => onChange(v as NetworkOption)}
          options={[
            { value: 'public', label: t('settings.network.public') },
            { value: 'test', label: t('settings.network.test') },
          ]}
        />
      </FormField>
    </section>
  )
}
