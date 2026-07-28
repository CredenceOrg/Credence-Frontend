import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { PrefetchNavLink } from './PrefetchNavLink'
import { PRELOADS_BY_PATH } from '../config/routes'
import { useTranslation } from 'react-i18next'
import ThemeToggle from './ThemeToggle'
import NetworkIndicator from './NetworkIndicator'
import WalletConnect from './WalletConnect'
import MobileNav from './navigation/MobileNav'
import BottomNav from './navigation/BottomNav'
import RouteAnnouncer from './RouteAnnouncer'
import Banner from './Banner'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import ActionLauncher from './ActionLauncher'
import WhatsNewDialog from './WhatsNewDialog'
import BackToTop from './BackToTop'
import LINKS from '../config/links'
import { hasHandledInstallPrompt, markInstallPromptHandled } from '../config/installPrompt'
import { isExternalUrl } from '../lib/isExternalUrl'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { DOM_EVENTS } from '../events'
import './Layout.css'

function FooterLink({ label, href }: { label: string; href: string }) {
  const isPlaceholder = !href || href === '#'
  const isExternal = isExternalUrl(href)

  if (isPlaceholder) {
    return (
      <span
        className="footer-link footer-link--disabled"
        aria-disabled="true"
        title="Coming soon"
        tabIndex={-1}
      >
        {label}
      </span>
    )
  }

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
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [installPromptDismissed, setInstallPromptDismissed] = useState(hasHandledInstallPrompt())
  // Refs so focus returns to the triggering button after each dialog closes
  const shortcutsButtonRef = useRef<HTMLButtonElement>(null)
  const whatsNewButtonRef = useRef<HTMLButtonElement>(null)

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
  const closeLauncher = useCallback(() => setLauncherOpen(false), [])
  const closeWhatsNew = useCallback(() => setWhatsNewOpen(false), [])

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

    window.addEventListener(
      DOM_EVENTS.BEFORE_INSTALL_PROMPT,
      handleBeforeInstallPrompt as EventListener
    )
    return () => {
      window.removeEventListener(
        DOM_EVENTS.BEFORE_INSTALL_PROMPT,
        handleBeforeInstallPrompt as EventListener
      )
    }
  }, [installPromptDismissed])

  // Global action launcher (Ctrl+K / Cmd+K)
  useKeyboardShortcut(['Mod', 'K'], () => setLauncherOpen(true))

  // Global keyboard shortcuts help dialog (Shift+?)
  useKeyboardShortcut(['Shift', '?'], () => setShortcutsOpen(true))

  return (
    <div className="appShell">
      <a className="skip-link" href="#main-content">
        {t('layout.skipToMainContent')}
      </a>

      {/* Screen reader SPA route transition updates manager */}
      <RouteAnnouncer />

      <header className="appHeader">
        <div className="container appHeader-inner">
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

        <WalletConnect />
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
          <span className="sr-only">{t('layout.keyboardShortcuts')}</span>
        </button>
        </div>
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

      <ActionLauncher
        open={launcherOpen}
        onClose={closeLauncher}
        onOpenKeyboardShortcuts={openShortcuts}
      />

      <WhatsNewDialog
        open={whatsNewOpen}
        onClose={closeWhatsNew}
        returnFocusRef={whatsNewButtonRef}
      />

      <BackToTop />
      <BottomNav />
    </div>
  )
}
