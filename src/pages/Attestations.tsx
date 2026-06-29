import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AttestationForm from '../components/AttestationForm'
import ActivityTimeline, { ActivityItem } from '../components/ActivityTimeline'
import { ACTIVITY_ITEMS } from '../data/activity'
import Select from '../components/controls/Select'

export default function Attestations() {
  const { t } = useTranslation()
  const [items, setItems] = useState<ActivityItem[]>(ACTIVITY_ITEMS)
  const [filterTone, setFilterTone] = useState<string>('all')

  const handleSubmitSuccess = (payload: { subject: string; type: string; evidence: string }) => {
    const formatTimestamp = () => {
      const now = new Date()
      return now.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }) + ' UTC'
    }

    const newItem: ActivityItem = {
      id: `evt-new-${items.length + 1}`,
      timestamp: formatTimestamp(),
      title: payload.type === 'identity' 
        ? t('activityTimeline.identityAttestation') 
        : payload.type === 'peer-vouch' 
          ? t('activityTimeline.peerVouch') 
          : t('activityTimeline.credentialCertification'),
      description: payload.evidence,
      actor: 'Current User',
      statusLabel: t('activityTimeline.submitted'),
      tone: 'success',
      meta: t('activityTimeline.subject', { subject: payload.subject.substring(0, 8) }),
    }

    setItems((prev) => [newItem, ...prev])
  }

  const filteredItems = items.filter((item) => {
    if (filterTone === 'all') return true
    return item.tone === filterTone
  })

  const filterOptions = [
    { value: 'all', label: t('attestations.filter.all') },
    { value: 'success', label: t('attestations.filter.success') },
    { value: 'warning', label: t('attestations.filter.warning') },
    { value: 'info', label: t('attestations.filter.info') },
  ]

  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--credence-space-6)',
        maxWidth: 'var(--credence-container-max)',
        margin: '0 auto',
      }}
    >
      <header>
        <h1 style={{ marginTop: 0, color: 'var(--credence-text-primary)' }}>{t('attestations.title')}</h1>
        <p style={{ color: 'var(--credence-text-secondary)', margin: 0 }}>
          {t('attestations.description')}
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--credence-space-6)',
          alignItems: 'start',
        }}
      >
        <section aria-labelledby="form-heading">
          <h2 id="form-heading" className="sr-only">
            {t('attestations.submitForm')}
          </h2>
          <AttestationForm onSubmitSuccess={handleSubmitSuccess} />
        </section>

        <section aria-labelledby="timeline-heading">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--credence-space-4)' }}>
            <div style={{ width: '200px' }}>
              <Select
                id="attestation-filter"
                ariaLabel={t('attestations.filterLabel')}
                value={filterTone}
                onChange={setFilterTone}
                options={filterOptions}
              />
            </div>
          </div>
          <ActivityTimeline items={filteredItems} />
        </section>
      </div>
    </div>
  )
}
