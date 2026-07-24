import { useState, useCallback, useRef, memo, type ReactElement } from 'react'
import './ActivityTimeline.css'
import { ACTIVITY_ITEMS, ActivityItem, ActivityTone, SAMPLE_ACTIVITY } from '../data/activity'
import EmptyState from './states/EmptyState'
import CopyableHash from './CopyableHash'
import Badge from './Badge'

import { ACTIVITY_ITEMS, type ActivityItem } from '../data/activity'

export type ActivityTone = 'success' | 'warning' | 'info'

/**
 * Maps ActivityTimeline tone values to Badge variants.
 * Tones represent attestation status severity levels.
 */
export function toneToBadgeVariant(tone: ActivityTone): BadgeVariant {
  const mapping: Record<ActivityTone, BadgeVariant> = {
    success: 'active',
    warning: 'grace-period',
    info: 'locked',
  }
  return mapping[tone]
}

/**
 * Detects if meta string represents a transaction hash.
 * Returns true if meta starts with "Tx 0x" pattern.
 */
export function isTxHash(meta: string): boolean {
  return /^Tx\s+0x/i.test(meta)
}

export type { ActivityItem }
export { ACTIVITY_ITEMS }

export function toneToBadgeVariant(tone: ActivityTone): 'active' | 'grace-period' | 'locked' {
  switch (tone) {
    case 'success':
      return 'active'
    case 'warning':
      return 'grace-period'
    case 'info':
    default:
      return 'locked'
  }
}

export function isTxHash(meta: string): boolean {
  return /^tx\s+0x[\w.-]+$/i.test(meta.trim())
}

export interface ActivityTimelineProps {
  compact?: boolean
  /** Timeline events to render. Defaults to sample data. Pass empty array for no data. */
  items?: ActivityItem[]
}

interface ActivityRowProps {
  item: ActivityItem
  isExpanded: boolean
  onToggle: (id: string) => void
}

export default function ActivityTimeline({
  compact = false,
  items = ACTIVITY_ITEMS,
}: ActivityTimelineProps): ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const count = items.length
  const summary = `${count} recent ${count === 1 ? 'event' : 'events'}`

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

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