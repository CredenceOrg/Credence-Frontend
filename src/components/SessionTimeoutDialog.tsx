import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import ConfirmDialog from './ConfirmDialog'

const EXTENSION_ERROR_MESSAGE = 'Unable to extend your session. Please retry or sign out.'

export interface SessionTimeoutDialogProps {
  open: boolean
  onStayLoggedIn: () => void | Promise<void>
  onLogout: () => void
  timeLeftSeconds: number
}

function normalizeTimeLeft(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0
}

/**
 * Modal shown when the user's session is about to expire due to inactivity.
 */
export default function SessionTimeoutDialog({
  open,
  onStayLoggedIn,
  onLogout,
  timeLeftSeconds,
}: SessionTimeoutDialogProps) {
  const [internalTimeLeft, setInternalTimeLeft] = useState(() =>
    normalizeTimeLeft(timeLeftSeconds)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [extensionError, setExtensionError] = useState<string | null>(null)
  // Lock before awaiting so repeated clicks cannot overlap session extensions.
  const submissionInFlight = useRef(false)

  // A reopened dialog represents the current timeout window, not the previous
  // one. Clamp invalid values so the countdown never displays NaN or negatives.
  useEffect(() => {
    setInternalTimeLeft(normalizeTimeLeft(timeLeftSeconds))
  }, [open, timeLeftSeconds])

  useEffect(() => {
    setExtensionError(null)
  }, [open])

  useEffect(() => {
    if (!open || internalTimeLeft <= 0) return

    const timer = setInterval(() => {
      setInternalTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [open, internalTimeLeft])

  const handleStayLoggedIn = async () => {
    if (submissionInFlight.current) return

    submissionInFlight.current = true
    setIsSubmitting(true)
    setExtensionError(null)
    try {
      await onStayLoggedIn()
    } catch {
      // Keep implementation details (tokens, URLs, provider messages) out of
      // the dialog while giving the user a clear retry or logout path.
      setExtensionError(EXTENSION_ERROR_MESSAGE)
    } finally {
      submissionInFlight.current = false
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <ConfirmDialog
      open={open}
      title="Session Timeout Warning"
      subtitle={`Your session will expire in ${internalTimeLeft} seconds due to inactivity.`}
      onConfirm={handleStayLoggedIn}
      onCancel={onLogout}
      confirmLabel="Stay logged in"
      confirmPhrase="STAY"
      confirmHint="Press the button above to extend your session."
      variant="info"
      isSubmitting={isSubmitting}
      confirmInputLabel={
        <>
          Type <strong>STAY</strong> to remain logged in
        </>
      }
    >
      {extensionError && (
        <div role="alert" className="confirm-dialog__error">
          <p>{extensionError}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={handleStayLoggedIn}
            disabled={isSubmitting}
          >
            Retry
          </Button>
        </div>
      )}
      <div
        style={{
          padding: 'var(--credence-space-4)',
          background: 'var(--credence-color-warning-surface)',
          border: '1px solid var(--credence-color-warning-border)',
          borderRadius: 'var(--credence-radius-md)',
          color: 'var(--credence-color-warning-text)',
          fontSize: 'var(--credence-font-size-sm)',
          marginBottom: 'var(--credence-space-4)',
        }}
      >
        For your security, you are automatically logged out after a period of inactivity. Any
        unsaved changes may be lost.
      </div>
    </ConfirmDialog>
  )
}
