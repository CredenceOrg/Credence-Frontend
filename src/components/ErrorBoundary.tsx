import { Component, ReactNode } from 'react'
import ErrorState, { type ErrorStateKind, type ErrorStateSeverity } from './states/ErrorState'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
  /** Override the default fallback. Receives the caught error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /**
   * Optional telemetry sink. When provided, it is invoked once per caught
   * error with a safe, non-sensitive payload. When omitted, the boundary
   * falls back to a console error so failures remain diagnosable in dev.
   */
  onError?: (payload: ErrorBoundaryTelemetry) => void
  /**
   * Maximum number of automatic re-mount attempts before the boundary
   * stops retrying and surfaces a terminal failure state. Defaults to 1.
   */
  maxRetries?: number
}

export interface ErrorBoundaryTelemetry {
  /** Error class name (e.g. 'Error', 'ChunkLoadError'). Never the message. */
  name: string
  /** Classified error kind for dashboard grouping. */
  kind: ErrorStateKind
  /** Classified severity for alerting. */
  severity: ErrorStateSeverity
  /** Number of retry attempts already made for this failure chain. */
  retryCount: number
  /** Whether the boundary has exhausted its retry budget. */
  exhausted: boolean
}

interface BoundaryState {
  hasError: boolean
  error: Error | null
  /**
   * Number of reset attempts made since the last successful render.
   * Used to enforce the retry budget and guarantee termination.
   */
  retryCount: number
}

interface ClassifiedError {
  kind: ErrorStateKind
  severity: ErrorStateSeverity
}

/**
 * Deterministic failure-boundary coverage for the app subtree.
 *
 * Invariants:
 *  1. A caught error always produces a rendered fallback - never a blank
  *     screen and never a silent swallowed failure.
 *  2. Retry is bounded by `maxRetries` so a persistently throwing subtree
 *     cannot loop forever. Once the budget is exhausted the fallback switches
  *     to a terminal copy and the retry action is removed.
 *  3. Telemetry never includes the error message or component stack - only
 *     the class name and classification - so sensitive data is not leaked.
 *  4. Reset is idempotent: calling it when no error is present is a no-op.
 */
export default class ErrorBoundary extends Component<Props, BoundaryState> {
  state: BoundaryState = { hasError: false, error: null, retryCount: 0 }

  private get maxRetries(): number {
    const raw = this.props.maxRetries
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return 1
    return Math.floor(raw)
  }

  private isChunkLoadError(error: Error): boolean {
    const message = (error.message ?? '').toLowerCase()
    const errorName = (error.name ?? '').toLowerCase()

    return (
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

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { hasError: true, error: ErrorBoundary.normalizeError(error) }
  }

  /**
   * Normalise arbitrary thrown values into an Error instance so downstream
   * code can rely on `.name` and `.message` without defensive checks.
   */
  private static normalizeError(value: unknown): Error {
    if (value instanceof Error) return value
    if (typeof value === 'string') return new Error(value)
    try {
      return new Error(typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value))
    } catch {
      return new Error('Unknown error')
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const normalized = ErrorBoundary.normalizeError(error)
    const { kind, severity } = this.classifyError(normalized)
    const retryCount = this.state.retryCount
    const exhausted = retryCount >= this.maxRetries

    const payload: ErrorBoundaryTelemetry = {
      name: normalized.name || 'Error',
      kind,
      severity,
      retryCount,
      exhausted,
    }

    try {
      if (this.props.onError) {
        this.props.onError(payload)
      } else {
        // Dev-only diagnostic - do not log the full message in production.
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary]', payload.name, kind, severity, retryCount)
      }
    } catch {
      // Telemetry must never break the fallback render.
    }

    // info.componentStack is deliberately not forwarded to telemetry to
    // avoid leaking internal component names and props to external sinks.
    void info
  }

  /**
   * Reset the boundary so the subtree re-mounts. Idempotent when no error
   * is present. Bounded by `maxRetries` to guarantee termination.
   */
  private handleReset = (): void => {
    const { hasError } = this.state
    if (!hasError && this.state.error === null) return

    const nextRetryCount = this.state.retryCount + 1
    if (nextRetryCount > this.maxRetries) {
      // Budget exhausted - keep the error visible but stop auto-retrying.
      this.setState({ retryCount: this.maxRetries })
      return
    }

    this.setState({ hasError: false, error: null, retryCount: nextRetryCount })
  }

  /**
   * Fully clear the boundary and reset the retry budget. Used by the
   * terminal fallback's "go home" action so a new failure chain gets a fresh
   * budget.
   */
  private handleResetAll = (): void => {
    this.setState({ hasError: false, error: null, retryCount: 0 })
  }

  private get isExhausted(): boolean {
    return this.state.retryCount >= this.maxRetries
  }

  private renderTerminalFallback(): ReactNode {
    const { error } = this.state
    const normalized = error ?? new Error('Unknown error')
    const { kind, severity } = this.classifyError(normalized)

    return (
      <div className="error-fallback-container" data-error-boundary="true" data-error-terminal="true">
        <ErrorState
          type={kind}
          severity={severity}
          title="Something went wrong"
          message="The app hit an unexpected error and couldn’t recover on its own. Reload the page or head back to the home page."
          ariaLabel="Application error"
        />
        <a className="error-fallback-secondary-link" href="/" onClick={this.handleResetAll}>
          Go to home page
        </a>
      </div>
    )
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (hasError && error) {
      if (fallback) {
        // Custom fallbacks receive the reset callback and are responsible
        // for their own retry semantics. We still bound the auto-retry
        // budget via handleReset.
        return fallback(error, this.handleReset)
      }

      if (this.isExhausted) {
        return this.renderTerminalFallback()
      }

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
          <a className="error-fallback-secondary-link" href="/" onClick={this.handleResetAll}>
            Go to home page
          </a>
        </div>
      )
    }

    return children
  }
}
