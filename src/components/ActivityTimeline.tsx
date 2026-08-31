import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import './ActivityTimeline.css'
import { SAMPLE_ACTIVITY, ACTIVITY_ITEMS } from '../data/activity'
import type { ActivityItem, ActivityTone } from '../events'
import { AttestationStatus, toneToStatus } from '../events'

// Re-exported so tests and legacy callers that import these types directly
// from this module continue to resolve without changes.
export type { ActivityItem, ActivityTone } from '../events'
export { AttestationStatus } from '../events'
import { formatAmount } from '../lib/format'
import EmptyState from './states/EmptyState'
import CopyableHash from './CopyableHash'
import Badge from './Badge'
import type { BadgeVariant } from './Badge'

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

/**
 * Resolves the filterable status for an activity item. Prefers the
 * explicit `status` field and falls back to `toneToStatus(tone)` so
 * legacy items added before `status` was introduced keep working.
 */
export function resolveItemStatus(item: ActivityItem): AttestationStatus | null {
  if (item.status) return item.status
  return toneToStatus(item.tone)
}

export interface ActivityTimelineProps {
  compact?: boolean
  items?: ActivityItem[]
  /** Override the default empty-state title (defaults to "No activity yet"). */
  emptyTitle?: string
  /** Override the default empty-state description. */
  emptyDescription?: string
  /** Opts into drawer-based navigation: swaps the disclosure button to "View details" and makes the row clickable. */
  onSelect?: (item: ActivityItem) => void
  /** Idempotency nonce for deterministic safe retry and replay protection. */
  nonce?: string
}

/**
 * Attestation timeline surface.
 *
 * The original disclosure pattern (Show/Hide details) is the default and
 * is what the Trust Score surface consumes (via `compact`). The
 * Attestations route opts in to drawer-based navigation by passing
 * `onSelect`, which swaps the disclosure button to "View details" and
 * makes the entire row clickable.
 *
 * Implements accessible disclosure pattern (inline path only):
 * - aria-expanded / aria-controls wiring
 * - Enter / Space toggle activation
 * - Escape to collapse + return focus
 * - Focus management on open / close
 *
 * See docs/ATTESTATIONS_VIEW_DESIGN.md, §3 and §4.
 */
export default function ActivityTimeline({
  compact = false,
  items = SAMPLE_ACTIVITY,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Attestations and events will appear here once activity begins.',
  onSelect,
  nonce,
}: ActivityTimelineProps): ReactElement {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const count = items.length
  const summary = `${count} recent ${count === 1 ? 'event' : 'events'}`

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      // Escape handling is meaningful only for the inline disclosure path.
      // When `onSelect` is provided the drawer owns the focus trap and
      // its own Escape handler — see AttestationDetailDrawer.
      if (event.key !== 'Escape' || !expandedId || onSelect) return
      const openId = expandedId
      setExpandedId(null)
      const trigger = triggerRefs.current.get(openId)
      if (trigger) trigger.focus()
    },
    [expandedId, onSelect]
  )

  // Atomic state recovery: Ensure that if items change (e.g. filtered, replaced, or rolled back on error),
  // any expandedId that is no longer present in items is automatically cleared so no orphaned panel or
  // unauthorized partial detail remains open.
  useEffect(() => {
    if (expandedId !== null && !items.some((item) => item.id === expandedId)) {
      setExpandedId(null)
    }
  }, [items, expandedId])

  // Reset expansion state when nonce changes to guarantee deterministic replay and idempotency protection.
  useEffect(() => {
    setExpandedId(null)
  }, [nonce])

  return (
    <section
      className={`activity-surface${compact ? ' activity-surface--compact' : ''}`}
      aria-label="Activity and attestations"
      onKeyDown={handleKeyDown}
      data-nonce={nonce}
    >
      <header className="activity-surface__header">
        <div>
          <p className="activity-surface__eyebrow">Activity Surface Concept</p>
          <h2 className="activity-surface__title">Attestation timeline</h2>
        </div>
        {count > 0 && (
          <p className="activity-surface__summary" aria-live="polite" aria-atomic="true">
            {summary}
          </p>
        )}
      </header>

      {count === 0 ? (
        <EmptyState
          illustration="activity"
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <ul className="activity-timeline" aria-label="Recent timeline events">
          {items.map((item) => {
            const isExpanded = expandedId === item.id
            const panelId = `details-${item.id}`
            const buttonId = `trigger-${item.id}`
            const rowClassName = [
              'activity-row',
              onSelect ? 'activity-row--selectable' : '',
            ]
              .filter(Boolean)
              .join(' ')
            const disclosureLabel = onSelect
              ? 'View details'
              : isExpanded
                ? 'Hide details'
                : 'Show details'
            const statusPrefix = item.statusLabel ? `${item.statusLabel}. ` : ''
            return (
              <li
                className={rowClassName}
                key={item.id}
                onClick={
                  onSelect
                    ? (event) => {
                      // Stop propagation so a click on the disclosure
                      // button (which also lives in this row) doesn't
                      // double-fire — the button's onClick owns
                      // activation in both paths via stopPropagation.
                      event.stopPropagation()
                      onSelect(item)
                    }
                    : undefined
                }
              >
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

                  {item.amountUsdc != null && (
                    <p
                      className="activity-row__amount"
                      aria-label={`Amount: ${formatAmount(item.amountUsdc)}`}
                    >
                      {formatAmount(item.amountUsdc)}
                    </p>
                  )}

                  <button
                    id={buttonId}
                    type="button"
                    className="activity-row__disclosure"
                    aria-expanded={onSelect ? undefined : isExpanded}
                    aria-controls={onSelect ? undefined : panelId}
                    aria-label={`${statusPrefix}${disclosureLabel}`}
                    onClick={(event) => {
                      if (onSelect) {
                        event.stopPropagation()
                        onSelect(item)
                        return
                      }
                      toggleExpand(item.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (onSelect) {
                          onSelect(item)
                          return
                        }
                        toggleExpand(item.id)
                      }
                    }}
                    ref={(el) => {
                      if (el) triggerRefs.current.set(item.id, el)
                      else triggerRefs.current.delete(item.id)
                    }}
                  >
                    <span aria-hidden="true">{disclosureLabel}</span>
                  </button>

                  {isExpanded && (
                    <div id={panelId} className="activity-row__detail-panel" role="region" aria-label="Details">
                      <p className="activity-row__actor">
                        <strong>Actor:</strong> {item.actor}
                      </p>
                      <p className="activity-row__meta">
                        <strong>Meta:</strong>{' '}
                        {isTxHash(item.meta) ? (
                          <CopyableHash hash={item.meta} kind="tx" />
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

/** Re-exported for legacy callers (e.g. Trust Score surface) that
 *  previously imported `SAMPLE_ACTIVITY` directly from this module. */
export { SAMPLE_ACTIVITY, ACTIVITY_ITEMS }
