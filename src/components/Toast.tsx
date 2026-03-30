import './Toast.css'

export type ToastSeverity = 'info' | 'success' | 'warning' | 'danger'

const ICONS: Record<ToastSeverity, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    danger: '🚨',
}

export interface ToastData {
    id: string
    severity: ToastSeverity
    message: string
}

interface ToastProps {
    toast: ToastData
    onDismiss: (id: string) => void
}

export default function Toast({ toast, onDismiss }: ToastProps) {
    return (
        <div className={`toast toast--${toast.severity}`} role="status">
            <span className="toast__icon" aria-hidden="true">
                {ICONS[toast.severity]}
            </span>
            <span className="toast__message">{toast.message}</span>
            <button
                type="button"
                className="toast__dismiss"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss"
            >
                ✕
            </button>
        </div>
    )
}
