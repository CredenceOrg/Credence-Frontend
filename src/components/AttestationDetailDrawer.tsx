import { useCallback, useEffect, useId, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useScrollPreserver } from '../hooks/useScrollPreserver'
import { isTxHash, toneToBadgeVariant } from './ActivityTimeline'
import Badge from './Badge'
import Button from './Button'
import CopyableHash from './CopyableHash'
import type { ActivityItem } from '../events'
import './AttestationDetailDrawer.css'

export interface AttestationDetailDrawerProps {
  /** Whether the drawer is open. */
  open: boolean
  /** The attestation event to display. When null and open, the drawer
   *  shows an empty state and prevents focus trapping on the body content. */
  item: ActivityItem | null
  /** Called when the user dismisses the drawer via Escape, backdrop, or
   *  the close button. */
  onClose: () => void
  /** Element that should receive focus when the drawer closes. When
   *  omitted, focus returns to whatever had it before the drawer opened. */
  returnFocusRef?: RefObject<HTMLElement | null>
  /** Translated labels. `closeAria` is the screen-reader label for the
   *  icon-only close button in the header; `closeText` is the visible
   *  footer button text. Keeping these distinct avoids aria-name
   *  collisions on the multiple close affordances inside the dialog. */
  labels: {
    closeAria: string
    closeText: string
    validator: string
    transaction: string
    rule: string
    windowOrNote: string
    evidence: string
    timestamp: string
    viewOnExplorer: string
    emptyTitle: string
  }
}

/**
 * Right-rail / bottom-sheet drawer showing the full detail of an attestation
 * event: validator, transaction hash, evidence, metadata, and timestamp.
 *
 * Pattern is shared with `WhatsNewDialog` and `ConnectWalletDialog`:
 * - portal‑rendered into `document.body`,
 * - focus is trapped while open and is returned to the originating row on close,
 * - `Escape` and a backdrop click that *started outside* the drawer both close,
 * - background scroll is preserved while open.
 *
 * Why backdrop "started outside"? — A naïve click‑to‑close on the backdrop
 * dismisses the drawer on any incidental mousedown that the user does while
 * the drawer is open (e.g. when text on the page reports "loading…"). We
 * capture focus containment at mousedown so a stray pointer doesn't dismiss
 * content the user is waiting on. The single‑mousedown guarantee means
 * accidental taps during initial mount don't trigger a close until the user
 * explicitly lets go of the click target.
 *
 * See docs/ATTESTATIONS_VIEW_DESIGN.md, §4 — "Detail drawer — spec".
 */
export default function AttestationDetailDrawer({
  open,
  item,
  onClose,
  returnFocusRef,
  labels,
}: AttestationDetailDrawerProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  // Tracks whether the user's pointerdown originated inside the drawer.
  // Backdrop dismiss fires only when the click started outside; this avoids
  // dismissing the drawer when the user is selecting the close button, the
  // CopyableHash's copy/explorer buttons, or any in-drawer affordance.
  const mouseDownInsideRef = useRef(false)

  useScrollPreserver({ isActive: open })

  useFocusTrap({
    containerRef: dialogRef,
    isActive: open && Boolean(item),
    initialFocusRef: closeButtonRef,
    returnFocusRef,
    onEscape: onClose,
  })

  const handleBackdropMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    mouseDownInsideRef.current = event.target !== event.currentTarget
  }, [])

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Only dismiss when the click started outside the drawer — see the
      // rationale in the JSDoc above.
      if (mouseDownInsideRef.current) {
        mouseDownInsideRef.current = false
        return
      }
      if (event.target === event.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // Reset the mousedown marker whenever the drawer closes so the next
  // pointerdown starts with a clean slate.
  useEffect(() => {
    if (!open) mouseDownInsideRef.current = false
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="attestationDrawer__backdrop"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="attestationDrawer"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="attestationDrawer__header">
          <div className="attestationDrawer__titleBlock">
            <h2 id={titleId} className="attestationDrawer__title">
              {item?.title ?? labels.emptyTitle}
            </h2>
            {item ? (
              <Badge
                variant={toneToBadgeVariant(item.tone)}
                label={item.statusLabel}
                srPrefix="Status:"
              />
            ) : null}
          </div>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            className="attestationDrawer__close"
            aria-label={labels.closeAria}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </Button>
        </header>

        {item ? (
          <div className="attestationDrawer__body">
            <DetailRow label={labels.validator} value={item.actor} />
            {isTxHash(item.meta) ? (
              <DetailRow
                label={labels.transaction}
                valueNode={<CopyableHash hash={item.meta.replace(/^Tx\s+/i, '')} kind="tx" />}
              />
            ) : /^Rule\s+/i.test(item.meta) ? (
              <DetailRow label={labels.rule} value={item.meta.replace(/^Rule\s+/i, '')} />
            ) : (
              <DetailRow label={labels.windowOrNote} value={item.meta} />
            )}
            <DetailRow label={labels.evidence} value={item.description} multiline />
            <DetailRow
              label={labels.timestamp}
              valueNode={
                <time className="attestationDrawer__time" dateTime={item.timestamp}>
                  {item.timestamp}
                </time>
              }
            />
          </div>
        ) : (
          <div className="attestationDrawer__empty" role="status" aria-live="polite">
            <p>{labels.emptyTitle}</p>
          </div>
        )}

        <footer className="attestationDrawer__footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            {labels.closeText}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

interface DetailRowProps {
  label: string
  value?: string
  valueNode?: React.ReactNode
  multiline?: boolean
}

function DetailRow({ label, value, valueNode, multiline }: DetailRowProps) {
  return (
    <div className={`attestationDrawer__row${multiline ? ' attestationDrawer__row--multiline' : ''}`}>
      <span className="attestationDrawer__rowLabel">{label}</span>
      {valueNode ? (
        <span className="attestationDrawer__rowValue">{valueNode}</span>
      ) : (
        <span className="attestationDrawer__rowValue">{value}</span>
      )}
    </div>
  )
}
