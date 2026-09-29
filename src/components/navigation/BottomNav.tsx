import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BREAKPOINTS } from '../../config/breakpoints'
import { PRIMARY_NAV_LINKS } from '../../config/navLinks'
import './BottomNav.css'

const STYLE_ID = 'bottomNav-breakpoint'

/**
 * Fixed bottom navigation bar showing the 5 primary routes.
 * Visible on viewports ≤ BREAKPOINTS.MD (768 px); hidden at wider widths via CSS.
 *
 * Uses React Router NavLink which automatically sets aria-current="page"
 * on the active route's <a> element.
 */
export default function BottomNav() {
  const { t } = useTranslation()

  // Inject the breakpoint value as a CSS custom property so the stylesheet
  // can reference --credence-bottom-nav-breakpoint for documentation purposes
  // without hard-coding the value.
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `:root { --credence-bottom-nav-breakpoint: ${BREAKPOINTS.MD}px; }`
    document.head.appendChild(style)
    // No cleanup — the property is global and idempotent.
  }, [])

  return (
    <nav className="bottomNav" aria-label="Bottom navigation">
      <ul className="bottomNav-list" role="list">
        {PRIMARY_NAV_LINKS.map(({ to, labelKey, ariaLabel }) => (
          <li key={to} className="bottomNav-item">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive ? 'bottomNav-tab bottomNav-tab--active' : 'bottomNav-tab'
              }
              aria-label={ariaLabel}
            >
              <span className="bottomNav-label">{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
