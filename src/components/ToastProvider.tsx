import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import type { BannerSeverity } from './Banner'
import Toast, { type ToastData } from './Toast'
import './Toast.css'

const MAX_TOASTS = 3

const TIMEOUTS: Record<BannerSeverity, number> = {
    info: 5000,
    success: 5000,
    warning: 8000,
    danger: 0,
}

interface ToastContextValue {
    addToast: (severity: BannerSeverity, message: string) => void
    removeToast: (id: string) => void
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
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const addToast = useCallback((severity: BannerSeverity, message: string) => {
        const id = String(++idCounter.current)
        setToasts(prev => {
            const next = [...prev, { id, severity, message }]
            return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
        })

        const timeout = TIMEOUTS[severity]
        if (timeout > 0) {
            setTimeout(() => removeToast(id), timeout)
        }
    }, [removeToast])

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="toast-container" aria-live="polite" aria-label="Notifications">
                {toasts.map(t => (
                    <Toast key={t.id} toast={t} onDismiss={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    )
}
