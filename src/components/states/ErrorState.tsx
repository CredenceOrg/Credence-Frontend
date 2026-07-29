import { ReactNode } from 'react'
import './ErrorState.css'

/**
 * Error scenarios. Drives the default icon and the default copy deck.
 * Kept as a separate axis from `severity` so a "validation" error can be
 * presented as `info`, `warning`, or `danger` depending on context.
 *
 * `generic` is the default and falls back to a neutral info-circle glyph.
 *
 * `pageNotFound` is a dedicated variant for the 404 surface — a calmer
 * icon glyph (search / compass) with friendlier copy and a back-to-home
 * CTA. Use it from NotFound.tsx and RouteErrorPage when the route is a
 * confirmed 404.
 */
export type ErrorStateKind = 'network' | 'backend' | 'validation' | 'generic' | 'pageNotFound'

/**
 * Visual / aural severity.  Drives colour tone, role mapping, and
 * (loosely) how alarming the screen reads.
 *
 *  • danger  — default for blocking failures (network, backend, generic).
 *  • warning — recoverable / user-actionable failures (validation, slow).
 *  • info    — non-blocking but worth surfacing (cached fallback, etc.).
 */
export type ErrorStateSeverity = 'danger' | 'warning' | 'info'

interface ErrorStateProps {
  /** Error scenario. Affects icon glyph and default title/message. Default: 'generic'. */
  type?: ErrorStateKind
  /** Visual / aural severity. Default: derived from `type` (danger for most, info for pageNotFound). */
  severity?: ErrorStateSeverity
  /** Override default title for the given `type`. Pass an empty string to suppress the heading entirely. */
  title?: string
  /** Override default message for the given `type`. */
  message?: string
  /** Primary action — retry, navigate, open a doc page, etc. */
  action?: {
    label: string
    onClick: () => void
    /** Disable the button while async work is in flight. */
    isLoading?: boolean
  }
  /** Override the default icon glyph entirely. Receives `aria-hidden="true"`. */
  icon?: ReactNode
  /**
   * Suppress the inner heading (`h3`). Use when the surrounding page already
   * renders its own heading at a different level (e.g. an `<h1>` on the
   * NotFound page) to avoid duplicate same-text headings in the document
   * outline.
   */
  hideHeading?: boolean
  /** Spoken label for the surrounding region. Default: derived from the resolved title (no jargon prefix). */
  ariaLabel?: string
}

/**
 * Inline SVG icons for each error kind. All icons use `currentColor` and
 * `aria-hidden="true"` — the accessible name comes from the surrounding
 * title/message text (matches Banner.tsx / EmptyState.tsx / Toast.tsx).
 */
const ERROR_ICONS: Record<ErrorStateKind, ReactNode> = {
  network: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
  backend: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  validation: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  ),
  generic: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  pageNotFound: (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
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
  ),
}

/**
 * Default copy deck — calmer phrasing aligned with the UI States Guide:
 * honest, helpful, non-technical, apologetic but solution-focused. The
 * user can override any of these via props for context-specific messaging.
 */
const ERROR_COPY: Record<ErrorStateKind, { title: string; message: string }> = {
  network: {
    title: 'Connection issue',
    message:
      "We can't reach the service right now. Check your connection and try again in a moment.",
  },
  backend: {
    title: 'Service temporarily unavailable',
    message: "We're hitting a brief snag on our end. Try again in a moment and we'll be back.",
  },
  validation: {
    title: 'Check your input',
    message: 'One or more fields need attention. Review the highlighted items and try again.',
  },
  generic: {
    title: 'Something didn’t load',
    message:
      'An unexpected hiccup stopped this view. Try again — if it persists, reach out and we’ll help.',
  },
  pageNotFound: {
    title: 'Page not found',
    message: "The page you're looking for doesn't exist. It may have moved or been renamed.",
  },
}

/**
 * Default severity derived from each error kind. Callers can override
 * with `severity` prop when context demands it (e.g. a 404 is "info"
 * rather than "danger" because it is recoverable by navigation).
 */
const DEFAULT_SEVERITY: Record<ErrorStateKind, ErrorStateSeverity> = {
  network: 'danger',
  backend: 'danger',
  validation: 'warning',
  generic: 'danger',
  pageNotFound: 'info',
}

export default function ErrorState({
  type = 'generic',
  severity,
  title,
  message,
  action,
  icon,
  hideHeading = false,
  ariaLabel,
}: ErrorStateProps) {
  const resolvedSeverity = severity ?? DEFAULT_SEVERITY[type]
  const copy = ERROR_COPY[type]
  const showHeading = !hideHeading && title !== ''
  const resolvedTitle = showHeading ? (title ?? copy.title) : undefined
  const resolvedMessage = message ?? copy.message
  // The role="alert" already conveys severity to assistive tech, so avoid
  // leaking the literal word "Error" into the panel's accessible name.
  // Default to the resolved title only.
  const resolvedAriaLabel = ariaLabel ?? resolvedTitle ?? copy.title

  return (
    <div
      className={`error-state error-state--${resolvedSeverity}`}
      role="alert"
      aria-live="assertive"
      aria-label={resolvedAriaLabel}
      data-error-kind={type}
      data-error-severity={resolvedSeverity}
    >
      <div className="error-state__icon">{icon ?? ERROR_ICONS[type]}</div>
      {resolvedTitle && <h3 className="error-state__title">{resolvedTitle}</h3>}
      <p className={`error-state__message${action ? ' error-state__message--has-action' : ''}`}>
        {resolvedMessage}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="error-state__action"
          disabled={action.isLoading}
          aria-busy={action.isLoading}
        >
          {action.isLoading ? 'Retrying…' : action.label}
        </button>
      )}
    </div>
  )
}
