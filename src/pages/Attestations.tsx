import { useState } from 'react'
import AttestationForm from '../components/AttestationForm'
import { truncateAddress } from '../lib/stellar'
import '../components/ActivityTimeline.css'

interface AttestationItem {
  id: string
  timestamp: string
  subject: string
  type: string
  evidence: string
  status: string
  tone: 'success' | 'warning' | 'info'
}

const INITIAL_ATTESTATIONS: AttestationItem[] = [
  {
    id: 'att-001',
    timestamp: 'Jun 22, 14:22 UTC',
    subject: 'GD6W6SZB2V6J5OQJZP4B3R4O46YIYTRCYN7E7JDF4NLOV33QZJQH2W42',
    type: 'identity',
    evidence: 'Keybase identity verification package: Olmid12@keybase',
    status: 'Verified',
    tone: 'success',
  },
  {
    id: 'att-002',
    timestamp: 'Jun 20, 09:48 UTC',
    subject: 'GBX62XNZ2PAO46YIYTRCYN7E7JDF4NLOV33QZJQH2W42GD6W6SZB2V6J',
    type: 'peer-vouch',
    evidence: 'Vouched for node stability and uptime during Q1 2026.',
    status: 'Pending Review',
    tone: 'info',
  },
]

export default function Attestations() {
  const [attestations, setAttestations] = useState<AttestationItem[]>(INITIAL_ATTESTATIONS)

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

    const newItem: AttestationItem = {
      id: `att-00${attestations.length + 1}`,
      timestamp: formatTimestamp(),
      subject: payload.subject,
      type: payload.type,
      evidence: payload.evidence,
      status: 'Submitted',
      tone: 'success',
    }

    setAttestations((prev) => [newItem, ...prev])
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

        <section className="activity-surface" aria-labelledby="timeline-heading">
          <header className="activity-surface__header">
            <div>
              <p className="activity-surface__eyebrow">On-Chain Registry</p>
              <h2 id="timeline-heading" className="activity-surface__title">
                Your submitted attestations
              </h2>
            </div>
            <p className="activity-surface__summary">
              {attestations.length} {attestations.length === 1 ? 'record' : 'records'}
            </p>
          </header>

          {attestations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--credence-space-8)' }}>
              <p style={{ color: 'var(--credence-text-secondary)' }}>No attestations submitted yet.</p>
            </div>
          ) : (
            <ul className="activity-timeline" aria-label="Recent submitted attestations">
              {attestations.map((item) => (
                <li className="activity-row" key={item.id}>
                  <div className="activity-row__rail" aria-hidden="true">
                    <span className={`activity-row__node activity-row__node--${item.tone}`} />
                    <span className="activity-row__line" />
                  </div>

                  <time className="activity-row__time">{item.timestamp}</time>

                  <div className="activity-row__content">
                    <div className="activity-row__title-wrap">
                      <p className="activity-row__title">
                        {item.type === 'identity'
                          ? 'Identity Attestation'
                          : item.type === 'peer-vouch'
                            ? 'Peer Vouch'
                            : 'Credential Certification'}
                      </p>
                      <span className={`activity-row__status activity-row__status--${item.tone}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="activity-row__description">{item.evidence}</p>
                    <p className="activity-row__actor">
                      Subject: <code>{truncateAddress(item.subject)}</code>
                    </p>
                  </div>

                  <p className="activity-row__meta">ID: {item.id}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
