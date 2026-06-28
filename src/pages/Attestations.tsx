import { useState } from 'react'
import AttestationForm from '../components/AttestationForm'
import ActivityTimeline, { ActivityItem } from '../components/ActivityTimeline'
import { ACTIVITY_ITEMS } from '../data/activity'
import Select from '../components/controls/Select'

export default function Attestations() {
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
        ? 'Identity Attestation' 
        : payload.type === 'peer-vouch' 
          ? 'Peer Vouch' 
          : 'Credential Certification',
      description: payload.evidence,
      actor: 'Current User',
      statusLabel: 'Submitted',
      tone: 'success',
      meta: `Subject: ${payload.subject.substring(0, 8)}...`,
    }

    setItems((prev) => [newItem, ...prev])
  }

  const filteredItems = items.filter((item) => {
    if (filterTone === 'all') return true
    return item.tone === filterTone
  })

  const filterOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'success', label: 'Accepted / Submitted' },
    { value: 'warning', label: 'Needs update' },
    { value: 'info', label: 'In review' },
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
        <h1 style={{ marginTop: 0, color: 'var(--credence-text-primary)' }}>Attestations</h1>
        <p style={{ color: 'var(--credence-text-secondary)', margin: 0 }}>
          Submit cryptographic evidence and vouches to build your economic trust score.
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
            Submit Attestation Form
          </h2>
          <AttestationForm onSubmitSuccess={handleSubmitSuccess} />
        </section>

        <section aria-labelledby="timeline-heading">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--credence-space-4)' }}>
            <div style={{ width: '200px' }}>
              <Select
                id="attestation-filter"
                ariaLabel="Filter attestations by status"
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
