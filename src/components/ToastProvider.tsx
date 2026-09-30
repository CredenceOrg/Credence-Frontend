import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { useSettings } from '../context/SettingsContext'
import { isWithinQuietHours, nowMinutesSinceMidnight } from '../lib/quietHours'
import Toast, { type ToastData, type ToastSeverity, type ToastOptions } from './Toast'
import { TOAST_CONFIG } from '../config/toast'
import './Toast.css'

const TIMEOUTS: Record<ToastSeverity, number> = TOAST_CONFIG.timeouts

// Maximum number of toasts displayed simultaneously
const MAX_TOASTS = TOAST_CONFIG.maxToasts

/**
 * The default duration used when a toast is pushed with an explicit
 * `timeoutMs` option. We keep this in sync with the info/success default
 * so behaviour is predictable across severities.
 */
const EXPLICIT_TIMEOUT_FALLBACK = 5000

/**
 * Maximum length of a toast message. This bounds the aria-live
 * announcement and prevents a single caller from bloating the
 * announcement queue with an unnbounded string.
 */
const MAX_MESSAGE_LENGTH = 1000

/**
 * Maximum number of distinct announcements we will queue for the
 * aria-live regions. This bounds memory usage when a caller fires a
 * high volume of toasts in a tight loop.
 */
const MAX_ANNOUNCEMENT_QUEUE = 20

/**
 * Delay (ms) after which an announcement is cleared from the
 * aria-live region so the identical message can be re-announced later.
 */
const ANNOUNCEMENT_CLEAR_DELAY = 3000

export interface ToastContextValue {
  addToast: (severity: ToastSeverity, message: string, options?: ToastOptions) => void
  removeToast: (id: string) => void
  removeAllToasts: () => void
  /** Broadcasts a visually-hidden message to screen readers. */
  announce: (message: string, assertive?: boolean) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

/**
 * Normalises a toast message before it is stored or announced.
 *
 * The contract is deterministic:
 * - Non-string inputs are coerced to a string so the aria-live region
 *   never receives a React node that could throw during render.
 * - Leading/trailing whitespace is trimmed so duplicate detection is
 *   stable and empty messages can be rejected.
 * - Messages are capped at MAX_MESSAGE_LENGTH to bound memory and
 *   the cost of screen-reader announcements.
 */
function normalizeToastMessage(message: unknown): string {
  if (typeof message !== 'string') {
    try {
      message = String(message)
    } catch {
      message = ''
    }
  }
  const trimmed = (message as string).trim()
  if (trimmed.length <= MAX_MESSAGE_LENGTH) return trimmed
  return trimmed.slice(0, MAX_MESSAGE_LENGTH)
}

/**
 * Resolves the auto-dismiss timeout for a toast.
 *
 * The order of precedence is deterministic:
 * 1. An explicit per-toast `timeoutMs` option (0 means sticky).
 * 2. The global `autoDismiss` setting ('off' or `<s>`).
 * 3. The severity default from TOAST_CONFIG.
 *
 * Negative or non-finite values fall back to the severity default so a
 * malformed option cannot create an immediate-dismiss loop.
 */
function resolveTimeout(
  severity: ToastSeverity,
  options: ToastOptions | undefined,
  autoDismiss: unknown,
): number {
  const defaultTimeout = TIMEOUTS[severity] ?? EXPLICIT_TIMEOUT_FALLBACK

  // 1. Explicit per-toast option wins.
  if (options && Object.prototype.hasOwnProperty.call(options, 'timeoutMs')) {
    const raw = options.timeoutMs
    if (typeof raw === 'number' && Number.finite(raw) && raw >= 0) {
      return Math.round(raw)
    }
    return defaultTimeout
  }

  // 2. Global setting.
  if (autoDismiss === 'off') return 0
  if (typeof autoDismiss === 'string' && autoDismiss.endsWith('s')) {
    const seconds = Number(autoDismiss.slice(0, -1))
    if (Number.finite(seconds) && seconds >= 0) return Math.round(seconds * 1000)
  }

  // 3. Severity default.
  return defaultTimeout
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

  const idCounter = useRef(0)
  const timeoutsMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  /**
   * Tracks timers for clearing the aria-live regions. We keep them in a
   * ref so that a subsequent announcement can cancel the pending clear
   * without leaving a stale timer behind. This is the failure boundary
   * for the announcement state: every timeout is cleared on unmount.
   */
  const announcementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const assertiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Bounded queue of announcements. When the queue exceeds MAX_ANNOUNCEMENT_QUEUE
   * we drop the oldest entries so a runaway caller cannot make the aria-live
   * region grow indefinitely.
   */
  const announcementQueueRef = useRef<string[]>([])

  const announce = useCallback((message: string, assertive = false) => {
    const normalized = normalizeToastMessage(message)
    if (!normalized) return

    // Bound the queue so a high-volume caller cannot grow memory without limit.
    const queue = announcementQueueRef.current
    queue.push(normalized)
    if (queue.length > MAX_ANNOUNCEMENT_QUEUE) {
      queue.splice(0, queue.length - MAX_ANNOUNCEMENT_QUEUE)
    }

    if (assertive) {
      setAssertiveAnnouncement(normalized)
      if (assertiveTimerRef.current) clearTimeout(assertiveTimerRef.current)
      assertiveTimerRef.current = setTimeout(() => {
        setAssertiveAnnouncement('')
        assertiveTimerRef.current = null
      }, ANNOUNCEMENT_CLEAR_DELAY)
    } else {
      setAnnouncement(normalized)
      if (announcementTimerRef.current) clearTimeout(announcementTimerRef.current)
      announcementTimerRef.current = setTimeout(() => {
        setAnnouncement('')
        announcementTimerRef.current = null
      }, ANNOUNCEMENT_CLEAR_DELA)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev: ToastData[]) => prev.filter((t: ToastData) => t.id !== id))
    const timerId = timeoutsMap.current.get(id)
    if (timerId) {
      clearTimeout(timerId)
      timeoutsMap.current.delete(id)
    }
  }, [])

