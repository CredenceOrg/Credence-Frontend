import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Centralized registry mapping route paths to human-readable labels.
 * Aligned exactly with NAV_LINKS definitions inside Layout.tsx.
 */
const ROUTE_LABELS: Record<string, string> = {
  '/': 'Home page',
  '/dashboard': 'Dashboard page',
  '/bond': 'Bond page',
  '/trust': 'Trust Score page',
  '/settings': 'Settings page',
}

/**
 * RouteAnnouncer renders a visually-hidden aria-live region.
 * This guarantees screen reader notifications fire reliably across dynamic
 * single-page application (SPA) client transitions.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation()
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    // Fallback gracefully handles catch-all configurations or unmapped routes like 404s
    const pageLabel = ROUTE_LABELS[pathname] || 'Page Not Found'

    // Defer text-assignment slightly until just after the DOM paint completes.
    // This allows assistive tech to cleanly process structural navigation changes.
    const timer = setTimeout(() => {
      setAnnouncement(`${pageLabel} loaded`)
    }, 100)

    return () => clearTimeout(timer)
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
