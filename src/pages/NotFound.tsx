import { useNavigate, Link } from 'react-router-dom'
import Button from '../components/Button'
import ErrorState from '../components/states/ErrorState'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
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

interface QuickLink {
  to: string
  label: string
  icon: React.ReactNode
}

const QUICK_LINKS: QuickLink[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
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
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    to: '/bond',
    label: 'Bond Management',
    icon: (
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
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    to: '/trust',
    label: 'Trust Score Lookup',
    icon: (
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
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
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
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

export default function NotFound() {
  const navigate = useNavigate()
  useDocumentTitle('Page Not Found')

  return (
    <div className="not-found-page">
      {/* Subheading / error code badge — calm, not loud. */}
      <p className="not-found-page__code">Error 404</p>

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
          {QUICK_LINKS.map((link) => (
            <li key={link.to} className="not-found-page__link-item">
              <Link to={link.to} className="not-found-page__link">
                <span className="not-found-page__link-icon" aria-hidden="true">
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
