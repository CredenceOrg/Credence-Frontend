import './ActivityTimeline.css'

type ActivityTone = 'success' | 'warning' | 'info'

interface ActivityItem {
  id: string
  timestamp: string
  title: string
  description: string
  actor: string
  statusLabel: string
  tone: ActivityTone
  meta: string
}

interface ActivityTimelineProps {
  compact?: boolean
}

const ACTIVITY_ITEMS: ActivityItem[] = [
  {
    id: 'evt-001',
    timestamp: 'Apr 28, 14:22 UTC',
    title: 'Attestation submitted',
    description: 'Identity evidence package uploaded and signed for review.',
    actor: 'Validator Node 12',
    statusLabel: 'Accepted',
    tone: 'success',
    meta: 'Tx 0x93a1...22f4',
  },
  {
    id: 'evt-002',
    timestamp: 'Apr 27, 09:48 UTC',
    title: 'Proof mismatch detected',
    description: 'Signature payload differed from expected checksum for one field.',
    actor: 'Automated Verifier',
    statusLabel: 'Needs update',
    tone: 'warning',
    meta: 'Rule AV-17',
  },
  {
    id: 'evt-003',
    timestamp: 'Apr 26, 20:11 UTC',
    title: 'Credential refreshed',
    description: 'Expiration window extended after successful periodic check.',
    actor: 'System process',
    statusLabel: 'In review',
    tone: 'info',
    meta: 'Window +90d',
  },
]

export default function ActivityTimeline({ compact = false }: ActivityTimelineProps) {
  return (
    <section
      className={`activity-surface${compact ? ' activity-surface--compact' : ''}`}
      aria-label="Activity and attestations"
    >
      <header className="activity-surface__header">
        <div>
          <p className="activity-surface__eyebrow">Activity Surface Concept</p>
          <h2 className="activity-surface__title">Attestation timeline</h2>
        </div>
        <p className="activity-surface__summary">3 recent events</p>
      </header>

      <ul className="activity-timeline" aria-label="Recent timeline events">
        {ACTIVITY_ITEMS.map((item) => (
          <li className="activity-row" key={item.id}>
            <div className="activity-row__rail" aria-hidden="true">
              <span className={`activity-row__node activity-row__node--${item.tone}`} />
              <span className="activity-row__line" />
            </div>

            <time className="activity-row__time">{item.timestamp}</time>

            <div className="activity-row__content">
              <div className="activity-row__title-wrap">
                <p className="activity-row__title">{item.title}</p>
                <span className={`activity-row__status activity-row__status--${item.tone}`}>
                  {item.statusLabel}
                </span>
              </div>
              <p className="activity-row__description">{item.description}</p>
              <p className="activity-row__actor">By {item.actor}</p>
            </div>

            <p className="activity-row__meta">{item.meta}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
