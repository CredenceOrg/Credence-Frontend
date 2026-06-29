import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import Button from './Button'
import './ConfirmDialog.css'

const DEFAULT_CONFIRM_PHRASE = 'CONFIRM'
const DEFAULT_CONFIRM_HINT =
  'This action cannot be undone. Funds will be sent to your connected wallet.'

export interface ConfirmDialogPenaltyBreakdown {
  bondAmount: string
  penaltyAmount: string
  penaltyPercent: number
  resultingBalance: string
}

export interface ConfirmDialogProps {
  open: boolean
  title: string
  subtitle?: string
  /**
   * Financial breakdown to display. When omitted, the `description` slot or
   * `children` is rendered instead.
   */
  breakdown?: ConfirmDialogPenaltyBreakdown
  /**
   * Arbitrary content shown in the body when `breakdown` is not provided.
   */
  description?: React.ReactNode
  /**
   * React children slot for custom content in the dialog body.
   */
  children?: React.ReactNode
  onConfirm: () => void
  onCancel: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
  confirmLabel?: string
  confirmInputLabel?: React.ReactNode
  confirmInputHint?: React.ReactNode
  variant?: 'danger' | 'info'
  /**
   * Word the user must type exactly to unlock the confirm button.
   * Defaults to `'CONFIRM'`.
   */
  confirmPhrase?: string
  /**
   * Small print shown below the type-to-confirm input.
   * Defaults to the wallet/funds hint used for bond withdrawals.
   */
  confirmHint?: string
  /**
   * When `true`, the dialog is mid-submission: the confirm button enters its
   * loading state, the cancel button is disabled, and backdrop-click is ignored.
   * Reset to `false` once the async operation settles (success or error).
   */
  isSubmitting?: boolean
}

export default function ConfirmDialog({
  open,
  title,
  subtitle,
  breakdown,
  description,
  children,
  onConfirm,
  onCancel,
  returnFocusRef,
  confirmLabel = 'Withdraw bond',
  confirmInputLabel,
  confirmInputHint,
  variant = 'danger',
  confirmPhrase = DEFAULT_CONFIRM_PHRASE,
  confirmHint = DEFAULT_CONFIRM_HINT,
  isSubmitting = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descId = useId()
  const announcementId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [confirmText, setConfirmText] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [prevConfirmEnabled, setPrevConfirmEnabled] = useState(false)

  const handleCancel = useCallback(() => {
    onCancel()
  }, [onCancel])

  useFocusTrap({
    containerRef: dialogRef,
    isActive: open,
    initialFocusRef: cancelRef,
    returnFocusRef,
    onEscape: handleCancel,
  })

  useEffect(() => {
    if (!open) {
      setConfirmText('')
      setAnnouncement('')
      setPrevConfirmEnabled(false)
      return
    }

    const message = subtitle ? `${title}. ${subtitle}` : title
    setAnnouncement(message)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open, title, subtitle])

  const isConfirmEnabled = confirmText === confirmPhrase

  useEffect(() => {
    if (isConfirmEnabled !== prevConfirmEnabled) {
      if (isConfirmEnabled) {
        setAnnouncement(t('confirmDialog.announcements.actionEnabled', { phrase: confirmPhrase }))
        requestAnimationFrame(() => {
          confirmRef.current?.focus()
        })
      } else {
        setAnnouncement(t('confirmDialog.announcements.actionDisabled', { phrase: confirmPhrase }))
        requestAnimationFrame(() => cancelRef.current?.focus())
      }
      setPrevConfirmEnabled(isConfirmEnabled)
    }
  }, [isConfirmEnabled, prevConfirmEnabled, confirmPhrase, t])

  const handleConfirm = () => {
    if (!isConfirmEnabled) return
    onConfirm()
  }

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isSubmitting) return
    if (event.target === event.currentTarget) {
      handleCancel()
    }
  }

  if (!open) return null

  return createPortal(
    <div className="confirm-dialog__backdrop" onClick={handleBackdropClick} aria-hidden={false}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`confirm-dialog confirm-dialog--${variant}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div id={announcementId} className="sr-only" aria-live="assertive" aria-atomic="true">
          {announcement}
        </div>

        <header className="confirm-dialog__header">
          <h2 id={titleId} className="confirm-dialog__title">
            {title}
          </h2>
          {subtitle && <p className="confirm-dialog__subtitle">{subtitle}</p>}
        </header>

        <div id={descId} className="confirm-dialog__body">
          {breakdown ? (
            <dl className="confirm-dialog__breakdown">
              <div className="confirm-dialog__breakdown-row">
                <dt>{t('confirmDialog.breakdown.bondAmount')}</dt>
                <dd>{breakdown.bondAmount}</dd>
              </div>
              <div className="confirm-dialog__breakdown-row confirm-dialog__breakdown-row--penalty">
                <dt>{t('confirmDialog.breakdown.slashPenalty', { percent: breakdown.penaltyPercent })}</dt>
                <dd>−{breakdown.penaltyAmount}</dd>
              </div>
              <div className="confirm-dialog__breakdown-row confirm-dialog__breakdown-row--total">
                <dt>{t('confirmDialog.breakdown.youReceive')}</dt>
                <dd>{breakdown.resultingBalance}</dd>
              </div>
            </dl>
          ) : description ? (
            <div className="confirm-dialog__description">{description}</div>
          ) : null}

          {children}

          <div className="confirm-dialog__confirm-field">
            <label htmlFor={`${titleId}-confirm-input`}>
              {confirmInputLabel || (
                <>
                  {t('confirmDialog.typeToConfirm', { phrase: confirmPhrase, action: confirmLabel !== 'Withdraw bond' ? confirmLabel.toLowerCase() : 'withdrawal' })}
                </>
              )}
            </label>
            <input
              id={`${titleId}-confirm-input`}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-required="true"
              placeholder={confirmPhrase}
            />
            <p className="confirm-dialog__confirm-hint">
              {confirmInputHint || confirmHint}
            </p>
          </div>
        </div>

        <footer className="confirm-dialog__footer">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            disabled={!isConfirmEnabled || isSubmitting}
            isLoading={isSubmitting}
            onClick={handleConfirm}
            aria-disabled={!isConfirmEnabled || isSubmitting}
          >
            {confirmLabel}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
