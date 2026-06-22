import { Component, ReactNode } from 'react'
import ErrorState from './states/ErrorState'

interface Props {
  children: ReactNode
  /** Override the default fallback. Receives the caught error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface BoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Catches render/lifecycle errors in its subtree and shows a branded
 * ErrorState fallback with a retry action and a home link.
 *
 * Calling retry resets internal state so the subtree re-mounts without a
 * hard reload. If the re-mounted subtree throws again the boundary catches
 * it once more.
 *
 * Wire telemetry in componentDidCatch before shipping to production.
 */
export default class ErrorBoundary extends Component<Props, BoundaryState> {
  state: BoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Replace with real telemetry (Sentry, Datadog, etc.) before production.
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (hasError && error) {
      if (fallback) return fallback(error, this.handleReset)

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            padding: 'var(--credence-space-6)',
          }}
        >
          <ErrorState type="generic" action={{ label: 'Try again', onClick: this.handleReset }} />
          <a
            href="/"
            style={{
              marginTop: 'var(--credence-space-4)',
              fontSize: 'var(--credence-font-size-sm)',
              color: 'var(--credence-text-secondary)',
              textDecoration: 'underline',
            }}
          >
            Go to home page
          </a>
        </div>
      )
    }

    return children
  }
}
