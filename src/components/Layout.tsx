import { useCallback, useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom'
import { PrefetchNavLink } from './PrefetchNavLink'
import { PRELOADS_BY_PATH } from '../config/routes'
import { NAV_LINKS } from '../config/navigation'
import ErrorBoundary, { isChunkLoadError } from './ErrorBoundary'
import ErrorState from './states/ErrorState'
import { reloadPageGuarded, hasAttemptedChunkReload } from '../lib/lazyWithRetry'
import { useTranslation } from 'react-i18next'
import ThemeToggle from './ThemeToggle'
import NotificationCenter from './NotificationCenter'
import NetworkIndicator from './NetworkIndicator'
import HeaderWallet from './HeaderWallet'
import MobileNav from './navigation/MobileNav'
import BottomNav from './navigation/BottomNav'
import RouteAnnouncer from './RouteAnnouncer'
import Banner from './Banner'
import RateLimitBanner from './RateLimitBanner'
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog'
import ActionLauncher from './ActionLauncher'
import WhatsNewDialog from './WhatsNewDialog'
import BackToTop from './BackToTop'
import FooterLink from './FooterLink'
import LINKS from '../config/links'
import { hasHandledInstallPrompt, markInstallPromptHandled } from '../config/installPrompt'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { useSettings } from '../context/SettingsContext'
import { THEME_CHANNEL_EVENT, getCurrentTheme, getNextTheme } from '../lib/themeCycle'
import { usePwaUpdate } from '../hooks/usePwaUpdate'
import { useRouteFocus } from '../hooks/useRouteFocus'
import { useUnlockReminders } from '../hooks/useUnlockReminders'
import { DOM_EVENTS } from '../events'
import './Layout.css'

export default function Layout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { needRefresh, isUpdateDeferred, updateError, applyUpdate } = usePwaUpdate()

  useRouteFocus()

  // Opt-in background reminders for bonds that unlock soon. Inert unless the
  // user enabled them and granted the Notification permission.
  useUnlockReminders()

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [installPromptDismissed, setInstallPromptDismissed] = useState(hasHandledInstallPrompt)
  const [themeAnnouncement, setThemeAnnouncement] = useState('')
  const { applyThemeMode } = useSettings()

  // Refs so focus returns to the triggering button after each dialog closes
  const shortcutsButtonRef = useRef<HTMLButtonElement>(null)
  const whatsNewButtonRef = useRef<HTMLButtonElement>(null)

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

  // Toggle light / dark theme (T). The hook already ignores typing contexts
  // (inputs, textareas, selects, contenteditable) and Ctrl/Cmd/Alt combos.
  const toggleTheme = useCallback(
    (event: KeyboardEvent) => {
      // Shift+T is not the documented shortcut; auto-repeat would flicker the theme.
      if (event.shiftKey || event.repeat) return
      const next = getNextTheme(getCurrentTheme())
      applyThemeMode(next)
      // Keep the header ThemeToggle's icon/label in sync.
      window.dispatchEvent(new CustomEvent(THEME_CHANNEL_EVENT, { detail: { theme: next } }))
      setThemeAnnouncement(`Switched to ${next} mode`)
    },
    [applyThemeMode]
  )
  useKeyboardShortcut('T', toggleTheme, { preventDefault: false })

  return (
    <div className="appShell">
      <a className="skip-link" href="#main-content">
        {t('layout.skipToMainContent')}
      </a>

      {/* Screen reader SPA route transition updates manager */}
      <RouteAnnouncer />
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="theme-announcer"
      >
        {themeAnnouncement}
      </div>

      <header className="appHeader">
        <div className="container appHeader-inner">
          {/* Mobile: hamburger toggle (hidden ≥640px via CSS) */}
          <MobileNav />

          <NavLink to="/" className="appBrand">
            {t('layout.brand')}
          </NavLink>

          {/* Desktop: inline nav (hidden <640px via CSS) */}
          <nav aria-label="Main navigation" className="appNav">
            {NAV_LINKS.map(({ to, labelKey }) => (
              <PrefetchNavLink
                key={to}
                to={to}
                end
                preload={PRELOADS_BY_PATH[to]}
                className={({ isActive }) =>
                  isActive ? 'appNav-link appNav-link--active' : 'appNav-link'
                }
              >
                {t(labelKey)}
              </PrefetchNavLink>
            ))}
          </nav>

          <HeaderWallet />
          <NotificationCenter />
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

      {needRefresh && (
        <div className="appInstallPrompt">
          <Banner
            severity="info"
            title="Update available"
            action={{ label: 'Reload', onClick: () => void applyUpdate() }}
          >
            <p>
              {updateError ??
                (isUpdateDeferred
                  ? 'The update will reload when your current operation finishes.'
                  : 'A new version is ready. Reload to use the latest version.')}
            </p>
          </Banner>
        </div>
      )}

      <main id="main-content" className="appMain">
        <RateLimitBanner />
        <ErrorBoundary
          resetKey={location.pathname}
          fallback={(error, reset) => {
            const isChunk = isChunkLoadError(error)
            const isReloadAttempted = hasAttemptedChunkReload()

            return (
              <div
                className="error-fallback-container error-fallback-container--page"
                data-error-boundary="route"
              >
                <ErrorState
                  type={isChunk ? 'network' : 'generic'}
                  severity="danger"
                  title="Something went wrong"
                  message={
                    isChunk
                      ? 'Failed to load this section of the app. Try again, or reload the page.'
                      : 'An unexpected error occurred in this page. You can try again or return to the dashboard.'
                  }
                  ariaLabel="Page error"
                  action={{
                    label: isChunk && isReloadAttempted ? 'Reload page' : 'Try again',
                    onClick: isChunk && isReloadAttempted ? reloadPageGuarded : reset,
                  }}
                />
                <Link to="/dashboard" className="error-fallback-secondary-link" onClick={reset}>
                  Go to dashboard
                </Link>
              </div>
            )
          }}
        >
          <Outlet />
        </ErrorBoundary>
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
