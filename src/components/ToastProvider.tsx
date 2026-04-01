import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
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
    const [toasts, setToasts] = useState<ToastData[]>([])
    const idCounter = useRef(0)

    const removeToast = useCallback((id: string) => {
        setToasts((prev: ToastData[]) => prev.filter((t: ToastData) => t.id !== id))
    }, [])

    const removeAllToasts = useCallback(() => {
        setToasts([])
    }, [])

    const addToast = useCallback((severity: ToastSeverity, message: string) => {
        const id = String(++idCounter.current)
        setToasts((prev: ToastData[]) => {
            const next = [...prev, { id, severity, message }]
            return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
        })

        const timeout = TIMEOUTS[severity]
        if (timeout > 0) {
            setTimeout(() => removeToast(id), timeout)
        }
    }, [removeToast])

    return (
        <ToastContext.Provider value={{ addToast, removeToast, removeAllToasts }}>
            {children}
            <div className="toast-container" aria-live="polite" aria-label="Notifications">
                {toasts.length > 1 && (
                    <button 
                        type="button" 
                        className="toast-dismiss-all" 
                        onClick={removeAllToasts}
                    >
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