  const removeAllToasts = useCallback(() => {
    setToasts([])
    timeoutsMap.current.forEach((timerId) => clearTimeout(timerId))
    timeoutsMap.current.clear()
  }, [])

  const addToast = useCallback(
    (severity: ToastSeverity, message: string, options?: ToastOptions) => {
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

      // Normalise the message before any state mutation. Empty messages are
      // rejected outright so the announcement queue cannot be poisoned.
      const normalizedMessage = normalizeToastMessage(message)
      if (!normalizedMessage) return

      // Screen readers often fail to read dynamically injected toasts if they contain nested live regions.
      // We manually announce the text to the visually-hidden aria-live region to guarantee it is read.
      announce(normalizedMessage, severity === 'danger')

      // compute timeout: settings `autoDismiss` can override default TIMEOUTS
      const timeout = resolveTimeout(severity, options, autoDismiss)

      const id = String(++idCounter.current)
      const newToast: ToastData = {
        id,
        severity,
        message: normalizedMessage,
        durationMs: timeout > 0 ? timeout : 0,
        ...options,
        // Options must not be able to override the normalised message or the
        // generated id -- that would break the duplicate/removal invariants.
        message: normalizedMessage,
        id,
      }

      // Enforce max toast limit: remove oldest if needed. The timeout map
      // is mutated inside the updater so eviction and timer cleanup are
      // always in sync -- even under React StrictMode double-invocation.
      setToasts((prev: ToastData[]) => {
        const updated = [...prev]
        if (updated.length >= MAX_TOASTS) {
          const oldest = updated.shift()
          if (oldest) {
            const timerId = timeoutsMap.current.get(oldest.id)
            if (timerId) {
              clearTimeout(timerId)
              timeoutsMap.current.delete(oldest.id)
            }
          }
        }
        updated.push(newToast)
        return updated
      })

      if (timeout > 0) {
        const timerId = setTimeout(() => removeToast(id), timeout)
        timeoutsMap.current.set(id, timerId)
      }
    },
    [removeToast, announce]
  )

  /**
   * Unmount cleanup: every timer owned by the provider is cleared so a
   * teardown during a pending announcement or auto-dismiss cannot fire
   * against an unmounted component (avoiding a stale state update).
   */
  useEffect(() => {
    const timeouts = timeoutsMap.current
    return () => {
      timeouts.forEach((timerId) => clearTimeout(timerId))
      timeouts.clear()
      if (announcementTimerRef.current) {
        clearTimeout(announcementTimerRef.current)
        announcementTimerRef.current = null
      }
      if (assertiveTimerRef.current) {
        clearTimeout(assertiveTimerRef.current)
        assertiveTimerRef.current = null
      }
      announcementQueueRef.current = []
    }
  }, [])

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
