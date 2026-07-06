/**
 * Static registry of recent product updates surfaced in the "What's New" dialog.
 *
 * ## Adding a new update
 * 1. Prepend a new entry to `PRODUCT_UPDATES` (newest first).
 * 2. The dialog and unread-count badge update automatically — no other change needed.
 */

export interface ProductUpdate {
  /** Stable identifier used to track which updates the user has seen. */
  id: string
  /** ISO 8601 date string, e.g. "2026-06-29". */
  date: string
  title: string
  description: string
  tag: 'feature' | 'improvement' | 'fix'
}

/** All product updates, newest first. */
export const PRODUCT_UPDATES: readonly ProductUpdate[] = [
  {
    id: 'update-2026-06-back-to-top',
    date: '2026-06-29',
    title: 'Back-to-top button',
    description:
      'A "Back to top" button now appears after scrolling 800 px on any long page, letting you return to the page heading in one click.',
    tag: 'feature',
  },
  {
    id: 'update-2026-05-keyboard-shortcuts',
    date: '2026-05-20',
    title: 'Keyboard shortcuts reference',
    description:
      'Press Shift+? from anywhere in the app to open a full list of keyboard shortcuts.',
    tag: 'feature',
  },
  {
    id: 'update-2026-05-transaction-filter',
    date: '2026-05-15',
    title: 'Transaction status filter',
    description:
      'Filter your transaction history by status — pending, confirmed, or failed — directly on the Transactions page.',
    tag: 'improvement',
  },
  {
    id: 'update-2026-04-trust-gauge',
    date: '2026-04-10',
    title: 'Trust gauge visualization',
    description:
      'Your trust score is now displayed as an animated gauge with tier markers, making it easy to see how close you are to the next tier.',
    tag: 'feature',
  },
  {
    id: 'update-2026-03-dark-mode',
    date: '2026-03-01',
    title: 'Dark mode',
    description:
      'Toggle between light and dark themes from the header. Your preference is saved across sessions.',
    tag: 'feature',
  },
]

/**
 * The ID of the newest update. Used by `useProductUpdates` to determine whether
 * the user has seen all available updates.
 */
export const LATEST_UPDATE_ID = PRODUCT_UPDATES[0].id
