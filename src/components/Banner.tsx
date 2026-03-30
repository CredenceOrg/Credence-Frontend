import { useRef, useCallback } from 'react'
import type { ReactNode } from 'react'
import './Banner.css'

export type BannerSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface BannerAction {
    label: string
    href?: string
    onClick?: () => void
}

interface BannerProps {
    severity: BannerSeverity
    children: ReactNode
    /** Short bold title rendered above the message body */
    title?: string
    /** Dismissible banners show a close button and are visually distinct from persistent ones */
    dismissible?: boolean
    onDismiss?: () => void
    /** Optional CTA link or button rendered inline after the message */
    action?: BannerAction
    /** Element to return focus to after dismiss; defaults to document.body */
    returnFocusRef?: React.RefObject<HTMLElement>
}

// Inline SVG icons — no external dependency, aria-hidden on use
const ICONS: Record<BannerSeverity, ReactNode> = {
    info: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
    ),
    success: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
    ),
    warning: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
    ),
    critical: (
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
    ),
}

const SEVERITY_LABEL: Record<BannerSeverity, string> = {
    info: 'Information',
    success: 'Success',
    warning: 'Warning',
    critical: 'Critical',
}

export default function Banner({
    severity,
    children,
    title,
    dismissible,
    onDismiss,
    action,
    returnFocusRef,
}: BannerProps) {
    const isUrgent = severity === 'critical' || severity === 'warning'
    const dismissBtnRef = useRef<HTMLButtonElement>(null)

    const handleDismiss = useCallback(() => {
        // Return focus to caller-supplied ref, or document.body as fallback
        const target = returnFocusRef?.current ?? document.body
        onDismiss?.()
        // Defer so the banner unmounts first
        requestAnimationFrame(() => target.focus())
    }, [onDismiss, returnFocusRef])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLButtonElement>) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                handleDismiss()
            }
        },
        [handleDismiss],
    )

    return (
        <div
            className={[
                'banner',
                `banner--${severity}`,
                dismissible ? 'banner--dismissible' : 'banner--persistent',
            ].join(' ')}
            role={isUrgent ? 'alert' : 'status'}
            aria-label={`${SEVERITY_LABEL[severity]} banner`}
        >
            <span className="banner__icon">{ICONS[severity]}</span>

            <div className="banner__body">
                {title && <p className="banner__title">{title}</p>}
                <div className="banner__content">{children}</div>
                {action && (
                    <div className="banner__action">
                        {action.href ? (
                            <a href={action.href} className="banner__link">
                                {action.label}
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="banner__link-arrow">
                                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </a>
                        ) : (
                            <button type="button" className="banner__link banner__link--btn" onClick={action.onClick}>
                                {action.label}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {dismissible && (
                <button
                    ref={dismissBtnRef}
                    type="button"
                    className="banner__dismiss"
                    onClick={handleDismiss}
                    onKeyDown={handleKeyDown}
                    aria-label="Dismiss banner"
                >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
        </div>
    )
}
