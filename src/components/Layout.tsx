import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { PrefetchNavLink } from './PrefetchNavLink'
import { PRELOADS_BY_PATH } from '../config/routes'
import { useTranslation } from 'react-i18next'
import ThemeToggle from './ThemeToggle'
import NetworkIndicator from './NetworkIndicator'
import MobileNav from './navigation/MobileNav'
import RouteAnnouncer from './RouteAnnouncer'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import BackToTop from './BackToTop'
import LINKS from '../config/links'
import { isExternalUrl } from '../lib/isExternalUrl'
import './Layout.css'


function FooterLink({ label, href }: { label: string; href: string }) {
  const isExternal = isExternalUrl(href)
  return (
    <a
      href={href}
      className="footer-link"
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {label}
    </a>
  )
}

export default function Layout() {
  const { t } = useTranslation()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  // Refs so focus returns to the triggering button after each dialog closes
  const shortcutsButtonRef = useRef<HTMLButtonElement>(null)
  const whatsNewButtonRef = useRef<HTMLButtonElement>(null)

  const { unreadCount } = useProductUpdates()

  const NAV_LINKS = [
    { to: '/dashboard', label: t('nav.dashboard') },
    { to: '/bond', label: t('nav.bond') },
    { to: '/trust', label: t('nav.trustScore') },
    { to: '/attestations', label: t('nav.attestations') },
    { to: '/transactions', label: t('nav.transactions') },
    { to: '/settings', label: t('nav.settings') },
  ]

  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), [])

  const openWhatsNew = useCallback(() => setWhatsNewOpen(true), [])
  const closeWhatsNew = useCallback(() => setWhatsNewOpen(false), [])

  // Global Shift+? listener — opens the shortcuts dialog from anywhere except
  // text-entry contexts (input, textarea, contenteditable).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?') return
      // Ignore while typing inside editable elements
      const target = event.target as HTMLElement
      const tag = target.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }
      setShortcutsOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="appShell">
      <a className="skip-link" href="#main-content">
        {t('layout.skipToMainContent')}
      </a>

      {/* Screen reader SPA route transition updates manager */}
      <RouteAnnouncer />

      <header className="appHeader">
        {/* Mobile: hamburger toggle (hidden ≥640px via CSS) */}
        <MobileNav />

        <NavLink to="/" className="appBrand">
          {t('layout.brand')}
        </NavLink>

        {/* Desktop: inline nav (hidden <640px via CSS) */}
        <nav aria-label="Main navigation" className="appNav">
          {NAV_LINKS.map(({ to, label }) => (
            <PrefetchNavLink
              key={to}
              to={to}
              end
              preload={PRELOADS_BY_PATH[to]}
              className={({ isActive }) =>
                isActive ? 'appNav-link appNav-link--active' : 'appNav-link'
              }
            >
              {label}
            </PrefetchNavLink>
          ))}
        </nav>

        <ThemeToggle />
        <NetworkIndicator />

        {/* What's New button */}
        <button
          ref={whatsNewButtonRef}
          type="button"
          className="appHeader-whats-new-btn"
          aria-label={
            unreadCount > 0
              ? `What's New — ${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
              : "What's New"
          }
          onClick={openWhatsNew}
        >
          <svg
            className="appHeader-whats-new-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="appHeader-whats-new-badge" aria-hidden="true">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Keyboard shortcuts help button */}
        <button
          ref={shortcutsButtonRef}
          type="button"
          className="appHeader-shortcuts-btn"
          aria-label={t('layout.keyboardShortcuts')}
          onClick={openShortcuts}
        >
          <span aria-hidden="true">?</span>
          <span className="sr-only">Open keyboard shortcuts (Shift+?)</span>
        </button>
      </header>

      <main id="main-content" className="appMain">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="container footer-content">
          <div>
            <p className="appFooterTitle">{t('layout.brand')}</p>
            <p>{t('layout.footer.copyright')}</p>
          </div>
          <div className="footer-links">
            <FooterLink label={t('layout.footer.documentation')} href={LINKS.docs} />
            <FooterLink label={t('layout.footer.termsOfService')} href={LINKS.terms} />
            <FooterLink label={t('layout.footer.privacyPolicy')} href={LINKS.privacy} />
          </div>
        </div>
      </footer>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={closeShortcuts}
        returnFocusRef={shortcutsButtonRef}
      />

      <BackToTop />
    </div>
  )
}
