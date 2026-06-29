import { useEffect, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

export interface SessionTimeoutModalProps {
  open: boolean
  onStayLoggedIn: () => void
  onLogout: () => void
  timeLeftSeconds: number
}

/**
 * Modal shown when the user's session is about to expire due to inactivity.
 */
export default function SessionTimeoutModal({
  open,
  onStayLoggedIn,
  onLogout,
  timeLeftSeconds,
}: SessionTimeoutModalProps) {
  const [internalTimeLeft, setInternalTimeLeft] = useState(timeLeftSeconds)

  useEffect(() => {
    setInternalTimeLeft(timeLeftSeconds)
  }, [timeLeftSeconds])

  useEffect(() => {
    if (!open || internalTimeLeft <= 0) return

    const timer = setInterval(() => {
      setInternalTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearInterval(timer)
  }, [open, internalTimeLeft])

  if (!open) return null

  return (
    <ConfirmDialog
      open={open}
      title="Session Timeout Warning"
      subtitle={`Your session will expire in ${internalTimeLeft} seconds due to inactivity.`}
      onConfirm={onStayLoggedIn}
      onCancel={onLogout}
      confirmLabel="Stay logged in"
      confirmPhrase="STAY"
      confirmHint="Press the button above to extend your session."
      variant="info"
      confirmInputLabel={
        <>
          Type <strong>STAY</strong> to remain logged in
        </>
      }
    >
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
