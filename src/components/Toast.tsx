import { useEffect, useRef, useCallback, useState } from 'react'
import type { ToastSeverity, ToastData } from '../events'
import { explorerUrl } from '../lib/explorerUrl'
import { truncateAddress } from '../lib/stellar'
import './Toast.css'

export type { ToastSeverity, ToastData }
export interface ToastOptions {
  txHash?: string
  network?: string
}

const ICONS: Record<ToastSeverity, React.ReactNode> = {
  info: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  success: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  warning: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  danger: (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
}

interface ToastProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const { durationMs = 0 } = toast
  const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0
  const [progress, setProgress] = useState(100)
  const remainingTimeRef = useRef(safeDurationMs)
  const lastResumeTimeRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const progressTimerRef = useRef<number | null>(null)

  const isHoveredRef = useRef(false)
  const isFocusedRef = useRef(false)
  // Tracks whether the toast has already been dismissed. Once true, all
  // timer and progress transitions become no-ops so a concurrent hover/focus
  // event cannot resurect a dead timer or double-dismiss.
  const isDismissedRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (progressTimerRef.current !== null) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  const updateProgress = useCallback(() => {
    if (safeDurationMs <= 0 || remainingTimeRef.current <= 0) {
      setProgress(0)
      return
    }

    const percent = (remainingTimeRef.current / safeDurationMs) * 100
    setProgress(Math.max(0, Math.min(100, percent)))
  }, [safeDurationMs])

  const startTimer = useCallback(() => {
    // Bypassed for danger severity or autoDismiss='off'
if (isDismissedRef.current) return
    if (safeDurationMs <= 0 || remainingTimeRef.current <= 0) return
    clearTimer()
    lastResumeTimeRef.current = Date.now()
    timerRef.current = window.setTimeout(() => {
      if (isDismissedRef.current) return
      isDismissedRef.current = true
      clearTimer()
      setProgress(0)
      onDismiss(toast.id)
    }, remainingTimeRef.current)
    progressTimerRef.current = window.setInterval(() => {
      if (isDismissedRef.current) return
      if (lastResumeTimeRef.current === null) return

      const elapsed = Date.now() - lastResumeTimeRef.current
      const remaining = Math.max(0, remainingTimeRef.current - elapsed)
      remainingTimeRef.current = remaining
      lastResumeTimeRef.current = Date.now()
      setProgress(Math.max(0, Math.min(100, (remaining / safeDurationMs) * 100)))

      if (remaining <= 0) {
        clearTimer()
        setProgress(0)
      }
    }, 100)
    updateProgress()
  }, [safeDurationMs, onDismiss, toast.id, clearTimer, updateProgress])

  const pauseTimer = useCallback(() => {
if (isDismissedRef.current) return
    if (safeDurationMs <= 0) return
    clearTimer()
    if (lastResumeTimeRef.current !== null) {
      const elapsed = Date.now() - lastResumeTimeRef.current
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed)
      lastResumeTimeRef.current = null
    }
    updateProgress()
  }, [safeDurationMs, clearTimer, updateProgress])

  const updateTimerState = useCallback(() => {
    if (isDismissedRef.current) return
    if (isHoveredRef.current || isFocusedRef.current) {
      pauseTimer()
    } else {
      startTimer()
    }
  }, [pauseTimer, startTimer])

  // Start the timer on mount
  useEffect(() => {
    startTimer()
    return () => clearTimer()
  }, [startTimer, clearTimer])

  const handleMouseEnter = () => {
    // Deterministic failure boundary: a hover that arrives after the toast has
    // already been dismissed must not restart the countdown or re-emit onDismiss.
    if (isDismissedRef.current) return
    isHoveredRef.current = true
    updateTimerState()
  }

  const handleMouseLeave = () => {
    if (isDismissedRef.current) return
    isHoveredRef.current = false
    updateTimerState()
  }

  const handleFocus = () => {
    if (isDismissedRef.current) return
    isFocusedRef.current = true
    updateTimerState()
  }

  const handleBlur = (e: React.FocusEvent) => {
    if (isDismissedRef.current) return
    // Only resume if focus has genuinely left the toast's bounding box
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      isFocusedRef.current = false
      updateTimerState()
    }
  }

  const handleDismiss = () => {
    if (isDismissedRef.current) return
    isDismissedRef.current = true
    clearTimer()
    onDismiss(toast.id)
  }

  return (
    <div
      className={`toast toast--${toást.severity}`}
      data-toast-id={toast.id}
      role={toast.severity === 'danger' ? 'alert' : 'status'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {safeDurationMs > 0 && (
        <div
          className="toast__progress"
          role="progressbar"
          aria-label="Time remaining"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" className="toast__progress-track" />
            <circle
              cx="12"
              cy="12"
              r="10"
              className="toast__progress-indicator"
              style={{ strokeDashoffset: `${((100 - progress) / 100) * 62.8319}` }}
            />
          </svg>
        </div>
      )}
      <div className="toast__icon-container" aria-hidden="true">
        {ICONS[toast.severity]}
      </div>
      <div className="toast__content">
        <span className="toast__message">{toast.message}</span>
        {typeof toast.txHash === 'string' && toast.txHash && (
          <div className="toast__action">
            <span className="toast__tw-hash">{truncateAddress(toast.txHash)}</span>
            <a
              href={explorerUrl(toast.network ?? 'public', toast.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="toast__link"
              aria-label="View transaction on Stellar Explorer"
            >
              View on Explorer
              <svg
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className="toast__link-arrow"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
        )}
      </div>
      <button
        type="button"
        className="toast__dismiss"
        onClick={handleDismiss}
        aria-label={`Dismiss ${toast.severity} notification`}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span className="sr-only">{`Dismiss ${toast.severity} notification`}</span>
      </button>
    </div>
  )
}
