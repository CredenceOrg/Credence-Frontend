import { useLocation, useMatches, Link } from 'react-router-dom'
import './Breadcrumbs.css'

/**
 * Map route segments to breadcrumb labels.
 * Used to derive user-friendly breadcrumb text from the current route path.
 *
 * Example:
 *   Route: /bond → Label: "Bond"
 *   Route: /trust → Label: "Trust Score"
 *   Route: /settings → Label: "Settings"
 */
const ROUTE_LABEL_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  bond: 'Bond',
  trust: 'Trust Score',
  settings: 'Settings',
  attestations: 'Attestations',
  transactions: 'Transactions',
}

/**
 * Derive breadcrumb label for a route segment.
 * Handles parameterized routes via route label map.
 *
 * @param segment - Route segment (e.g., "bond", "trust")
 * @returns User-friendly breadcrumb label
 */
function getLabelForSegment(segment: string): string {
  // Check if it's a known route
  if (segment in ROUTE_LABEL_MAP) {
    return ROUTE_LABEL_MAP[segment]
  }

  // Fallback: capitalize segment if no mapping found
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

/**
 * Build breadcrumb trail from the current route.
 * Filters out root and unknown routes; skips home on index.
 *
 * @returns Array of breadcrumb items with path and label
 */
function useBreadcrumbs(): Array<{ path: string; label: string }> {
  const location = useLocation()
  const matches = useMatches()

  // Parse pathname into segments
  const segments = location.pathname.split('/').filter((seg) => seg.length > 0)

  // Home route: no breadcrumbs
  if (segments.length === 0) {
    return []
  }

  // Build breadcrumb trail
  const trail: Array<{ path: string; label: string }> = []

  segments.forEach((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    const label = getLabelForSegment(segment)

    trail.push({ path, label })
  })

  // Filter out unknown routes (check if path matches a known route)
  const knownPaths = new Set(
    matches.map((match) => match.pathname).filter((pathname) => pathname !== '/')
  )

  return trail.filter((crumb) => knownPaths.has(crumb.path))
}

/**
 * Breadcrumbs component for route navigation.
 *
 * Renders a navigation landmark with the current route hierarchy.
 * Hidden on the home route and for unknown routes.
 *
 * Accessibility:
 * - nav[aria-label="Breadcrumb"] semantic landmark
 * - aria-current="page" on the last (current) breadcrumb
 * - Decorative separators with aria-hidden
 * - Full keyboard navigation via native links
 *
 * @example
 * ```tsx
 * <Breadcrumbs />
 * // On /bond/new:
 * // <nav aria-label="Breadcrumb">
 * //   <ol>
 * //     <li><Link to="/bond">Bond</Link> <span aria-hidden>/</span></li>
 * //     <li><span aria-current="page">new</span></li>
 * //   </ol>
 * // </nav>
 * ```
 */
export default function Breadcrumbs() {
  const breadcrumbs = useBreadcrumbs()

  // Hide on home route
  if (breadcrumbs.length === 0) {
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs-list">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1

          return (
            <li key={crumb.path} className="breadcrumbs-item">
              {isLast ? (
                // Last crumb: current page (not a link)
                <span aria-current="page" className="breadcrumbs-link breadcrumbs-link--current">
                  {crumb.label}
                </span>
              ) : (
                // Navigable crumb
                <Link to={crumb.path} className="breadcrumbs-link">
                  {crumb.label}
                </Link>
              )}
              {!isLast && (
                <span aria-hidden="true" className="breadcrumbs-separator">
                  /
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
