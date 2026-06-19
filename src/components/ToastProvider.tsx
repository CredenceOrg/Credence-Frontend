import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { useSettings } from '../context/SettingsContext'
import Toast, { type ToastData, type ToastSeverity } from './Toast'
import './Toast.css'

const MAX_TOASTS = 3

const TIMEOUTS: Record<ToastSeverity, number> = {
  info: 5000,
  success: 5000,
  warning: 8000,
  danger: 0,
}

interface ToastContextValue {
  addToast: (severity: ToastSeverity, message: string) => void
  removeToast: (id: string) => void
  removeAllToasts: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const { toastsEnabled, autoDismiss } = useSettings()
  const [toasts, setToasts] = useState<ToastData[]>([])
  const idCounter = useRef(0)

  const removeToast = useCallback((id: string) => {
    setToasts((prev: ToastData[]) => prev.filter((t: ToastData) => t.id !== id))
  }, [])

  const removeAllToasts = useCallback(() => {
    setToasts([])
  }, [])

  const addToast = useCallback(
    (severity: ToastSeverity, message: string) => {
      // respect global toast enable setting
      if (!toastsEnabled) return
      const id = String(++idCounter.current)
      setToasts((prev: ToastData[]) => {
        const next = [...prev, { id, severity, message }]
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
      })

      // compute timeout: settings `autoDismiss` can override default TIMEOUTS
      let timeout = TIMEOUTS[severity]
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

      if (timeout > 0) {
        setTimeout(() => removeToast(id), timeout)
      }
    },
    [removeToast, toastsEnabled, autoDismiss]
  )

  /** Toasts split by politeness: danger → assertive; all others → polite. */
  const politeToasts = toasts.filter((t: ToastData) => t.severity !== 'danger')
  const assertiveToasts = toasts.filter((t: ToastData) => t.severity === 'danger')

  return (
    <ToastContext.Provider value={{ addToast, removeToast, removeAllToasts }}>
      {children}
      <div className="toast-container">
        {toasts.length > 1 && (
          <button type="button" className="toast-dismiss-all" onClick={removeAllToasts}>
            Dismiss All
          </button>
        )}
        {/* Polite region: info, success, warning — announced when the screen reader is idle */}
        <div role="region" aria-live="polite" aria-label="Notifications">
          {politeToasts.map((t: ToastData) => (
            <Toast key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </div>
        {/* Assertive region: danger — interrupts and announces immediately */}
        <div role="region" aria-live="assertive" aria-label="Error notifications">
          {assertiveToasts.map((t: ToastData) => (
            <Toast key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}
