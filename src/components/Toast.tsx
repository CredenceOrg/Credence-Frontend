import { useEffect, useRef, useCallback } from 'react'
import './Toast.css'

export type ToastSeverity = 'info' | 'success' | 'warning' | 'danger'

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

export interface ToastData {
  id: string
  severity: ToastSeverity
  message: string
  /** Resolved auto-dismiss duration. 0 means manual dismiss only. */
  durationMs?: number
}

interface ToastProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const { durationMs = 0 } = toast
  const remainingTimeRef = useRef(durationMs)
  const lastResumeTimeRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  
  const isHoveredRef = useRef(false)
  const isFocusedRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    // Bypassed for danger severity or autoDismiss='off'
    if (durationMs <= 0 || remainingTimeRef.current <= 0) return
    clearTimer()
    lastResumeTimeRef.current = Date.now()
    timerRef.current = window.setTimeout(() => {
      onDismiss(toast.id)
    }, remainingTimeRef.current)
  }, [durationMs, onDismiss, toast.id, clearTimer])

  const pauseTimer = useCallback(() => {
    if (durationMs <= 0) return
    clearTimer()
    if (lastResumeTimeRef.current !== null) {
      const elapsed = Date.now() - lastResumeTimeRef.current
      remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed)
      lastResumeTimeRef.current = null
    }
  }, [durationMs, clearTimer])

  const updateTimerState = useCallback(() => {
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
    isHoveredRef.current = true
    updateTimerState()
  }

  const handleMouseLeave = () => {
    isHoveredRef.current = false
    updateTimerState()
  }

  const handleFocus = () => {
    isFocusedRef.current = true
    updateTimerState()
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Only resume if focus has genuinely left the toast's bounding box
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      isFocusedRef.current = false
      updateTimerState()
    }
  }

  return (
    <div
      className={`toast toast--${toast.severity}`}
      role={toast.severity === 'danger' ? 'alert' : 'status'}
    >
      <div className="toast__icon-container" aria-hidden="true">
        {ICONS[toast.severity]}
      </div>
      <div className="toast__content">
        <span className="toast__message">{toast.message}</span>
        {toast.txHash && (
          <div className="toast__tx-meta" style={{ display: 'flex', alignItems: 'center', gap: 'var(--credence-space-2)', marginTop: 'var(--credence-space-2)', fontSize: '0.875rem' }}>
            <button
              type="button"
              onClick={handleCopy}
              className="toast__copy-btn"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--credence-radius-sm)',
                padding: 'var(--credence-space-1) var(--credence-space-2)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              aria-live="polite"
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>{truncateHash(toast.txHash)}</span>
                </>
              )}
            </button>
            <a
              href={getExplorerTxUrl(toast.network || 'public', toast.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="toast__explorer-link"
              style={{
                color: 'var(--brand-primary)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              View on explorer
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        )}
      </div>
      <button
        type="button"
        className="toast__dismiss"
        onClick={() => onDismiss(toast.id)}
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
      </button>
    </div>
  )
}
