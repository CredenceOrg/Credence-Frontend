import { useCallback, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AttestationForm from '../components/AttestationForm'
import ActivityTimeline, { type ActivityItem } from '../components/ActivityTimeline'
import AttestationDetailDrawer from '../components/AttestationDetailDrawer'
import { ACTIVITY_ITEMS } from '../data/activity'
import Select from '../components/controls/Select'
import { EmptyState } from '../components/states'
import { ATTESTATION_EVENTS, type AttestationPayload, type ActivityItem } from '../events'

export default function Attestations() {
  const { t } = useTranslation()
  const [items, setItems] = useState<ActivityItem[]>(ACTIVITY_ITEMS)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(ATTESTATION_STATUS_ALL)
  const [activeItem, setActiveItem] = useState<ActivityItem | null>(null)

  const filtersFieldsetId = useId()

  const handleSelect = useCallback((item: ActivityItem) => {
    setActiveItem(item)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setActiveItem(null)
  }, [])

  const handleSubmitSuccess = (payload: AttestationPayload) => {
    const formatTimestamp = () => {
      const now = new Date()
      return (
        now.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }) + ' UTC'
      )
    }

    const newItem: ActivityItem = {
      id: `evt-new-${items.length + 1}`,
      timestamp: formatTimestamp(),
      title:
        payload.type === ATTESTATION_EVENTS.TYPES.IDENTITY
          ? t('activityTimeline.identityAttestation')
          : payload.type === ATTESTATION_EVENTS.TYPES.PEER_VOUCH
            ? t('activityTimeline.peerVouch')
            : t('activityTimeline.credentialCertification'),
      description: payload.evidence,
      actor: 'Current User',
      statusLabel: t('activityTimeline.submitted'),
      tone: 'success',
      meta: t('activityTimeline.subject', { subject: payload.subject.substring(0, 8) }),
      status: 'accepted',
    }

    setItems((prev) => [newItem, ...prev])
  }

  const filteredItems = useMemo(
    () =>
      filterStatus === ATTESTATION_STATUS_ALL
        ? items
        : items.filter((item) => (item.status ?? toneToStatus(item.tone)) === filterStatus),
    [items, filterStatus]
  )

  const totalCount = items.length
  const filteredCount = filteredItems.length
  const summary = t('attestations.filterSummary', {
    filtered: filteredCount,
    total: totalCount,
  })

  const labels = {
    // Header close (icon-only) — full descriptor for SR users.
    closeAria: t('attestations.drawer.close'),
    // Footer close button visible text — short so it doesn't compete with
    // the dialog's aria-modal context.
    closeText: t('common.close'),
    validator: t('attestations.drawer.validator'),
    transaction: t('attestations.drawer.transaction'),
    rule: t('attestations.drawer.rule'),
    windowOrNote: t('attestations.drawer.note'),
    evidence: t('attestations.drawer.evidence'),
    timestamp: t('attestations.drawer.timestamp'),
    emptyTitle: t('attestations.empty.title'),
  }

  const filterLabel = filterOptions.find((o) => o.value === filterTone)?.label ?? filterTone

  return (
    <div className="attestationsPage">
      <PageHeader
        title={t('attestations.title')}
        description={t('attestations.description')}
      />

      <div className="attestationsPage__columns">
        <div className="attestationsPage__column">
          <section aria-labelledby={`${filtersFieldsetId}-legend`}>
            <h2 id={`${filtersFieldsetId}-legend`} className="sr-only">
              {t('attestations.submitForm')}
            </h2>
            <AttestationForm onSubmitSuccess={handleSubmitSuccess} />
          </section>
        </div>

        <div className="attestationsPage__column">
          <div className="attestationsPage__filterBar">
            <fieldset className="attestationFilter" aria-describedby={`${filtersFieldsetId}-summary`}>
              <legend className="attestationFilter__legend">{t('attestations.filter.legend')}</legend>
              <div className="attestationFilter__options" role="presentation">
                {FILTER_ORDER.map((option) => {
                  const checked = filterStatus === option.value
                  const id = `${filtersFieldsetId}-${option.value}`
                  return (
                    <label
                      key={option.value}
                      htmlFor={id}
                      className={[
                        'attestationFilter__pill',
                        checked ? 'attestationFilter__pill--checked' : '',
                        checked ? `attestationFilter__pill--${option.pillClass}` : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <input
                        id={id}
                        type="radio"
                        name="attestation-status-filter"
                        value={option.value}
                        checked={checked}
                        onChange={() => setFilterStatus(option.value)}
                      />
                      <span>{t(option.i18nKey)}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <p
              id={`${filtersFieldsetId}-summary`}
              className="attestationsPage__filterSummary"
              aria-live="polite"
              aria-atomic="true"
            >
              {summary}
            </p>
          </div>
          {filteredItems.length === 0 && filterTone !== 'all' ? (
            <EmptyState
              illustration="attestation"
              title={t('attestations.noFilterResults')}
              description={t('attestations.noFilterResultsDescription', { filter: filterLabel })}
              action={{
                label: t('attestations.clearFilter'),
                onClick: () => setFilterTone('all'),
                variant: 'secondary',
              }}
            />
          ) : (
            <ActivityTimeline
              items={filteredItems}
              emptyTitle={t('attestations.emptyTitle')}
              emptyDescription={t('attestations.emptyDescription')}
            />
          )}
        </div>
      </div>

      <AttestationDetailDrawer
        open={activeItem !== null}
        item={activeItem}
        onClose={handleCloseDrawer}
        labels={labels}
      />
    </div>
  )
}
