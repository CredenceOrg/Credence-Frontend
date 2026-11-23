import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useScrollPreserver } from '../hooks/useScrollPreserver'
import { useWallet } from '../context/WalletContext'
import { FREIGHTER_INSTALL_URL } from '../lib/freighterClient'
import Button from './Button'
import './ConnectWalletModal.css'

/**
 * Deterministic modal states adhering to failure boundary coverage requirements:
 * - `idle`: Initial ready state
 * - `loading`: Asynchronous connection attempt in flight
 * - `error`: General connection failure or missing extension
 * - `stale`: Stale session, expired auth, or network mismatch requiring synchronization
 * - `permission`: User rejected access or permission denied
 * - `success`: Successfully connected, triggers auto-close
 */
export type WalletModalState = 'idle' | 'loading' | 'error' | 'stale' | 'permission' | 'success'

export type WalletErrorKind = 'not_installed' | 'permission' | 'stale' | 'unknown'

export interface ErrorClassification {
  state: WalletModalState
  kind: WalletErrorKind
  message: string
}

/**
 * Sanitizes an error message by stripping sensitive tokens, credentials,
 * and Stellar secret keys (starts with 'S' followed by 55 characters) to
 * prevent leakage in telemetry, DOM alerts, or logs.
 */
export function sanitizeErrorMessage(raw: unknown): string {
  if (typeof raw !== 'string') {
    if (!raw) return ''
    try {
      raw = String(raw)
    } catch {
      return ''
    }
  }
  return (raw as string)
    .replace(/\bS[A-Z0-9]{55}\b/g, '[REDACTED_SECRET]')
    .replace(/\b(bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]')
    .replace(/(?:password|secret|token|api_?key)\s*[:=]\s*[^\s,]+/gi, '[REDACTED]')
    .trim()
}

/**
 * Deterministically classifies errors into state, kind, and user-facing message.
 *
 * Invariants:
 * 1. Missing extension is classified as `error` / `not_installed`.
 * 2. User rejections, permission denials, or unauthorized responses become `permission`.
 * 3. Network mismatches, stale data/session errors become `stale`.
 * 4. General unexpected errors become `error` with a sanitized description.
 * 5. Output message is always non-empty and sanitized against secret leakage.
 */
export function classifyWalletError(err: unknown): ErrorClassification {
  if (!err) {
    return {
      state: 'error',
      kind: 'unknown',
      message: 'An unknown wallet connection error occurred. Please try again.',
    }
  }

  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    const code = String(obj.code || '').toLowerCase()
    const name = String(obj.name || '')
    const rawMsg = typeof obj.message === 'string' ? obj.message : ''
    const lowerMsg = rawMsg.toLowerCase()

    if (code === 'not_installed') {
      return {
        state: 'error',
        kind: 'not_installed',
        message: 'Freighter is not installed. Add the Freighter extension to your browser and try again.',
      }
    }

    if (
      code === 'rejected' ||
      code === 'permission_denied' ||
      name === 'PermissionError' ||
      lowerMsg.includes('declined') ||
      lowerMsg.includes('permission') ||
      lowerMsg.includes('unauthorized') ||
      lowerMsg.includes('user rejected')
    ) {
      return {
        state: 'permission',
        kind: 'permission',
        message: 'Connection request was declined in Freighter. Click Connect to try again.',
      }
    }

    if (
      code === 'stale' ||
      code === 'stale_session' ||
      code === 'network_mismatch' ||
      name === 'StaleDataError' ||
      name === 'StaleSessionError' ||
      lowerMsg.includes('stale') ||
      lowerMsg.includes('network mismatch') ||
      lowerMsg.includes('expired')
    ) {
      return {
        state: 'stale',
        kind: 'stale',
        message: 'Wallet session is stale or network configuration changed. Please reconnect to synchronize.',
      }
    }

    if (rawMsg) {
      return {
        state: 'error',
        kind: 'unknown',
        message: sanitizeErrorMessage(rawMsg),
      }
    }
  }

  const stringMsg = sanitizeErrorMessage(err)
  return {
    state: 'error',
    kind: 'unknown',
    message: stringMsg || 'Failed to connect wallet. Please try again.',
  }
}

export interface ConnectWalletModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback fired to close the modal */
  onClose: () => void
  /**
   * Element to return focus to when the modal closes.
   * When omitted, focus returns to the element that was active before the modal opened.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>
  /**
   * Optional custom connection request handler.
   * If provided, overrides default wallet.connect() and runs within the deterministic failure boundary.
   */
  onConnectRequest?: () => Promise<void>
  /** Optional callback fired when connection completes successfully */
  onSuccess?: () => void
  /** Optional callback fired when connection fails */
  onError?: (error: unknown) => void
}

/**
 * Backward-compatible alias for existing dialog callers
 */
export type ConnectWalletDialogProps = ConnectWalletModalProps

/**
 * ConnectWalletModal — Production-ready modal dialog for connecting Freighter wallet
 * with deterministic failure-boundary coverage.
 *
 * Core Invariants:
 * 1. Deterministic State Transitions: Covers `idle`, `loading`, `error`, `stale`, and `permission`.
 * 2. Concurrency & Race-Condition Protection: Sequence numbering (`requestSeqRef`) ensures stale
 *    async resolutions are discarded and duplicate concurrent invocations are rejected.
 * 3. Safe Cancellation: Disables close and cancel actions during active connection to avoid
 *    leaving asynchronous processes in an indeterminate state.
 * 4. Privacy & Security: All error messages pass through `sanitizeErrorMessage` to strip secrets.
 * 5. Full Backward Compatibility: Compatible with `ConnectWalletDialogProps` and portal/focus-trap behaviors.
 */
