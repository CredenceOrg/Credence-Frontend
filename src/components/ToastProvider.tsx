import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { useSettings } from '../context/SettingsContext'
import { isWithinQuietHours, nowMinutesSinceMidnight } from '../lib/quietHours'
import Toast, { type ToastData, type ToastSeverity, type ToastOptions } from './Toast'
import { TOAST_CONFIG } from '../config/toast'
import './Toast.css'

const TIMEOUTS: Record<ToastSeverity, number> = TOAST_CONFIG.timeouts

// Maximum number of toasts displayed simultaneously
const MAX_TOASTS = TOAST_CONFIG.maxToasts

interface ToastContextValue {
  addToast: (severity: ToastSeverity, message: string, options?: ToastOptions) => void
  removeToast: (id: string) => void
  removeAllToasts: () => void
  /** Broadcasts a visually-hidden message to screen readers. */
  announce: (message: string, assertive?: boolean) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_MESSAGE_LENGTH = 1000

function normalizeToastMessage(raw: unknown): string | null {
  let message: string
  try {
    message = typeof raw === 'string' ? raw : String(raw)
  } catch {
    return null
  }
  message = message.trim()
  if (!message) return null
  return message.length > MAX_MESSAGE_LENGTH ? message.slice(0, MAX_MESSAGE_LENGTH) : message
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const { toastsEnabled, autoDismiss, quietHoursEnabled, quietHoursStart, quietHoursEnd } =
    useSettings()

  /**
   * We use a ref to track the current settings to avoid recreating `addToast`
   * on every setting change, which would cause unnecessary re-renders of consumers.
   *
   * Quiet hours are evaluated against `new Date()` at the moment `addToast`
   * fires -- there's no need for a minute-tick subscription because addToast is
   * the only call site. A user toggling settings mid-session picks up the next
   * toast naturally.
   */
  const settingsRef = useRef({
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
  })
  settingsRef.current = {
    toastsEnabled,
    autoDismiss,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
  }

  const [toasts, setToasts] = useState<ToastData[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState('')
  const toastsRef = useRef<ToastData[]>([])
  const politeAnnouncementTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const assertiveAnnouncementTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const idCounter = useRef(0)
  const timeoutsMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => () => {
    if (politeAnnouncementTimer.current !== null) clearTimeout(politeAnnouncementTimer.current)
    if (assertiveAnnouncementTimer.current !== null) clearTimeout(assertiveAnnouncementTimer.current)
    timeoutsMap.current.forEach((timerId) => clearTimeout(timerId))
    timeoutsMap.current.clear()
  }, [])

  const announce = useCallback((rawMessage: string, assertive = false) => {
    const message = normalizeToastMessage(rawMessage)
    if (message === null) return

    const timerRef = assertive ? assertiveAnnouncementTimer : politeAnnouncementTimer
    if (timerRef.current !== null) clearTimeout(timerRef.current)

    if (assertive) setAssertiveAnnouncement(message)
    else setAnnouncement(message)

    // Each live region owns one replaceable timer, so an older announcement
    // cannot clear a newer one. The effect above clears both on unmount.
    timerRef.current = setTimeout(() => {
      if (assertive) setAssertiveAnnouncement('')
      else setAnnouncement('')
      timerRef.current = null
    }, 3000)
  }, [])

  const removeToast = useCallback((id: string) => {
    toastsRef.current = toastsRef.current.filter((t: ToastData) => t.id !== id)
    setToasts(toastsRef.current)
    const timerId = timeoutsMap.current.get(id)
    if (timerId) {
      clearTimeout(timerId)
      timeoutsMap.current.delete(id)
    }
  }, [])

  const removeAllToasts = useCallback(() => {
    toastsRef.current = []
    setToasts([])
    timeoutsMap.current.forEach((timerId) => clearTimeout(timerId))
    timeoutsMap.current.clear()
  }, [])

  const addToast = useCallback(
    (severity: ToastSeverity, rawMessage: string, options?: ToastOptions) => {
      const message = normalizeToastMessage(rawMessage)
      if (message === null) return

      const { toastsEnabled, autoDismiss, quietHoursEnabled, quietHoursStart, quietHoursEnd } =
        settingsRef.current

      // respect global toast enable setting
      if (!toastsEnabled) return

      // Quiet hours: silence non-critical toasts. Critical ("danger") toasts
      // always surface so incidents and destructive failures are not lost.
      // We also skip the aria-live announcement to keep screen readers quiet
      // during the user's designated hours -- otherwise the visually-hidden
      // polite/assertive regions would still announce.
      if (
        quietHoursEnabled &&
        severity !== 'danger' &&
        isWithinQuietHours(quietHoursStart, quietHoursEnd, nowMinutesSinceMidnight())
      ) {
        return
      }

      // Screen readers often fail to read dynamically injected toasts if they contain nested live regions.
      // We manually announce the text to the visually-hidden aria-live region to guarantee it is read.
      announce(message, severity === 'danger')

      // compute timeout: settings `autoDismiss` can override default TIMEOUTS
      let timeout = TIMEOUTS[severity]
      if (timeout > 0) {
        try {
          if (autoDismiss === 'off') {
            timeout = 0
          } else if (typeof autoDismiss === 'string' && autoDismiss.endsWith('s')) {
            const seconds = Number(autoDismiss.replace('s', ''))
            if (!Number.isNaN(seconds)) timeout = seconds * 1000
          }
        } catch {
          // fallback to default
        }
      }

      // An explicit finite, non-negative timeout wins over settings. Invalid
      // values are ignored; zero means the toast remains until dismissed.
      if (
        typeof options?.timeoutMs === 'number' &&
        Number.isFinite(options.timeoutMs) &&
        options.timeoutMs >= 0
      ) {
        timeout = Math.round(options.timeoutMs)
      }

      const id = String(++idCounter.current)
      const newToast: ToastData = {
        ...options,
        id,
        severity,
        message,
        durationMs: timeout > 0 ? timeout : 0,
      }

      // Keep eviction side effects outside React state updaters, which React
      // may invoke more than once in development StrictMode.
      const updated = [...toastsRef.current]
      if (updated.length >= MAX_TOASTS) {
        const oldest = updated.shift()
        if (oldest) {
          const timerId = timeoutsMap.current.get(oldest.id)
          if (timerId !== undefined) clearTimeout(timerId)
          timeoutsMap.current.delete(oldest.id)
        }
      }
      updated.push(newToast)
      toastsRef.current = updated
      setToasts(updated)

      if (timeout > 0) {
        const timerId = setTimeout(() => removeToast(id), timeout)
        timeoutsMap.current.set(id, timerId)
      }
    },
    [removeToast, announce]
  )

  /** Toasts split by politeness: danger -> assertive; all others -> polite. */
  const politeToasts = toasts.filter((t: ToastData) => t.severity !== 'danger')
  const assertiveToasts = toasts.filter((t: ToastData) => t.severity === 'danger')

  return (
    <ToastContext.Provider value={{ addToast, removeToast, removeAllToasts, announce }}>
      {children}

      {/* Visually-hidden aria-live regions for reliable off-screen announcements (e.g. async statuses) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {assertiveAnnouncement}
      </div>

      <div className="toast-container">
        {toasts.length > 1 && (
          <button type="button" className="toast-dismiss-all" onClick={removeAllToasts}>
            Dismiss All
          </button>
        )}
        {/* Polite region: info, success, warning -- announced when the screen reader is idle */}
        <div role="region" aria-label="Notifications">
          {politeToasts.map((t: ToastData) => (
            <Toast key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </div>
        {/* Assertive region: danger -- interrupts and announces immediately */}
        <div role="region" aria-label="Error notifications">
          {assertiveToasts.map((t: ToastData) => (
            <Toast key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}
