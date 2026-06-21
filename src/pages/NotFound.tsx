import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import Button from '../components/Button';
import './NotFound.css';

export default function NotFound() {
  const navigate = useNavigate();

  useDocumentTitle('Page Not Found');

  return (
    <main className="not-found-container">
      {/* Accessible SVG replacing raw emoji icon */}
      <div className="not-found-icon-wrap">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          width="32"
          height="32"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>

      <h1 className="not-found-title">Page Not Found</h1>
      
      <p className="not-found-code">404</p>
      
      <p className="not-found-description">
        The page you're looking for doesn't exist. It may have been moved or removed.
      </p>

      <div className="not-found-actions">
        <Button 
          variant="primary" 
          onClick={() => navigate('/')}
        >
          Back to Home
        </Button>

        <Button 
          variant="secondary" 
          onClick={() => navigate(-1)}
        >
          Go Back
        </Button>
      </div>

      <p className="not-found-footer-text">
        Use the navigation above to find what you're looking for, or{' '}
        <a href="/" className="not-found-link">
          return home
        </a>
        .
      </p>
    </main>
  );
}