import { useState, memo, type ReactElement } from 'react'
import './ActivityTimeline.css'
import EmptyState from './states/EmptyState'
import CopyableHash from './CopyableHash'
import { ACTIVITY_ITEMS } from '../data/activity'

export type { ActivityItem, ActivityTone }

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
    meta: 'Tx 0x93a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
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

const ActivityRow = memo(function ActivityRow({ item, isExpanded, onToggle }: ActivityRowProps) {
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
          aria-expanded={isExpanded}
          aria-controls={`details-${item.id}`}
          onClick={() => onToggle(item.id)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            marginTop: 'var(--credence-space-2)',
            color: 'var(--credence-text-secondary)',
            cursor: 'pointer',
            fontSize: 'var(--credence-font-size-sm)',
            textDecoration: 'underline',
            textAlign: 'left',
          }}
        >
          {isExpanded ? 'Hide details' : 'Show details'}
        </button>

        {isExpanded && (
          <div
            id={`details-${item.id}`}
            style={{
              marginTop: 'var(--credence-space-3)',
              padding: 'var(--credence-space-3)',
              background: 'var(--credence-color-surface-hover)',
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
})

/**
 * Attestation evidence detail panel component.
 * Displays full evidence details including actor, status badge, and meta.
 *
 * Implements accessible disclosure pattern with:
 * - aria-expanded/aria-controls wiring
 * - Enter/Space toggle activation
 * - Escape key to close and return focus
 * - Focus management on open/close
 */
export default function ActivityTimeline({
  compact = false,
  items = ACTIVITY_ITEMS,
}: ActivityTimelineProps): ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const expandedIdRef = useRef<string | null>(null)

  const count = items.length
  const summary = `${count} recent ${count === 1 ? 'event' : 'events'}`

  // Keep the ref in sync with state
  expandedIdRef.current = expandedId

  const closePanel = useCallback(() => {
    setExpandedId(null)
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape' && expandedIdRef.current !== null) {
        const triggerElement = triggerRefs.current.get(expandedIdRef.current)
        closePanel()
        if (triggerElement) {
          triggerElement.focus()
        }
      }
    },
    [closePanel]
  )

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
          title="No recent activity"
          description="New trust score events will appear here once bonds"
        />
      ) : (
        <ul className="activity-timeline" aria-label="Recent timeline events">
          {items.map((item) => {
            const isExpanded = expandedId === item.id
            const panelId = `details-${item.id}`
            const buttonId = `trigger-${item.id}`
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
                    <Badge variant={toneToBadgeVariant(item.tone)} label={item.statusLabel} />
                  </div>
                  <p className="activity-row__description">{item.description}</p>

                  <button
                    type="button"
                    className="activity-row__toggle"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
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
                        <strong>Meta:</strong>{' '}
                        {item.meta.startsWith('Tx ') ? (
                          <>
                            Tx <CopyableHash hash={item.meta.slice(3)} kind="tx" />
                          </>
                        ) : (
                          item.meta
                        )}
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