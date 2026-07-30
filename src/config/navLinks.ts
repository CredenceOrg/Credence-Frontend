/**
 * Shared navigation-link configuration.
 *
 * Single source of truth consumed by both:
 *  - BottomNav  (primary routes, fixed bar visible on ≤ BREAKPOINTS.MD)
 *  - MobileNav  (secondary/overflow routes, hamburger drawer)
 */

export interface NavLink {
  /** React Router destination path */
  to: string
  /** i18n translation key under the `nav.*` namespace */
  labelKey: string
  /** Accessible label used as aria-label when the link is icon-only */
  ariaLabel: string
}

/**
 * The 5 routes promoted to the fixed bottom navigation bar.
 * Order determines left-to-right tab order.
 */
export const PRIMARY_NAV_LINKS: readonly NavLink[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', ariaLabel: 'Dashboard' },
  { to: '/bond', labelKey: 'nav.bond', ariaLabel: 'Bond' },
  { to: '/trust', labelKey: 'nav.trustScore', ariaLabel: 'Trust Score' },
  { to: '/attestations', labelKey: 'nav.attestations', ariaLabel: 'Attestations' },
  { to: '/transactions', labelKey: 'nav.transactions', ariaLabel: 'Transactions' },
] as const

/**
 * Secondary routes accessible only through the hamburger drawer.
 * These are NOT shown in the bottom bar.
 */
export const SECONDARY_NAV_LINKS: readonly NavLink[] = [
  { to: '/', labelKey: 'nav.home', ariaLabel: 'Home' },
  { to: '/settings', labelKey: 'nav.settings', ariaLabel: 'Settings' },
] as const
