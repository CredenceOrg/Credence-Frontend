/**
 * Shared navigation-link configuration.
 *
 * Single source of truth for route labels and navigation destinations:
 *  - BottomNav  (primary routes, fixed bar visible on ≤ BREAKPOINTS.MD)
 *  - MobileNav  (secondary/overflow routes, hamburger drawer)
 *  - Layout and NotFound (derived through navigation.ts)
 */

export interface NavLink {
  /** React Router destination path */
  to: string
  /** i18n translation key under the `nav.*` namespace */
  labelKey: string
  /** Accessible label used as aria-label when the link is icon-only */
  ariaLabel: string
  /** SVG path for routes promoted to 404 quick navigation. */
  quickLinkIcon?: string
}

/**
 * The 5 routes promoted to the fixed bottom navigation bar.
 * Order determines left-to-right tab order.
 */
export const PRIMARY_NAV_LINKS: readonly NavLink[] = [
  {
    to: '/dashboard',
    labelKey: 'nav.dashboard',
    ariaLabel: 'Dashboard',
    quickLinkIcon:
      'M4 3h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M15 3h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M15 12h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z M4 16h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z',
  },
  {
    to: '/bond',
    labelKey: 'nav.bond',
    ariaLabel: 'Bond',
    quickLinkIcon:
      'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4',
  },
  {
    to: '/trust',
    labelKey: 'nav.trustScore',
    ariaLabel: 'Trust Score',
    quickLinkIcon:
      'M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z',
  },
  { to: '/attestations', labelKey: 'nav.attestations', ariaLabel: 'Attestations' },
  { to: '/transactions', labelKey: 'nav.transactions', ariaLabel: 'Transactions' },
] as const

/**
 * Secondary routes accessible only through the hamburger drawer.
 * These are NOT shown in the bottom bar.
 */
export const SECONDARY_NAV_LINKS: readonly NavLink[] = [
  { to: '/', labelKey: 'nav.home', ariaLabel: 'Home' },
  {
    to: '/settings',
    labelKey: 'nav.settings',
    ariaLabel: 'Settings',
    quickLinkIcon:
      'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
  },
] as const

/** All public navigation destinations, including Home. */
export const ALL_NAV_LINKS: readonly NavLink[] = [...PRIMARY_NAV_LINKS, ...SECONDARY_NAV_LINKS]
