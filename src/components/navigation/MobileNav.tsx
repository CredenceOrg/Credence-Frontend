import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PrefetchNavLink } from '../PrefetchNavLink'
import { PRELOADS_BY_PATH } from '../../config/routes'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useScrollPreserver } from '../../hooks/useScrollPreserver'
import ErrorBoundary from '../ErrorBoundary'
import './MobileNav.css'
import { useTranslation } from 'react-i18next'
import { SECONDARY_NAV_LINKS } from '../../config/navLinks'
import { DOM_EVENTS } from '../../events'

/**
 * Scoped fallback for MobileNav render errors.
 *
 * When a render error occurs inside MobileNav, the fallback closes the drawer
 * (via a data attribute so CSS hides it) and shows a minimal hamburger button
 * that triggers a reset. This ensures:
 *  - The user is never locked out of navigation.
 *  - Body scroll is not permanently blocked.
 *  - The error is diagnosable via the data-error-boundary attribute and console log.
 */
function MobileNavFallback({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Restore body overflow in case the drawer was open when the error occurred.
    try {
      document.body.style.overflow = ''
    } catch {
      // DOM access failure — no-op in extreme environments.
    }
    // Log for observability without exposing sensitive data.
    console.error('[MobileNav] Render error caught by boundary:', error.message)
  }, [error])

  return (
    <button
      type="button"
      className="mobileNav-hamburger"
      aria-label="Navigation error — tap to retry"
      data-error-boundary="mobilenav"
      onClick={reset}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 6h18M3 12h18M3 18h18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">Navigation error — tap to retry</span>
    </button>
  )
}

/**
 * Internal MobileNav implementation.
 *
 * Separated from the exported wrapper so the ErrorBoundary can catch render
 * errors from this subtree without unmounting the boundary itself.
 */
function MobileNavInner() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem('mobileNavOpen') === 'true'
    } catch {
      return false
    }
  })
  const drawerRef = useRef<HTMLElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  useScrollPreserver({ isActive: isOpen })

  // Close on route change (SPA navigation) — but state survives full page reloads via sessionStorage
  const prevPath = useRef(location.pathname)
  if (prevPath.current !== location.pathname) {
    prevPath.current = location.pathname
    if (isOpen) setIsOpen(false)
  }

  // Persist collapse state across full page reloads
  useEffect(() => {
    try {
      if (isOpen) {
        sessionStorage.setItem('mobileNavOpen', 'true')
      } else {
        sessionStorage.removeItem('mobileNavOpen')
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    // Deterministic failure-boundary handling for the Escape key.
    // Invariants:
    //  - Only a single listener is registered per open cycle (cleanup below).
    //  - Escape always closes the drawer exactly once, even if the event is
    //    dispatched multiple times or while a close is already in flight.
    //  - Errors thrown by downstream listeners never leave the drawer stuck
    //    open; we guard the state transition and swallow listener errors.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setIsOpen((prev) => (prev ? false : prev))
    }

    const safeHandleKeyDown = (event: KeyboardEvent) => {
      try {
        handleKeyDown(event)
      } catch {
        // Failure boundary: never let a keydown handler crash the app or
        // leave navigation state inconsistent.
      }
    }

    window.addEventListener(DOM_EVENTS.KEY_DOWN, safeHandleKeyDown)
    return () => window.removeEventListener(DOM_EVENTS.KEY_DOWN, safeHandleKeyDown)
  }, [isOpen])

  const close = useCallback(() => {
    try {
      setIsOpen((prev) => (prev ? false : prev))
    } catch {
      // Failure boundary: prevent close from crashing
    }
  }, [])

  useFocusTrap({
    containerRef: drawerRef,
    isActive: isOpen,
    initialFocusRef: closeButtonRef,
    returnFocusRef: hamburgerRef,
    onEscape: close,
  })

  return (
    <>
      <button
        ref={hamburgerRef}
        type="button"
        className="mobileNav-hamburger"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-drawer"
        onClick={() => setIsOpen(true)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 6h18M3 12h18M3 18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="sr-only">Open navigation menu</span>
      </button>

      {isOpen && <div className="mobileNav-backdrop" onClick={close} aria-hidden="true" />}

      <nav
        ref={drawerRef}
        id="mobile-nav-drawer"
        className={`mobileNav-drawer${isOpen ? ' mobileNav-drawer--open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!isOpen}
        role="dialog"
        aria-modal="true"
        data-mobilenav-state={isOpen ? 'open' : 'closed'}
      >
        <div className="mobileNav-drawerHeader">
          <button
            ref={closeButtonRef}
            type="button"
            className="mobileNav-close"
            aria-label="Close navigation menu"
            onClick={close}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M4 4l12 12M16 4L4 16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="sr-only">Close navigation menu</span>
          </button>
        </div>

        <ul className="mobileNav-links" role="list">
          {SECONDARY_NAV_LINKS.map(({ to, labelKey }) => (
            <li key={to}>
              <PrefetchNavLink
                to={to}
                end={to === '/'}
                preload={PRELOADS_BY_PATH[to]}
                className={({ isActive }) =>
                  `mobileNav-link${isActive ? ' mobileNav-link--active' : ''}`
                }
                aria-current={
                  location.pathname === to || (to === '/' && location.pathname === '/')
                    ? 'page'
                    : undefined
                }
                onClick={close}
              >
                {t(labelKey)}
              </PrefetchNavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

/**
 * MobileNav — public entry point.
 *
 * Wraps the internal implementation in a scoped ErrorBoundary so that a
 * render error in the navigation drawer never crashes the entire app.
 *
 * Invariants:
 *  - Existing callers (`<MobileNav />`) are fully compatible — the public
 *    interface (default export, no props) is unchanged.
 *  - On error the fallback restores body overflow and shows a retry button.
 *  - After reset, MobileNavInner re-mounts with fresh state.
 */
export default function MobileNav() {
  return (
    <ErrorBoundary
      fallback={(error, reset) => <MobileNavFallback error={error} reset={reset} />}
    >
      <MobileNavInner />
    </ErrorBoundary>
  )
}
