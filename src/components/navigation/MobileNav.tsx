import { useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import './MobileNav.css'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/bond', label: 'Bond' },
  { to: '/trust', label: 'Trust Score' },
  { to: '/settings', label: 'Settings' },
]

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef = useRef<HTMLElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  // Close on route change
  const prevPath = useRef(location.pathname)
  if (prevPath.current !== location.pathname) {
    prevPath.current = location.pathname
    if (isOpen) setIsOpen(false)
  }

  useFocusTrap({
    containerRef: drawerRef,
    isActive: isOpen,
    returnFocusRef: hamburgerRef,
    onEscape: () => setIsOpen(false),
  })

  const close = () => setIsOpen(false)

  return (
    <>
      <button
        ref={hamburgerRef}
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
      </button>

      {isOpen && (
        <div className="mobileNav-backdrop" onClick={close} aria-hidden="true" />
      )}

      <nav
        ref={drawerRef}
        id="mobile-nav-drawer"
        className={`mobileNav-drawer${isOpen ? ' mobileNav-drawer--open' : ''}`}
        aria-label="Mobile navigation"
        aria-hidden={!isOpen}
      >
        <div className="mobileNav-drawerHeader">
          <button
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
          </button>
        </div>

        <ul className="mobileNav-links" role="list">
          {NAV_LINKS.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `mobileNav-link${isActive ? ' mobileNav-link--active' : ''}`
                }
                aria-current={location.pathname === to || (to === '/' && location.pathname === '/') ? 'page' : undefined}
                onClick={close}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
