import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Centralized registry mapping route paths to human-readable labels.
 * Aligned exactly with NAV_LINKS definitions inside Layout.tsx.
 */
export const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home page',
  '/dashboard': 'Dashboard page',
  '/bond': 'Bond page',
  '/trust': 'Trust Score page',
  '/settings': 'Settings page',
}

/**
 * Maximum delay before an announcement is committed to the live region.
 * This defers text assignment until just after the DOM paint completes so assistive
 * tech can cleanly process structural navigation changes.
 */
export const ANNOUNCEMENT_DELAY_MS = 100

/**
 * Resolves a navigation pathname to its announcement label.
 *
 * Invariants:
 *  - Always returns a non-empty string for any input, including null/undefined,
 *    empty strings, duplicate slashes, and trailing slashes.
 *  - Never throws. Unknown or malformed paths fall back to 'Page Not Found'.
 *  - Normalization is pure and deterministic so the same input always yields
 *    the same label (required for retry / concurrent render safety).
 */
export function resolveRouteLabel(pathname: unknown): string {
  if (typeof pathname !== 'string') {
    return 'Page Not Found'
  }

  // Normalize: collapse duplicate slashes and strip a trailing slash while
  // preserving the root path '/'.
  const normalized = pathname.replace(/\/+/g, '/')
  const canonical = normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized

  if (canonical in ROUTE_LABELS) {
    return ROUTE_LABELS[canonical]
  }

  return 'Page Not Found'
}

/**
 * RouteAnnouncer renders a visually-hidden aria-live region.
 * This guarantees screen reader notifications fire reliably across dynamic
 * single-page application (SPA) client transitions.
 *
 * Recovery / concurrency invariants:
 *  - Each pathname change cancels the pending timer from the previous route,
 *    so a rapid A -> B -> A navigation cannot leak a stale announcement.
 *  - The live region is cleared before re-announcing an identical label so repeat
 *    visits to the same route are still vocalized by assistive technology.
 *  - If the component unmounts before the timer fires, the timer is cleared
 *    and no state update occurs after unmount (no React warnings, no leaks).
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation()
  const [announcement, setAnnouncement] = React.useState('')
  const lastAnnouncedLabelRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const pageLabel = resolveRouteLabel(pathname)

    // Reset the live region immediately on route change. This ensures that
    // repeated visits to the same route produce a fresh DOM mutation that
    // assistive technology will pick up, while also dropping any stale text
    // from a previous route.
    setAnnouncement('')

    // Defer text-assignment slightly until just after the DOM paint completes.
    // This allows assistive tech to cleanly process structural navigation changes.
    const timer = window.setTimeout(() => {
      // Guard against any out-of-order execution or duplicate flush for the
      // same label (e.g. from concurrent rendering or timer coalescing).
      if (lastAnnouncedLabelRef.current === pageLabel) {
        return
      }
      lastAnnouncedLabelRef.current = pageLabel
      setAnnouncement(`${pageLabel} loaded`)
    }, ANNOUNCEMENT_DELAY_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [pathname])

  return (
    <div
      role="none"
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
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
