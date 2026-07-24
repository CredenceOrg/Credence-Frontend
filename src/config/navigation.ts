export interface NavigationLink {
  to: string
  label: string
}

export const NAV_LINKS: NavigationLink[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/bond', label: 'Bond' },
  { to: '/trust', label: 'Trust Score' },
  { to: '/attestations', label: 'Attestations' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/settings', label: 'Settings' },
]

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
    label: 'Home',
    description: 'Return to the Credence landing page',
    to: '/',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'View your activity and trust score overview',
    to: '/dashboard',
  },
  {
    id: 'bond',
    label: 'Bond',
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
    label: 'Trust Score',
    description: 'Open the trust score page and recent lookup history',
    to: '/trust',
  },
  {
    id: 'attestations',
    label: 'Attestations',
    description: 'Review evidence and claims on attestations',
    to: '/attestations',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    description: 'Inspect recent account transactions and activity',
    to: '/transactions',
  },
  {
    id: 'settings',
    label: 'Settings',
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
  '/': 'Home page',
  '/dashboard': 'Dashboard page',
  '/bond': 'Bond page',
  '/bond/new': 'Create bond page',
  '/trust': 'Trust Score page',
  '/trust/summary': 'Trust Score summary page',
  '/attestations': 'Attestations page',
  '/transactions': 'Transactions page',
  '/settings': 'Settings page',
  '/signin': 'Sign in page',
}