export default function ConnectWalletModal({
  open,
  onClose,
  returnFocusRef,
  onConnectRequest,
  onSuccess,
  onError,
}: ConnectWalletModalProps) {
  const { connect, isConnecting: walletIsConnecting, error: walletError, isConnected } = useWallet()

  const [modalState, setModalState] = useState<WalletModalState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<WalletErrorKind | null>(null)

  const titleId = useId()
  const descId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isMountedRef = useRef(true)
  const requestSeqRef = useRef(0)

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Fail-closed input validation: open must be strictly truthy
  const isOpen = Boolean(open)

  // Synchronize wallet context errors when no custom request handler is provided
  useEffect(() => {
    if (walletError && !onConnectRequest && isOpen) {
      const classification = classifyWalletError(walletError)
      setModalState(classification.state)
      setErrorKind(classification.kind)
      setErrorMessage(classification.message)
    }
  }, [walletError, onConnectRequest, isOpen])

  // Synchronize wallet connecting flag
  useEffect(() => {
    if (walletIsConnecting && !onConnectRequest && isOpen) {
      setModalState('loading')
      setErrorMessage(null)
      setErrorKind(null)
    }
  }, [walletIsConnecting, onConnectRequest, isOpen])

  // Reset state and invalidate any in-flight requests on modal close
  useEffect(() => {
    if (!isOpen) {
      requestSeqRef.current++
      setModalState('idle')
      setErrorMessage(null)
      setErrorKind(null)
    }
  }, [isOpen])

  // Auto-close when wallet connects successfully
  useEffect(() => {
    if (isConnected && isOpen) {
      if (typeof onClose === 'function') {
        onClose()
      }
    }
  }, [isConnected, isOpen, onClose])

  useScrollPreserver({ isActive: isOpen })

  const isConnectingOrLoading = modalState === 'loading' || walletIsConnecting

  const handleClose = useCallback(() => {
    // Invariant: Do not allow closing mid-flight while connecting to avoid inconsistent state
    if (isConnectingOrLoading) return
    if (typeof onClose === 'function') {
      onClose()
    }
  }, [isConnectingOrLoading, onClose])

  useFocusTrap({
    containerRef: dialogRef,
    isActive: isOpen,
    initialFocusRef: cancelRef,
    returnFocusRef,
    onEscape: handleClose,
  })

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose()
    }
  }

  const executeConnect = useCallback(async () => {
    // Invariant: Concurrent requests are prevented while a connection is in flight
    if (isConnectingOrLoading) return

    const seq = ++requestSeqRef.current

    setModalState('loading')
    setErrorMessage(null)
    setErrorKind(null)

    try {
      if (onConnectRequest) {
        await onConnectRequest()
      } else {
        await connect()
      }

      // Concurrency check: discard result if a newer request was dispatched,
      // modal was closed, or component unmounted
      if (seq !== requestSeqRef.current || !isMountedRef.current || !isOpen) return

      setModalState('idle')
      onSuccess?.()
    } catch (err: unknown) {
      if (seq !== requestSeqRef.current || !isMountedRef.current || !isOpen) return

      const classification = classifyWalletError(err)
      setModalState(classification.state)
      setErrorKind(classification.kind)
      setErrorMessage(classification.message)

      onError?.(err)
    }
  }, [isConnectingOrLoading, onConnectRequest, connect, isOpen, onSuccess, onError])

  if (!isOpen) return null

  // Determine effective display error
  let displayErrorMessage = errorMessage
  if (!displayErrorMessage && walletError && !onConnectRequest) {
    const classification = classifyWalletError(walletError)
    displayErrorMessage = classification.message
  }

  const showErrorBox =
    Boolean(displayErrorMessage) &&
    (modalState === 'error' || modalState === 'permission' || modalState === 'stale')

  return createPortal(
    <div className="connect-wallet-dialog__backdrop" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="connect-wallet-dialog"
        onClick={(e) => e.stopPropagation()}
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

          {showErrorBox && (
            <div
              role="alert"
              aria-live="assertive"
              className={`connect-wallet-dialog__error connect-wallet-dialog__error--${modalState}`}
              data-testid="wallet-error-alert"
              data-state={modalState}
            >
              <div className="connect-wallet-dialog__error-content">
                <span>{displayErrorMessage}</span>
                {errorKind === 'not_installed' && (
                  <a
                    href={FREIGHTER_INSTALL_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="connect-wallet-dialog__install-link"
                  >
                    Install Freighter
                  </a>
                )}
              </div>
              <div className="connect-wallet-dialog__error-actions">
                <button
                  type="button"
                  className="connect-wallet-dialog__retry-button"
                  onClick={executeConnect}
                  disabled={isConnectingOrLoading}
                  aria-label="Retry connection"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="connect-wallet-dialog__footer">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isConnectingOrLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={executeConnect}
            isLoading={isConnectingOrLoading}
          >
            Connect
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  )
}

export { ConnectWalletModal }
export const ConnectWalletDialog = ConnectWalletModal
