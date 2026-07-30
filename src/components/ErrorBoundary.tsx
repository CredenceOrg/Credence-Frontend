import { Component, ReactNode } from 'react'
import ErrorState, { type ErrorStateKind, type ErrorStateSeverity } from './states/ErrorState'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
  /** Override the default fallback. Receives the caught error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface BoundaryState {
  hasError: boolean
  error: Error | null
}

interface ClassifiedError {
  kind: ErrorStateKind
  severity: ErrorStateSeverity
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

  private isChunkLoadError(error: Error): boolean {
    const message = error.message.toLowerCase()
    const errorName = error.name.toLowerCase()

    return (
      message.includes('chunk') ||
      message.includes('failed to load') ||
      message.includes('loading chunk') ||
      message.includes('loading module') ||
      errorName === 'chunksloaderror' ||
      message.includes('dynamically imported') ||
      message.includes('failed to fetch') ||
      message.includes('import(') ||
      message.includes('network error') ||
      message.includes('chunk-load')
    )
  }

  /**
   * Classify the error into the standardised (kind, severity) axes so the
   * panel can render a calm, contextualised grip on the failure.
   *
   *  • chunk-load failures are a network-class failure — danger severity.
   *  • everything else falls back to generic / danger.
   */
  private classifyError(error: Error): ClassifiedError {
    if (this.isChunkLoadError(error)) {
      return { kind: 'network', severity: 'danger' }
    }
    return { kind: 'generic', severity: 'danger' }
  }

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

      const { kind, severity } = this.classifyError(error)

      // The whole-app-crash fallback needs stronger wording than the
      // single-section generic copy (cf. docs/UI_STATES_GUIDE.md "Error
      // Boundary Strategy"). We pin the title + message so the user
      // understands the panel is an app-level fallback, not a localized
      // data-fetch failure — the underlying `kind` still drives the icon.
      return (
        <div className="error-fallback-container" data-error-boundary="true">
          <ErrorState
            type={kind}
            severity={severity}
            title="Something went wrong"
            message="The app hit an unexpected error and couldn’t recover on its own. Try again, and if it persists, head back to the home page."
            ariaLabel="Application error"
            action={{ label: 'Try again', onClick: this.handleReset }}
          />
          <a className="error-fallback-secondary-link" href="/">
            Go to home page
          </a>
        </div>
      )
    }

    return children
  }
}
