import { useState } from 'react'
import './ActivityTimeline.css'
import EmptyState from './states/EmptyState'

export type ActivityTone = 'success' | 'warning' | 'info'

export interface ActivityItem {
  id: string
  timestamp: string
  title: string
  description: string
  actor: string
  statusLabel: string
  tone: ActivityTone
  meta: string
}

export interface ActivityTimelineProps {
  compact?: boolean
  /** Timeline events to render. Defaults to sample data. Pass empty array for no data. */
  items?: ActivityItem[]
}

export const SAMPLE_ACTIVITY: ActivityItem[] = [
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

export const ACTIVITY_ITEMS: ActivityItem[] = SAMPLE_ACTIVITY

export default function ActivityTimeline({
  compact = false,
  items = ACTIVITY_ITEMS,
}: ActivityTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const count = items.length
  const summary = `${count} recent ${count === 1 ? 'event' : 'events'}`

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

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
        {count > 0 && <p className="activity-surface__summary">{summary}</p>}
      </header>

      {count === 0 ? (
        <EmptyState
          illustration="activity"
          title="No activity yet"
          description="Attestations and events will appear here once activity begins."
        />
      ) : (
        <ul className="activity-timeline" aria-label="Recent timeline events">
          {items.map((item) => {
            const isExpanded = expandedId === item.id
            return (
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

                  <button
                    type="button"
                    className="activity-row__toggle"
                    aria-expanded={isExpanded}
                    aria-controls={`details-${item.id}`}
                    onClick={() => toggleExpand(item.id)}
                  >
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>

                  {isExpanded && (
                    <div
                      id={`details-${item.id}`}
                      style={{
                        marginTop: 'var(--credence-space-3)',
                        padding: 'var(--credence-space-3)',
                        background: 'var(--credence-surface-page)',
                        borderRadius: 'var(--credence-radius-md)',
                      }}
                    >
                      <p className="activity-row__actor" style={{ marginBottom: 'var(--credence-space-1)' }}>
                        <strong>Actor:</strong> {item.actor}
                      </p>
                      <p className="activity-row__meta">
                        <strong>Meta:</strong> {item.meta}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
