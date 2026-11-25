import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWallet } from '../context/WalletContext'
import {
  clearNotificationHistory,
  getUnreadCount,
  loadNotificationHistory,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotificationHistory,
  type NotificationHistoryItem,
} from '../lib/notificationHistory'
import './NotificationCenter.css'

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function formatNotificationTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function NotificationCenter() {
  const { t } = useTranslation()
  const { address, isConnected } = useWallet()
  const walletScope = isConnected && address ? address : null

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationHistoryItem[]>(() =>
    loadNotificationHistory(walletScope)
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const titleId = useId()

  const refresh = useCallback(() => {
    setItems(loadNotificationHistory(walletScope))
  }, [walletScope])

  useEffect(() => {
    refresh()
    return subscribeNotificationHistory(refresh)
  }, [refresh])

  const closeAndReturnFocus = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }, [])

  // Close on outside pointer down
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // Move focus into panel when opened, trap Tab/Shift+Tab, and handle Escape
  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    if (panel) {
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (focusables.length > 0) {
        focusables[0].focus()
      } else {
        panel.focus()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeAndReturnFocus()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      if (focusables.length === 0) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !panelRef.current.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeAndReturnFocus])

  const unreadCount = getUnreadCount(items)
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount)
  const triggerLabel =
    unreadCount > 0
      ? t('notifications.openButtonUnread', { count: unreadCount })
      : t('notifications.openButton')

  const handleToggle = () => {
    if (open) {
      closeAndReturnFocus()
    } else {
      setOpen(true)
    }
  }

  const handleMarkAllRead = () => {
    setItems(markAllNotificationsRead(walletScope))
  }

  const handleClear = () => {
    setItems(clearNotificationHistory(walletScope))
  }

  const handleMarkItemRead = (id: string) => {
    setItems(markNotificationRead(id, walletScope))
  }

  return (
    <div ref={wrapperRef} className="notification-center">
      <button
        ref={triggerRef}
        type="button"
        className="notification-center__trigger"
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={handleToggle}
      >
        <svg
          className="notification-center__icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notification-center__badge" aria-hidden="true">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="notification-center__panel"
        >
          <div className="notification-center__header">
            <h2 id={titleId} className="notification-center__title">
              {t('notifications.title')}
            </h2>
            <div className="notification-center__actions">
              <button
                type="button"
                className="notification-center__action-btn"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
              >
                {t('notifications.markAllRead')}
              </button>
              <button
                type="button"
                className="notification-center__action-btn"
                onClick={handleClear}
                disabled={items.length === 0}
              >
                {t('notifications.clear')}
              </button>
              <button
                type="button"
                className="notification-center__close-btn"
                aria-label={t('notifications.close')}
                onClick={closeAndReturnFocus}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="notification-center__empty">{t('notifications.empty')}</p>
          ) : (
            <ul className="notification-center__list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`notification-center__item notification-center__item--${item.type}${
                    item.read ? '' : ' notification-center__item--unread'
                  }`}
                >
                  <div className="notification-center__item-body">
                    <div className="notification-center__item-meta">
                      <span
                        className={`notification-center__dot notification-center__dot--${item.type}`}
                        aria-hidden="true"
                      />
                      <time
                        className="notification-center__time"
                        dateTime={new Date(item.timestamp).toISOString()}
                      >
                        {formatNotificationTime(item.timestamp)}
                      </time>
                      {item.suppressed && (
                        <span className="notification-center__tag">
                          {t('notifications.suppressedQuietHours')}
                        </span>
                      )}
                      {!item.read && (
                        <span className="sr-only">{t('notifications.unread')}</span>
                      )}
                    </div>
                    <p className="notification-center__message">{item.message}</p>
                  </div>
                  {!item.read && (
                    <button
                      type="button"
                      className="notification-center__mark-read"
                      onClick={() => handleMarkItemRead(item.id)}
                      aria-label={t('notifications.markRead')}
                    >
                      {t('notifications.markRead')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
