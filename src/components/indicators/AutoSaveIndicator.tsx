import { useEffect, useState } from 'react'
import { AUTO_SAVE_DEFAULTS } from '../../config/autoSave'
import type { AutoSaveStatus } from '../../hooks/useDebouncedAutoSave'
import './AutoSaveIndicator.css'

export interface AutoSaveIndicatorLabels {
  /** Shown while a save is in flight (or scheduled via the debounce). */
  saving: string
  /** Used as the prefix in `savedRelative` (e.g. `\"Saved just now\"`). */
  saved: string
  /**
   * Builds the relative-time label. Receives strings like `\"just now\"`,
   * `\"5s ago\"`, `\"3m ago\"`, or an ISO timestamp.
   */
  savedRelative: (relative: string) => string
  /** Shown when the most recent save failed. */
  error: string
  /** Label of the inline retry button (only rendered if `onRetry` is set). */
  retry: string
}

export interface AutoSaveIndicatorProps {
  status: AutoSaveStatus
  /** Unix-ms timestamp of the most recent successful save; null until then. */
  lastSavedAt: number | null
  /** i18n-aware text bundle. Passed in so the indicator stays a pure presentational component. */
  labels: AutoSaveIndicatorLabels
  /**
   * Optional retry handler. Rendered as an inline button when `status === 'error'`.
   * The label used for the button is `labels.retry`. Callers can read the
   * underlying error from `useDebouncedAutoSave().error` if they need to log it.
   */
  onRetry?: () => void
  /** Optional override for the visible-after-save duration (`AUTO_SAVE_DEFAULTS.PILL_TTL_MS`). */
  ttlMs?: number
  /** Layout / spacing tweaks; appended to the pill root class. */
  className?: string
}

function formatRelative(lastSavedAt: number, now: number): string {
  const diff = Math.max(0, now - lastSavedAt)
  if (diff < 5_000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1_000)}s ago`
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`
  return new Date(lastSavedAt).toLocaleString()
}

/**
 * Token-driven status pill for the auto-save flow on the Settings page
 * (closes #564). Visual states:
 *
 *  - `pending` / `saving` → small spinner + `Saving…` label, info-toned
 *  - `saved`              → checks via `lastSavedAt` against `ttlMs`,
 *                           shows `Saved just now` / `Saved 5s ago` etc.
 *  - `error`              → error-toned pill + optional retry button
 *  - `idle`               → renders nothing
 *
 * Accessibility:
 *  - The element is `role="status"` with `aria-live="polite"` so the
 *    status change is announced without yanking focus.
 *  - Retry control is a real `<button>` so it is keyboard-reachable
 *    independently of the rest of the form.
 *
 * Visibility: the pill auto-hides `ttlMs` after the last successful save.
 * `ttlMs` does NOT mutate the upstream `status`; the next value change
 * re-enters `pending` and the pill returns naturally.
 */
export default function AutoSaveIndicator({
  status,
  lastSavedAt,
  labels,
  onRetry,
  ttlMs = AUTO_SAVE_DEFAULTS.PILL_TTL_MS,
  className,
}: AutoSaveIndicatorProps) {
  // Tick once every PILL_REFRESH_MS while in `saved` so relative-time labels
  // (`Saved 5s ago` → `Saved 6s ago`) stay accurate without forcing the
  // whole Settings page to manage its own timer.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (status !== 'saved' || lastSavedAt === null) return
    const id = setInterval(() => setNow(Date.now()), AUTO_SAVE_DEFAULTS.PILL_REFRESH_MS)
    return () => clearInterval(id)
  }, [status, lastSavedAt])

  const isVisible = (() => {
    if (status === 'error' || status === 'saving' || status === 'pending') return true
    if (status === 'saved' && lastSavedAt !== null) {
      return now - lastSavedAt <= ttlMs
    }
    return false
  })()

  if (!isVisible) return null

  const rootClass = [
    'auto-save-indicator',
    `auto-save-indicator--${status}`,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  let body: React.ReactNode = null
  if (status === 'saving' || status === 'pending') {
    body = (
      <>
        <span className="auto-save-indicator__spinner" aria-hidden="true" />
        <span className="auto-save-indicator__text">{labels.saving}</span>
      </>
    )
  } else if (status === 'saved') {
    const relative = formatRelative(lastSavedAt as number, now)
    body = (
      <span className="auto-save-indicator__text">{labels.savedRelative(relative)}</span>
    )
  } else if (status === 'error') {
    body = (
      <>
        <span className="auto-save-indicator__text">{labels.error}</span>
        {onRetry && (
          <button
            type="button"
            className="auto-save-indicator__retry"
            onClick={onRetry}
            aria-label={labels.retry}
          >
            {labels.retry}
          </button>
        )}
      </>
    )
  }
  return (
    <div className={rootClass} role="status" aria-live="polite">
      {body}
    </div>
  )
}
