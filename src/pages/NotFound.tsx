import { useNavigate, Link } from 'react-router-dom'
import Button from '../components/Button'
import './NotFound.css'

export default function NotFound() {
  const navigate = useNavigate()
  const location = useLocation()
  const { goBack } = useSmartBack({ fallback: '/dashboard' })
  const suggestion = suggestRoute(location.pathname, ['/', '/bond', '/trust', '/settings'])
  useDocumentTitle('Page Not Found')

  return (
    <div className="not-found-page">
      {/* 404 Icon Visual */}
      <div className="not-found-page__visual" aria-hidden="true">
        🔍
      </div>

      {/* Subheading/Code */}
      <p className="not-found-page__code">Error 404</p>

      {/* Heading */}
      <h1 className="not-found-page__title">Page Not Found</h1>

      {/* Description */}
      <p className="not-found-page__description">
        We couldn't find the page you are looking for. It might have been moved, deleted, or the URL
        might be incorrect.
      </p>

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
          <li className="not-found-page__link-item">
            <Link to="/" className="not-found-page__link">
              <span className="not-found-page__link-icon" aria-hidden="true">
                📊
              </span>
              <span>Dashboard</span>
            </Link>
          </li>
          <li className="not-found-page__link-item">
            <Link to="/bond" className="not-found-page__link">
              <span className="not-found-page__link-icon" aria-hidden="true">
                🔒
              </span>
              <span>Bond Management</span>
            </Link>
          </li>
          <li className="not-found-page__link-item">
            <Link to="/trust" className="not-found-page__link">
              <span className="not-found-page__link-icon" aria-hidden="true">
                ⭐
              </span>
              <span>Trust Score Lookup</span>
            </Link>
          </li>
          <li className="not-found-page__link-item">
            <Link to="/settings" className="not-found-page__link">
              <span className="not-found-page__link-icon" aria-hidden="true">
                ⚙️
              </span>
              <span>Settings</span>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
