import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import Button from './Button'
import './ConfirmDialog.css'

export interface ReauthPromptProps {
  open: boolean
  onConfirm: () => Promise<void>
  onCancel: () => void
  returnFocusRef?: RefObject<HTMLElement | null>
}

export default function ReauthPrompt({
  open,
  onConfirm,
  onCancel,
  returnFocusRef,
}: ReauthPromptProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descId = useId()
  const announcementId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      setIsSubmitting(false)
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const handleConfirm = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setIsSubmitting(false)
    }
  }, [onConfirm])

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
        className="confirm-dialog confirm-dialog--info"
        onClick={(e) => e.stopPropagation()}
      >
        <div id={announcementId} className="sr-only" aria-live="assertive" aria-atomic="true">
          Re-authentication required
        </div>

        <header className="confirm-dialog__header">
          <h2 id={titleId} className="confirm-dialog__title">
            Re-authenticate to view balances
          </h2>
          <p className="confirm-dialog__subtitle">
            For your security, we need to verify your wallet connection again.
          </p>
        </header>

        <div id={descId} className="confirm-dialog__body">
          <div className="confirm-dialog__description">
            Your session has expired. Please reconnect your wallet to continue.
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
            variant="primary"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            onClick={handleConfirm}
            aria-disabled={isSubmitting}
          >
            Reconnect Wallet
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
