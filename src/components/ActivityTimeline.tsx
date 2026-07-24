import { useState, useRef, useCallback } from 'react'
import Badge, { type BadgeVariant } from './Badge'
import CopyableHash from './CopyableHash'
import './ActivityTimeline.css'
import { ACTIVITY_ITEMS, ActivityItem, ActivityTone, SAMPLE_ACTIVITY } from '../data/activity'
import EmptyState from './states/EmptyState'

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

interface ActivityRowProps {
  item: ActivityItem
  isExpanded: boolean
  onToggle: (id: string) => void
}

export const ACTIVITY_ITEMS: ActivityItem[] = SAMPLE_ACTIVITY

export interface ActivityTimelineProps {
  compact?: boolean
  items?: ActivityItem[]
}

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
}: ActivityTimelineProps) {
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
          title="No activity yet"
          description="Attestations and events will appear here"
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
                    id={buttonId}
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    onClick={() => toggleExpand(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleExpand(item.id)
                      }
                    }}
                    className="activity-row__disclosure"
                    ref={(el) => {
                      if (el) triggerRefs.current.set(item.id, el)
                      else triggerRefs.current.delete(item.id)
                    }}
                  >
                    {isExpanded ? 'Hide details' : 'Show details'}
                  </button>

                  <div
                    id={panelId}
                    className="activity-row__detail-panel"
                    hidden={!isExpanded}
                    onKeyDown={handleKeyDown}
                    tabIndex={-1}
                  >
                    <p className="activity-row__actor" style={{ marginBottom: 'var(--credence-space-1)' }}>
                      <strong>Actor:</strong> {item.actor}
                    </p>
                    <p className="activity-row__meta">
                      <strong>Meta:</strong>{' '}
                      {isTxHash(item.meta) ? (
                        <CopyableHash hash={item.meta} />
                      ) : (
                        item.meta
                      )}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}