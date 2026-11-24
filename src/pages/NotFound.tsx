import { useNavigate, useLocation, Link } from 'react-router-dom'
import Button from '../components/Button'
import ErrorState from '../components/states/ErrorState'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTranslation } from 'react-i18next'
import { NOT_FOUND_LINKS, SUGGESTION_ROUTES } from '../config/navigation'
import { ALL_NAV_LINKS } from '../config/navLinks'
import { suggestRoute } from '../lib/suggestRoute'
import './NotFound.css'

/**
 * 404 page.  Uses the standardised ErrorState component for the headline
 * panel and a dedicated quick-links card below to give users a direct
 * navigation escape hatch into the four most-visited routes.
 *
 * Iconography is token-based SVG — never emoji — consistent with the
 * design system established in PR #936.
 *
 * Heading hierarchy:
 *   h1 — `not-found-page__title` (page-level)
 *   h2 — `not-found-page__quick-links-title` (Quick Navigation)
 *   h3 — n/a (suppressed via `hideHeading` so the ErrorState panel is
 *          a presentational inner region rather than a duplicate heading)
 */

const MAGNIFIER_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="40"
    height="40"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
)

export default function NotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { suggestion } = suggestRoute(pathname, SUGGESTION_ROUTES)
  const suggestedLink = ALL_NAV_LINKS.find((link) => link.to === suggestion)
  useDocumentTitle('Page Not Found')

  return (
    <div className="not-found-page">
      {/* Subheading / error code badge — calm, not loud. */}
      <p className="not-found-page__code">
        Error <span className="not-found-code">404</span>
      </p>

      {/* Page-level heading. Single <h1> on this page; the ErrorState panel
          omits its inner heading to keep the document outline unique. */}
      <h1 className="not-found-page__title">Page not found</h1>

      {/* Standardised ErrorState panel. Provides the icon, message, and
          recovery affordances in the project's design system. */}
      <div className="not-found-page__panel">
        <ErrorState
          type="pageNotFound"
          hideHeading
          ariaLabel="Page not found"
          icon={MAGNIFIER_ICON}
          action={{
            label: 'Back to home',
            onClick: () => navigate('/'),
          }}
        />
      </div>

      {suggestedLink && (
        <p className="not-found-page__suggestion">
          Did you mean <Link to={suggestedLink.to}>{t(suggestedLink.labelKey)}</Link>?
        </p>
      )}

      {/* Recovery Actions */}
      <div className="not-found-page__actions">
        <Button variant="primary" onClick={() => navigate('/')} style={{ minWidth: '140px' }}>
          Back to Home
        </Button>
        <Button variant="secondary" onClick={() => navigate(-1)} style={{ minWidth: '140px' }}>
          Go Back
        </Button>
      </div>

      {/* Quick Recovery Links */}
      <div className="not-found-page__quick-links-container">
        <h2 className="not-found-page__quick-links-title">Quick Navigation</h2>
        <ul className="not-found-page__quick-links-list">
          {NOT_FOUND_LINKS.map((link) => (
            <li key={link.to} className="not-found-page__link-item">
              <Link to={link.to} className="not-found-page__link">
                <span className="not-found-page__link-icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={link.quickLinkIcon} />
                  </svg>
                </span>
                <span>{t(link.labelKey)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
