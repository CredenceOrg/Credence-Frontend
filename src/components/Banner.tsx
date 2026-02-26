import type { ReactNode } from 'react'
import './Banner.css'

export type BannerSeverity = 'info' | 'success' | 'warning' | 'danger'

interface BannerProps {
    severity: BannerSeverity
    children: ReactNode
    dismissible?: boolean
    onDismiss?: () => void
}

const ICONS: Record<BannerSeverity, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    danger: '🚨',
}

export default function Banner({ severity, children, dismissible, onDismiss }: BannerProps) {
    const isUrgent = severity === 'danger' || severity === 'warning'

    return (
        <div
            className={`banner banner--${severity}`}
            role={isUrgent ? 'alert' : 'status'}
        >
            <span className="banner__icon" aria-hidden="true">
                {ICONS[severity]}
            </span>
            <div className="banner__content">{children}</div>
            {dismissible && (
                <button
                    type="button"
                    className="banner__dismiss"
                    onClick={onDismiss}
                    aria-label="Dismiss notification"
                >
                    ✕
                </button>
            )}
        </div>
    )
}
