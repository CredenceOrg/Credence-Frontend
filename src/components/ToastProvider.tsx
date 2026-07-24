import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { useSettings } from '../context/SettingsContext'
import Toast, { type ToastData, type ToastSeverity } from './Toast'
import './Toast.css'

const TIMEOUTS: Record<ToastSeverity, number> = {
  info: 5000,
  success: 5000,
  warning: 8000,
  danger: 0,
};

// Maximum number of toasts displayed simultaneously
const MAX_TOASTS = 3;


const MAX_TOASTS = 3

interface ToastContextValue {
  addToast: (severity: ToastSeverity, message: string) => void
  removeToast: (id: string) => void
  removeAllToasts: () => void
  /** Broadcasts a visually-hidden message to screen readers. */
  announce: (message: string, assertive?: boolean) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const { toastsEnabled, autoDismiss } = useSettings()

  /**
   * We use a ref to track the current settings to avoid recreating `addToast`
   * on every setting change, which would cause unnecessary re-renders of consumers.
   */
  const settingsRef = useRef({ toastsEnabled, autoDismiss })
  settingsRef.current = { toastsEnabled, autoDismiss }

  const [toasts, setToasts] = useState<ToastData[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState('')
  
  const idCounter = useRef(0)
  const timeoutsMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  
  const announce = useCallback((message: string, assertive = false) => {
    if (assertive) {
      setAssertiveAnnouncement(message)
      // Clear after a short delay so the identical message can be re-announced later if needed
      setTimeout(() => setAssertiveAnnouncement(''), 3000)
    } else {
      setAnnouncement(message)
      setTimeout(() => setAnnouncement(''), 3000)
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
    (severity: ToastSeverity, message: string) => {
      const { toastsEnabled, autoDismiss } = settingsRef.current

      // respect global toast enable setting
      if (!toastsEnabled) return
      
      // Screen readers often fail to read dynamically injected toasts if they contain nested live regions.
      // We manually announce the text to the visually-hidden aria-live region to guarantee it is read.
      announce(message, severity === 'danger')

      const id = String(++idCounter.current)
      const newToast: ToastData = { id, severity, message }

      // Enforce max toast limit: remove oldest if needed
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

      if (timeout > 0) {
        const timerId = setTimeout(() => removeToast(id), timeout)
        timeoutsMap.current.set(id, timerId)
      }
    },
    [removeToast, announce]
  )

  /** Toasts split by politeness: danger → assertive; all others → polite. */
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

      <div className="toast-container" aria-hidden="true">
        {toasts.length > 1 && (
          <button type="button" className="toast-dismiss-all" onClick={removeAllToasts}>
            Dismiss All
          </button>
        )}
        {/* Polite region: info, success, warning — announced when the screen reader is idle */}
        <div role="region" aria-label="Notifications">
          {politeToasts.map((t: ToastData) => (
            <Toast key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </div>
        {/* Assertive region: danger — interrupts and announces immediately */}
        <div role="region" aria-label="Error notifications">
          {assertiveToasts.map((t: ToastData) => (
            <Toast key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}
