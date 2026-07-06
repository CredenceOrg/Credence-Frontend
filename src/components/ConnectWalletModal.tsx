import { useCallback, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useWallet } from '../context/WalletContext'
import Button from './Button'
import './ConnectWalletModal.css'

export interface ConnectWalletModalProps {
  open: boolean
  onClose: () => void
  /**
   * Element to return focus to when the modal closes.
   * When omitted, focus returns to the element that was active before the modal opened.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

/**
 * Modal dialog that explains the wallet connection step and surfaces
 * connection status (connecting, error) without losing the user's focus context.
 *
 * - Portal-rendered into document.body.
 * - Focus is trapped inside while open; returned to returnFocusRef on close.
 * - Escape and backdrop click close the modal.
 * - Body scroll is locked while open.
 * - Entrance animation is suppressed when prefers-reduced-motion: reduce is set.
 * - Auto-closes when the wallet connects successfully.
 */
export default function ConnectWalletModal({
  open,
  onClose,
  returnFocusRef,
}: ConnectWalletModalProps) {
  const { connect, isConnecting, error, isConnected } = useWallet()

  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Auto-close when wallet connects successfully
  useEffect(() => {
    if (isConnected && open) {
      onClose()
    }
  }, [isConnected, open, onClose])

  useFocusTrap({
    containerRef: dialogRef,
    isActive: open,
    initialFocusRef: cancelRef,
    returnFocusRef,
    onEscape: onClose,
  })

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
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
    <div
      className="connect-wallet-modal__backdrop"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="connect-wallet-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="connect-wallet-modal__header">
          <h2 id={titleId} className="connect-wallet-modal__title">
            Connect Freighter Wallet
          </h2>
        </header>

        <div className="connect-wallet-modal__body">
          <p id={descId} className="connect-wallet-modal__description">
            Freighter is a Stellar wallet browser extension. Clicking{' '}
            <strong>Connect</strong> will open the Freighter extension and ask
            you to approve access for this session.
          </p>

          {errorMessage && (
            <div role="alert" className="connect-wallet-modal__error">
              {errorMessage}
            </div>
          )}
        </div>

        <footer className="connect-wallet-modal__footer">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConnect}
            isLoading={isConnecting}
          >
            Connect
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
