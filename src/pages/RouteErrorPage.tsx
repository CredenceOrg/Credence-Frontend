import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import ErrorState from '../components/states/ErrorState'
import './Errors.css'

/**
 * Renders as the errorElement for router-level failures (loader errors,
 * navigation errors). Effective with data-router setups (createBrowserRouter);
 * present here as forward-compatible scaffolding for the current BrowserRouter.
 *
 * Uses the standardised `ErrorState` component so the visual treatment matches
 * ErrorBoundary's fallback and page-level error surfaces elsewhere in the app.
 */
export default function RouteErrorPage() {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div className="error-fallback-container error-fallback-container--route" role="presentation">
      <ErrorState
        type={isNotFound ? 'pageNotFound' : 'generic'}
        severity={isNotFound ? 'info' : 'danger'}
        title={isNotFound ? 'Page not found' : undefined}
        message={
          isNotFound
            ? 'The page you were looking for could not be found. It may have moved or been renamed.'
            : 'An unexpected router error occurred. Try again in a moment.'
        }
        ariaLabel={isNotFound ? 'Route not found' : 'Router error'}
        action={{
          label: 'Go home',
          onClick: () => {
            window.location.href = '/'
          },
        }}
      />
      <a className="error-fallback-secondary-link" href="/">
        Return to home page
      </a>
    </div>
  )
}
