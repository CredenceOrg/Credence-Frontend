import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useScrollPreserver } from '../hooks/useScrollPreserver'
import { useWallet } from '../context/WalletContext'
import Button from './Button'
import './ConnectWalletDialog.css'

export interface ConnectWalletDialogProps {
  open: boolean
  onClose: () => void
  /**
   * Element to return focus to when the dialog closes.
   * When omitted, focus returns to the element that was active before the dialog opened.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * Dialog that explains the wallet connection step and surfaces
 * connection status (connecting, error) without losing the user's focus context.
 *
 * - Portal-rendered into document.body.
 * - Uses the native <dialog> element with showModal().
 * - Focus is trapped inside while open; returned to returnFocusRef on close.
 * - Escape and backdrop click close the dialog.
 * - Body scroll is locked while open.
 * - Entrance animation is suppressed when prefers-reduced-motion: reduce is set.
 * - Auto-closes when the wallet connects successfully.
 */
export default function ConnectWalletDialog({
  open,
  onClose,
  returnFocusRef,
}: ConnectWalletDialogProps) {
  const { connect, isConnecting, error, isConnected } = useWallet()

  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Auto-close when wallet connects successfully
  useEffect(() => {
    if (isConnected && open) {
      onClose()
    }
  }, [isConnected, open, onClose])

  // Open/close the native dialog element
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      try {
        dialog.showModal()
      } catch {
        // dialog is already open
      }
    } else {
      dialog.close()
    }
  }, [open])

  // Handle native cancel event (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleNativeCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', handleNativeCancel)
    return () => dialog.removeEventListener('cancel', handleNativeCancel)
  }, [onClose])

  useScrollPreserver({ isActive: open })

  useFocusTrap({
    containerRef: dialogRef as React.RefObject<HTMLElement | null>,
    isActive: open,
    initialFocusRef: cancelRef,
    returnFocusRef,
    onEscape: undefined,
  })

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const handleConnect = useCallback(() => {
    void connect()
  }, [connect])

  if (!open) return null

  let errorMessage: string | null = null
  if (error) {
    if (error.code === 'not_installed') {
      errorMessage =
        'Freighter is not installed. Add the Freighter extension to your browser and try again.'
    } else if (error.code === 'rejected') {
      errorMessage = 'Connection request was declined in Freighter. Click Connect to try again.'
    } else {
      errorMessage = error.message
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="connect-wallet-dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClick={handleBackdropClick}
    >
      <header className="connect-wallet-dialog__header">
        <h2 id={titleId} className="connect-wallet-dialog__title">
          Connect Freighter Wallet
        </h2>
      </header>

      <div className="connect-wallet-dialog__body">
        <p id={descId} className="connect-wallet-dialog__description">
          Freighter is a Stellar wallet browser extension. Clicking <strong>Connect</strong> will
          open the Freighter extension and ask you to approve access for this session.
        </p>

        {errorMessage && (
          <div role="alert" className="connect-wallet-dialog__error">
            {errorMessage}
          </div>
        )}
      </div>

      <footer className="connect-wallet-dialog__footer">
        <Button
          ref={cancelRef}
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={isConnecting}
        >
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={handleConnect} isLoading={isConnecting}>
          Connect
        </Button>
      </footer>
    </dialog>,
    document.body
  )
}