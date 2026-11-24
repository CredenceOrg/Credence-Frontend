import { ReactNode } from 'react'
import './EmptyState.css'

/**
 * Failure-boundary states for the EmptyState component.
 *
 * Drives the default icon, copy deck, ARIA attributes, and visual tone:
 *
 *  • `idle`        – default; no data has loaded yet (the classic empty state).
 *  • `loading`     – an async operation is in-flight; content is pending.
 *  • `error`       – a fetch / mutation failed; a retry action is expected.
 *  • `stale`       – data exists but may be outdated; a refresh is offered.
 *  • `permission`  – the user lacks the authorisation to view this content.
 *
 * State-transition invariants:
 *  1. `loading` → `idle` | `error` | `stale` (never directly to `permission`).
 *  2. `error` may expose a retry CTA via the `action` prop; the handler is
 *     called at most once per render cycle (no double-fire from disabled state).
 *  3. `stale` is non-blocking — content may still be displayed alongside the
 *     state; the component itself renders the hint only.
 *  4. `permission` never exposes a retry CTA (retrying would not help).
 *     If an `action` is provided with `variant='primary'` it is treated as
 *     a navigation/sign-in affordance, not a retry.
 */
export type EmptyStateKind = 'idle' | 'loading' | 'error' | 'stale' | 'permission'

interface EmptyStateProps {
  /**
   * Failure-boundary kind.  Drives icon, copy defaults, and ARIA attributes.
   * Defaults to `'idle'` (the classic empty-state surface).
   */
  kind?: EmptyStateKind
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
    isLoading?: boolean
  }
  illustration?: 'bond' | 'trust' | 'dispute' | 'attestation' | 'activity'
  /**
   * Spoken label for the surrounding region.
   * Defaults to the `title` prop when not provided.
   * Use to provide a more specific label when the title alone is ambiguous.
   */
  ariaLabel?: string
  /**
   * Optional data attribute forwarded to the root element for telemetry /
   * integration-test selectors without coupling to class-name details.
   * Example: `data-testid="bonds-empty"`.
   */
  'data-testid'?: string
}

/**
 * Inline SVG icons for each illustration variant.
 * All icons use `currentColor` and `aria-hidden="true"` — the accessible name
 * comes from the surrounding title/description text, matching Toast.tsx / ThemeToggle.tsx.
 */
const ILLUSTRATION_ICONS: Record<NonNullable<EmptyStateProps['illustration']>, ReactNode> = {
  bond: (
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  trust: (
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
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  dispute: (
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
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  attestation: (
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  activity: (
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
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
}

/**
 * Fallback icons for each failure-boundary kind.
 * Rendered when no `icon` prop and no `illustration` is provided.
 * All icons use `aria-hidden="true"` — accessible name comes from the
 * surrounding title/description text (same contract as ErrorState.tsx).
 */
const KIND_ICONS: Record<EmptyStateKind, ReactNode> = {
  idle: null, // no default icon for the classic empty state
  loading: (
    /* Circular spinner — purely decorative; aria-hidden on the svg */
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
      className="empty-state__spinner-icon"
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  ),
  error: (
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
  stale: (
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
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  permission: (
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
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
}

/**
 * ARIA role mapping per kind.
 *
 *  • `loading`    → `status` + `aria-live="polite"` (non-urgent update).
 *  • `error`      → `alert`  + `aria-live="assertive"` (user action required).
 *  • `stale`      → `status` + `aria-live="polite"` (informational hint).
 *  • `permission` → `alert`  + `aria-live="polite"` (important but not urgent).
 *  • `idle`       → no ARIA role override; plain decorative landmark.
 */
type AriaRole = 'alert' | 'status' | undefined

const KIND_ARIA_ROLE: Record<EmptyStateKind, AriaRole> = {
  idle: undefined,
  loading: 'status',
  error: 'alert',
  stale: 'status',
  permission: 'alert',
}

const KIND_ARIA_LIVE: Record<EmptyStateKind, 'assertive' | 'polite' | undefined> = {
  idle: undefined,
  loading: 'polite',
  error: 'assertive',
  stale: 'polite',
  permission: 'polite',
}

export default function EmptyState({
  kind = 'idle',
  icon,
  title,
  description,
  action,
  illustration,
  ariaLabel,
  'data-testid': dataTestId,
}: EmptyStateProps) {
  const iconClass = illustration
    ? `empty-state__icon empty-state__icon--${illustration}`
    : 'empty-state__icon'

  // Priority: explicit icon > illustration > kind-specific default icon
  const renderedIcon = icon ? (
    <div className="empty-state__icon">{icon}</div>
  ) : illustration ? (
    <div className={iconClass}>{ILLUSTRATION_ICONS[illustration]}</div>
  ) : KIND_ICONS[kind] ? (
    <div className={`empty-state__icon empty-state__icon--${kind}`}>{KIND_ICONS[kind]}</div>
  ) : null

  // Invariant: permission state must never surface a "retry" affordance.
  // If the caller passes action.isLoading on a permission state we still
  // render the button (it may be a sign-in flow) but we do not set
  // aria-busy — retrying would not help.
  const isPermissionKind = kind === 'permission'
  const isLoadingKind = kind === 'loading'

  const role = KIND_ARIA_ROLE[kind]
  const ariaLive = KIND_ARIA_LIVE[kind]
  const resolvedAriaLabel = ariaLabel ?? title

  // Modifier class for root: adds kind-specific visual tone.
  // `idle` carries no modifier so existing callers see no visual diff.
  const rootClass = ['empty-state', kind !== 'idle' ? `empty-state--${kind}` : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      role={role}
      aria-live={ariaLive}
      aria-label={role ? resolvedAriaLabel : undefined}
      aria-busy={isLoadingKind ? true : undefined}
      data-empty-kind={kind}
      data-testid={dataTestId}
    >
      {renderedIcon}
      <h3 className="empty-state__title">{title}</h3>
      <p
        className={`empty-state__description${action ? ' empty-state__description--hasAction' : ''}`}
      >
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`empty-state__action${action.variant === 'secondary' ? ' empty-state__action--secondary' : ''}`}
          disabled={action.isLoading}
          aria-busy={!isPermissionKind && action.isLoading ? true : undefined}
        >
          {action.isLoading
            ? kind === 'error'
              ? 'Retrying\u2026'
              : 'Connecting\u2026'
            : action.label}
        </button>
      )}
    </div>
  )
}
