import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTE_LABELS } from '../config/navigation'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Delay (ms) between the pathname change and the live-region text update.
 *
 * Rationale: screen readers observe the DOM *after* the browser has committed
 * the new render. Updating the text immediately (0 ms) races with the paint;
 * 100 ms is the established minimum that lets assistive technology cleanly
 * register the structural navigation change before the text update fires.
 */
export const ANNOUNCE_DELAY_MS = 100

/**
 * Backward-compatible alias for ANNOUNCE_DELAY_MS.
 */
export const ANNOUNCEMENT_DELAY_MS = ANNOUNCE_DELAY_MS

/**
 * Maximum safe length for a page label injected into the live region.
 */
export const MAX_LABEL_LENGTH = 200

/**
 * Fallback label used when a pathname has no entry in the registry.
 */
export const UNKNOWN_ROUTE_LABEL = 'Page Not Found'

// ---------------------------------------------------------------------------
// Pure Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a human-readable page label for a given pathname.
 *
 * Normalizes duplicate slashes and trailing slashes, checks exact match in
 * registry, checks parent path for single-level dynamic segments (e.g. /bond/1),
 * and falls back to UNKNOWN_ROUTE_LABEL.
 */
export function resolvePageLabel(
  pathname?: string | null | unknown,
  registry: Record<string, string> = ROUTE_LABELS,
): string {
  if (typeof pathname !== 'string' || !pathname.trim()) {
    return UNKNOWN_ROUTE_LABEL
  }

  // Normalize duplicate slashes (e.g. /// -> /, //dashboard/ -> /dashboard/)
  const collapsed = pathname.replace(/\/+/g, '/')
  // Normalize trailing slashes (e.g. /dashboard/ -> /dashboard), keeping root / intact
  const normalized = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed

  // 1. Exact match
  const exact = registry[normalized]
  if (exact) return exact

  // 2. Parameterised-route match: strip the last path segment and retry.
  const lastSlash = normalized.lastIndexOf('/')
  if (lastSlash > 0) {
    const parent = normalized.slice(0, lastSlash)
    const parentLabel = registry[parent]
    if (parentLabel) return parentLabel
  }

  // 3. Static fallback — never contains user input
  return UNKNOWN_ROUTE_LABEL
}

/**
 * Backward-compatible alias for resolvePageLabel.
 */
export const resolveRouteLabel = resolvePageLabel

/**
 * Clamps a label to MAX_LABEL_LENGTH with a trailing ellipsis.
 */
export function clampLabel(label: string): string {
  if (label.length <= MAX_LABEL_LENGTH) return label
  return label.slice(0, MAX_LABEL_LENGTH - 1) + '…'
}

/**
 * Builds the full announcement string from a page label.
 */
export function buildAnnouncement(label: string): string {
  return `${clampLabel(label)} loaded`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RouteAnnouncer renders a visually-hidden aria-live region that announces
 * client-side SPA route transitions to screen readers.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation()
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    // Clear synchronously so that repeated navigation to the same path
    // or same label triggers a DOM mutation and re-announces.
    setAnnouncement('')

    const timer = setTimeout(() => {
      const label = resolvePageLabel(pathname)
      setAnnouncement(buildAnnouncement(label))
    }, ANNOUNCE_DELAY_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [pathname])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-relevant="additions text"
      className="sr-only"
      data-testid="route-announcer"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcement}
    </div>
  )
}
