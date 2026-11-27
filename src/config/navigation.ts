import { ALL_NAV_LINKS } from './navLinks'

export const DEFAULT_FALLBACK_ROUTE = '/dashboard'

export const PUBLIC_ROUTES = ['/', '/trust', '/trust/summary', '/signin'] as const

export const PRIVATE_ROUTES = [
  '/dashboard',
  '/bond',
  '/bond/new',
  '/bond/:id',
  '/attestations',
  '/transactions',
  '/settings',
] as const

export interface NavigationLink {
  to: string
  label: string
  requiresWallet?: boolean
}

const navigationLinks: NavigationLink[] = ALL_NAV_LINKS.map((link) => ({
  ...link,
  label: link.ariaLabel,
}))

/** Header destinations; Home is available through the brand link. */
export const NAV_LINKS = navigationLinks.filter((link) => link.to !== '/')
export const NOT_FOUND_LINKS = navigationLinks.filter((link) => link.quickLinkIcon)
export const SUGGESTION_ROUTES = navigationLinks.map((link) => link.to)
const LABELS_BY_PATH = Object.fromEntries(navigationLinks.map(({ to, label }) => [to, label]))

export interface ActionLauncherItem {
  id: string
  label: string
  description: string
  to?: string
  action?: 'open-keyboard-shortcuts'
}

export const ACTION_LAUNCHER_ITEMS: ActionLauncherItem[] = [
  {
    id: 'home',
    label: LABELS_BY_PATH['/'],
    description: 'Return to the Credence landing page',
    to: '/',
  },
  {
    id: 'dashboard',
    label: LABELS_BY_PATH['/dashboard'],
    description: 'View your activity and trust score overview',
    to: '/dashboard',
  },
  {
    id: 'bond',
    label: LABELS_BY_PATH['/bond'],
    description: 'Manage existing USDC bonds and open the bond details page',
    to: '/bond',
  },
  {
    id: 'bond-new',
    label: 'Create bond',
    description: 'Start the USDC bond creation flow',
    to: '/bond/new',
  },
  {
    id: 'trust',
    label: LABELS_BY_PATH['/trust'],
    description: 'Open the trust score page and recent lookup history',
    to: '/trust',
  },
  {
    id: 'attestations',
    label: LABELS_BY_PATH['/attestations'],
    description: 'Review evidence and claims on attestations',
    to: '/attestations',
  },
  {
    id: 'transactions',
    label: LABELS_BY_PATH['/transactions'],
    description: 'Inspect recent account transactions and activity',
    to: '/transactions',
  },
  {
    id: 'settings',
    label: LABELS_BY_PATH['/settings'],
    description: 'Change appearance, network, display, and notification preferences',
    to: '/settings',
  },
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard shortcuts',
    description: 'Show the global keyboard shortcuts help dialog',
    action: 'open-keyboard-shortcuts',
  },
]

export const ACTION_LAUNCHER_RECENT_ACTIONS_KEY = 'credence:recent-actions'

export const ROUTE_LABELS: Record<string, string> = {
  ...Object.fromEntries(navigationLinks.map(({ to, label }) => [to, `${label} page`])),
  '/bond/new': 'Create bond page',
  '/trust/summary': 'Trust Score summary page',
  '/trust/:address': 'Trust Score profile page',
  '/attestations': 'Attestations page',
  '/transactions': 'Transactions page',
  '/settings': 'Settings page',
  '/signin': 'Sign in page',
}
