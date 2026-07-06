import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useProductUpdates } from '../hooks/useProductUpdates'
import type { ProductUpdate } from '../data/productUpdates'
import Button from './Button'
import './WhatsNewDialog.css'

export interface WhatsNewDialogProps {
  open: boolean
  onClose: () => void
  /**
   * Optional ref whose element will receive focus after the dialog closes.
   * When omitted, focus returns to whichever element was active before opening.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

const TAG_LABELS: Record<ProductUpdate['tag'], string> = {
  feature: 'New',
  improvement: 'Improved',
  fix: 'Fixed',
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Modal dialog listing recent product updates ("What's New" changelog).
 *
 * - Renders via a React portal into `document.body`.
 * - Focus is trapped inside while open; restored on close.
 * - Escape and backdrop click close the dialog.
 * - Marks all updates as read on open, clearing the notification badge.
 */
export default function WhatsNewDialog({
  open,
  onClose,
  returnFocusRef,
}: WhatsNewDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const { updates, markAllRead } = useProductUpdates()

  const handleClose = useCallback(() => onClose(), [onClose])

  useFocusTrap({
    containerRef: dialogRef,
    isActive: open,
    initialFocusRef: closeButtonRef,
    returnFocusRef,
    onEscape: handleClose,
  })

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    markAllRead()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open, markAllRead])

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) handleClose()
  }

  if (!open) return null

  return createPortal(
    <div
      className="whats-new-dialog__backdrop"
      onClick={handleBackdropClick}
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="whats-new-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="whats-new-dialog__header">
          <h2 id={titleId} className="whats-new-dialog__title">
            What&rsquo;s New
          </h2>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            className="whats-new-dialog__close"
            aria-label="Close What's New"
            onClick={handleClose}
          >
            <span aria-hidden="true">&#x2715;</span>
          </Button>
        </header>

        <ul className="whats-new-dialog__list" role="list" aria-label="Recent product updates">
          {updates.map((update) => (
            <li key={update.id} className="whats-new-dialog__item">
              <div className="whats-new-dialog__item-meta">
                <span
                  className={`whats-new-dialog__tag whats-new-dialog__tag--${update.tag}`}
                  aria-label={TAG_LABELS[update.tag]}
                >
                  {TAG_LABELS[update.tag]}
                </span>
                <time className="whats-new-dialog__date" dateTime={update.date}>
                  {formatDate(update.date)}
                </time>
              </div>
              <p className="whats-new-dialog__item-title">{update.title}</p>
              <p className="whats-new-dialog__item-description">{update.description}</p>
            </li>
          ))}
        </ul>

        <footer className="whats-new-dialog__footer">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
