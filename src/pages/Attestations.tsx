import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AttestationForm from '../components/AttestationForm'
import ActivityTimeline from '../components/ActivityTimeline'
import Select from '../components/controls/Select'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'
import { useToast } from '../components/ToastProvider'
import type { AttestationPayload } from '../events'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  createAttestationIdempotencyKey,
  useAttestations,
} from '../hooks/useAttestations'

export function formatTimestamp(date: Date = new Date()): string {
  return (
    date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }) + ' UTC'
  )
}

export default function Attestations() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  useDocumentTitle(t('attestations.title', 'Attestations'))

  const { items, isLoading, error, isSubmitting, refetch, submitAttestation } = useAttestations()
  const [filterTone, setFilterTone] = useState<string>('all')

    const newItem: ActivityItem = {
      id: `evt-new-${items.length + 1}`,
      timestamp: new Date().toISOString(),
      title:
        payload.type === ATTESTATION_EVENTS.TYPES.IDENTITY
          ? t('activityTimeline.identityAttestation')
          : payload.type === ATTESTATION_EVENTS.TYPES.PEER_VOUCH
            ? t('activityTimeline.peerVouch')
            : t('activityTimeline.credentialCertification'),
      description: payload.evidence,
      actor,
      statusLabel: t('activityTimeline.submitted'),
      tone: 'success',
      meta: t('activityTimeline.subject', { subject: payload.subject.substring(0, 8) }),
      ...(payload.evidenceHash ? { evidenceHash: payload.evidenceHash } : {}),
      ...(payload.evidenceFile ? { evidenceFile: payload.evidenceFile } : {}),
  const handleSubmitSuccess = async (payload: AttestationPayload) => {
    const idempotencyKey = createAttestationIdempotencyKey()
    try {
      await submitAttestation(payload, { idempotencyKey })
    } catch (err) {
      addToast(
        'danger',
        err instanceof Error && err.message
          ? err.message
          : t('attestations.submitError', 'Failed to submit attestation. Please try again.')
      )
      throw err
    }
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

  const renderTimelineContent = () => {
    if (isLoading && items.length === 0) {
      return <LoadingSkeleton variant="card" count={3} />
    }

    if (error && items.length === 0) {
      return (
        <ErrorState
          type="backend"
          message={error.message}
          action={{
            label: t('common.retry', 'Try again'),
            onClick: () => {
              void refetch()
            },
          }}
        />
      )
    }

    if (items.length === 0) {
      return (
        <EmptyState
          illustration="attestation"
          title={t('attestations.noData.title', 'No attestations yet')}
          description={t(
            'attestations.noData.description',
            'Submit your first attestation to start building your trust history.'
          )}
        />
      )
    }

    if (filteredItems.length === 0) {
      return (
        <EmptyState
          illustration="attestation"
          title={t('attestations.filterEmpty.title', 'No attestations match this status')}
          description={t(
            'attestations.filterEmpty.description',
            'Try viewing all attestations to see recent activity.'
          )}
          action={{
            label: t('attestations.filterEmpty.action', 'View all attestations'),
            onClick: () => setFilterTone('all'),
          }}
        />
      )
    }

    return <ActivityTimeline items={filteredItems} />
  }

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
        <h1>{t('attestations.title')}</h1>
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
          <AttestationForm onSubmitSuccess={handleSubmitSuccess} disabled={isSubmitting} />
        </section>

        <section aria-labelledby="timeline-heading">
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 'var(--credence-space-4)',
            }}
          >
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
          {renderTimelineContent()}
        </section>
      </div>
    </div>
  )
}
