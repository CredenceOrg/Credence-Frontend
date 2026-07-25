import { type ReactNode, useCallback, useState, useRef, TouchEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from './ToastProvider'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { BETA_RIBBON_LABEL } from '../config/constants'
import { SWIPE_DISMISS_THRESHOLD } from '../config/gestures'
import './ActionCard.css'

export interface ActionCardProps {
  title: string
  /**
   * The density of the card's padding.
   * @default 'comfortable'
   */
  padding?: 'compact' | 'comfortable'
  /**
   * Whether the card is elevated with a drop shadow and a hover transition.
   * @default false
   */
  elevated?: boolean
  /**
   * When provided, a copy-link button appears in the card header.
   * Clicking it copies this URL to the clipboard and shows a toast.
   */
  shareableLink?: string
  /**
   * Indicates if this is an early-access feature. Will display a beta ribbon if true.
   */
  isEarlyAccess?: boolean
  /**
   * Optional callback when the card is dismissed. Enables a fallback close button and swipe-to-dismiss.
   */
  onDismiss?: () => void
  children: ReactNode
}

export default function ActionCard({
  title,
  padding = 'comfortable',
  elevated,
  shareableLink,
  isEarlyAccess,
  onDismiss,
  children,
}: ActionCardProps) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { copy } = useCopyToClipboard()

  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (!onDismiss) return
    touchStartX.current = e.touches[0].clientX
    setIsSwiping(true)
  }

  const handleTouchMove = (e: TouchEvent<HTMLElement>) => {
    if (!onDismiss || touchStartX.current === null) return
    const currentX = e.touches[0].clientX
    const diff = currentX - touchStartX.current
    setOffset(diff)
  }

  const handleTouchEnd = () => {
    if (!onDismiss || touchStartX.current === null) return
    if (Math.abs(offset) > SWIPE_DISMISS_THRESHOLD) {
      onDismiss()
    }
    setOffset(0)
    setIsSwiping(false)
    touchStartX.current = null
  }

  const classes = ['actionCard', `actionCard--${padding}`]
  if (elevated) {
    classes.push('actionCard--elevated')
  }
  if (isSwiping) {
    classes.push('actionCard--swiping')
  }
  if (onDismiss) {
    classes.push('actionCard--dismissible')
  }

  const style = onDismiss && isSwiping ? { transform: `translateX(${offset}px)` } : undefined

  const handleCopyLink = useCallback(async () => {
    if (!shareableLink) return
    const success = await copy(shareableLink)
    if (success) {
      addToast('success', t('dashboard.linkCopied'))
    }
  }, [shareableLink, copy, addToast, t])

  return (
    <article 
      className={classes.join(' ')}
      style={style}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {isEarlyAccess && (
        <div className="actionCard__betaRibbon" aria-hidden="true">
          {BETA_RIBBON_LABEL}
        </div>
      )}
      <div className="actionCard__header">
        <h2 className="actionCard__title">
          {title}
        </h2>
        {shareableLink && (
          <button
            type="button"
            className="actionCard__copyLink"
            onClick={handleCopyLink}
            aria-label={t('dashboard.copyLink')}
            title={t('dashboard.copyLink')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            className="actionCard__close"
            onClick={onDismiss}
            aria-label={t('dashboard.closeCard', { defaultValue: 'Close card' })}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="actionCard__content">{children}</div>
    </article>
  )
}
