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
  
  /**
   * We use a ref to track the current settings to avoid recreating `addToast`
   * on every setting change, which would cause unnecessary re-renders of consumers.
   */
  const settingsRef = useRef({ toastsEnabled, autoDismiss })
  settingsRef.current = { toastsEnabled, autoDismiss }

  const [toasts, setToasts] = useState<ToastData[]>([])
  const idCounter = useRef(0)
  const timeoutsMap = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

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
    timeoutsMap.current.forEach(timerId => clearTimeout(timerId))
    timeoutsMap.current.clear()
  }, [])

  const addToast = useCallback(
    (severity: ToastSeverity, message: string) => {
      const { toastsEnabled, autoDismiss } = settingsRef.current

      // respect global toast enable setting
      if (!toastsEnabled) return
      const id = String(++idCounter.current)
      setToasts((prev: ToastData[]) => {
        const next = [...prev, { id, severity, message }]
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
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
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ addToast, removeToast, removeAllToasts }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-label="Notifications">
        {toasts.length > 1 && (
          <button type="button" className="toast-dismiss-all" onClick={removeAllToasts}>
            Dismiss All
          </button>
        )}
        {toasts.map((t: ToastData) => (
          <Toast key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
