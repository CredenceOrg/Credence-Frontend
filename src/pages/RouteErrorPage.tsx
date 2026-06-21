import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import ErrorState from '../components/states/ErrorState'

/**
 * Renders as the errorElement for router-level failures (loader errors,
 * navigation errors). Effective with data-router setups (createBrowserRouter);
 * present here as forward-compatible scaffolding for the current BrowserRouter.
 */
export default function RouteErrorPage() {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 'var(--credence-space-6)',
      }}
    >
      <ErrorState
        type="generic"
        title={isNotFound ? 'Page not found' : 'Something went wrong'}
        message={
          isNotFound
            ? "The page you're looking for doesn't exist."
            : 'An unexpected router error occurred. Please try again.'
        }
        action={{ label: 'Go home', onClick: () => { window.location.href = '/' } }}
      />
      <a
        href="/"
        style={{
          marginTop: 'var(--credence-space-4)',
          fontSize: 'var(--credence-font-size-sm)',
          color: 'var(--credence-text-secondary)',
          textDecoration: 'underline',
        }}
      >
        Return to home page
      </a>
    </div>
  )
}
