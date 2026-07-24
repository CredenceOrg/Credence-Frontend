import { type ReactNode, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from './ToastProvider'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
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
  children: ReactNode
}

export default function ActionCard({
  title,
  padding = 'comfortable',
  elevated,
  shareableLink,
  children,
}: ActionCardProps) {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const { copy } = useCopyToClipboard()

  const classes = ['actionCard', `actionCard--${padding}`]
  if (elevated) {
    classes.push('actionCard--elevated')
  }

  const handleCopyLink = useCallback(async () => {
    if (!shareableLink) return
    const success = await copy(shareableLink)
    if (success) {
      addToast('success', t('dashboard.linkCopied'))
    }
  }, [shareableLink, copy, addToast, t])

  return (
    <article className={classes.join(' ')}>
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
      </div>

      <div className="actionCard__content">{children}</div>
    </article>
  )
}
