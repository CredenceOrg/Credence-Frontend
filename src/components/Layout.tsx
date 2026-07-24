import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ThemeToggle from './ThemeToggle'
import NetworkIndicator from './NetworkIndicator'
import MobileNav from './navigation/MobileNav'
import RouteAnnouncer from './RouteAnnouncer'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import BackToTop from './BackToTop'
import Banner from './Banner'
import LINKS from '../config/links'
import { hasHandledInstallPrompt, markInstallPromptHandled } from '../config/installPrompt'
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
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [installPromptDismissed, setInstallPromptDismissed] = useState(hasHandledInstallPrompt())
  // Refs so focus returns to the triggering button after each dialog closes
  const shortcutsButtonRef = useRef<HTMLButtonElement>(null)


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

  const dismissInstallPrompt = useCallback(() => {
    markInstallPromptHandled()
    setInstallPromptDismissed(true)
    setShowInstallPrompt(false)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || installPromptDismissed) return

    const handleBeforeInstallPrompt = (event: Event) => {
      if (installPromptDismissed) return
      event.preventDefault()
      markInstallPromptHandled()
      setInstallPromptDismissed(true)
      setShowInstallPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    }
  }, [installPromptDismissed])

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
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                isActive ? 'appNav-link appNav-link--active' : 'appNav-link'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <ThemeToggle />
        <NetworkIndicator />

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

      {showInstallPrompt && (
        <div className="appInstallPrompt">
          <Banner
            severity="info"
            title="Install Credence"
            dismissible
            onDismiss={dismissInstallPrompt}
          >
            <p className="appInstallPrompt-copy">
              Install this app for a faster, more reliable experience on your device.
            </p>
          </Banner>
        </div>
      )}

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
