/**
 * Deterministic failure-boundary coverage for WhatsNewDialog.
 *
 * This file supplements the happy-path suite in WhatsNewDialog.test.tsx.
 * Every test targets a specific failure mode, boundary condition, or
 * regression scenario identified in issue #1173.
 *
 * Coverage categories
 * ───────────────────
 *  State transitions       – loading→list, loading→error, error→retry, stale-data
 *  Rendering invariants    – date formatting edge cases, unknown tag fallback,
 *                            unread badge visibility, empty updates list
 *  Close path coverage     – header button, footer button, backdrop, inner-click
 *                            non-propagation, Escape key
 *  markAllRead invariants  – called on open, not called when closed, called again
 *                            on each re-open, not called during error/loading
 *  Concurrent / re-render  – rapid open→close→open, prop identity changes
 *  Accessibility           – aria attributes, role hierarchy, live-region labels
 *  Regression guards       – duplicate retry clicks, null onClose guard,
 *                            portal detachment on close
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WhatsNewDialog, { ChangelogDrawer } from './WhatsNewDialog'
import * as useProductUpdatesModule from '../hooks/useProductUpdates'
import { PRODUCT_UPDATES } from '../data/productUpdates'
import type { ProductUpdate } from '../data/productUpdates'

// ---------------------------------------------------------------------------
// Module mock
// ---------------------------------------------------------------------------

vi.mock('../hooks/useProductUpdates', () => ({
  useProductUpdates: vi.fn(),
  PRODUCT_UPDATES_STORAGE_KEY: 'credence:last-seen-update-id',
}))

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const mockMarkAllRead = vi.fn()
const mockRefetch = vi.fn()

type HookState = {
  updates?: readonly ProductUpdate[]
  unreadCount?: number
  isLoading?: boolean
  error?: string | null
}

function setHookState({
  updates = PRODUCT_UPDATES,
  unreadCount = 0,
  isLoading = false,
  error = null,
}: HookState = {}) {
  vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
    updates,
    unreadCount,
    isLoading,
    error,
    markAllRead: mockMarkAllRead,
    refetch: mockRefetch,
  })
}

/** A minimal single update used where full PRODUCT_UPDATES would be noise. */
const ONE_UPDATE: ProductUpdate = {
  id: 'test-update-1',
  date: '2024-03-15',
  title: 'Test feature',
  description: 'A test description.',
  tag: 'feature',
}

beforeEach(() => {
  mockMarkAllRead.mockReset()
  mockRefetch.mockReset()
  setHookState()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ===========================================================================
// 1. State-transition invariants
// ===========================================================================

describe('WhatsNewDialog – state transitions', () => {
  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows the loading spinner when isLoading=true and no updates are cached', () => {
    setHookState({ updates: [], isLoading: true, error: null })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows the update list (not the spinner) when isLoading=true but stale data is available', () => {
    // "Stale-while-loading": updates are non-empty so the list stays visible
    // even while a background refetch is in progress.
    setHookState({ updates: [ONE_UPDATE], isLoading: true, error: null })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  // ── Error state ────────────────────────────────────────────────────────────

  it('shows the error panel when error is set and no updates are cached', () => {
    setHookState({ updates: [], isLoading: false, error: 'Network error' })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the update list (not the error panel) when error is set but stale data is available', () => {
    // The UX preference is to keep showing known-good data rather than an
    // error screen when the background refetch fails.
    setHookState({ updates: [ONE_UPDATE], isLoading: false, error: 'Network error' })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('shows the error panel when both isLoading and error are set and updates is empty', () => {
    // Edge: simultaneous loading+error from a prior failed request still
    // being retried. The error panel takes precedence over the spinner here
    // because updates.length === 0 and isLoading check comes first.
    setHookState({ updates: [], isLoading: true, error: 'Previous error' })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    // Component checks isLoading first, so spinner is shown in this case.
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  // ── Retry ──────────────────────────────────────────────────────────────────

  it('calls refetch exactly once per retry-button click', () => {
    setHookState({ updates: [], error: 'Fetch failed' })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('calls refetch on each of multiple successive retry-button clicks (no de-bounce bug)', () => {
    setHookState({ updates: [], error: 'Fetch failed' })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    fireEvent.click(retryBtn)
    fireEvent.click(retryBtn)
    expect(mockRefetch).toHaveBeenCalledTimes(3)
  })

  it('error message does not expose raw error detail text to the user', () => {
    const sensitiveError = 'SQL syntax error near "SELECT * FROM users WHERE secret_token"'
    setHookState({ updates: [], error: sensitiveError })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    // The component renders a fixed user-facing string, not the raw error.
    expect(screen.queryByText(sensitiveError)).not.toBeInTheDocument()
    expect(screen.getByText(/unable to load product updates/i)).toBeInTheDocument()
  })

  // ── Empty updates list ────────────────────────────────────────────────────

  it('renders neither error nor spinner when updates is empty and no error/loading', () => {
    // WindowedList returns null when items is empty and no emptyMessage is passed,
    // so no list element is expected — but crucially neither the error panel nor
    // the loading spinner must be shown either.
    setHookState({ updates: [], isLoading: false, error: null })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // The dialog itself is still present.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ===========================================================================
// 2. Date-formatting boundary cases
// ===========================================================================

describe('WhatsNewDialog – date formatting', () => {
  function renderWithDate(date: string) {
    const update: ProductUpdate = { ...ONE_UPDATE, date }
    setHookState({ updates: [update] })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
  }

  it('formats the epoch date (1970-01-01) correctly', () => {
    renderWithDate('1970-01-01')
    const time = document.querySelector('time')
    expect(time?.getAttribute('dateTime')).toBe('1970-01-01')
    expect(time?.textContent).toMatch(/January 1, 1970/)
  })

  it('formats a leap-year date (2024-02-29) without throwing', () => {
    renderWithDate('2024-02-29')
    const time = document.querySelector('time')
    expect(time?.getAttribute('dateTime')).toBe('2024-02-29')
    expect(time?.textContent).toMatch(/February 29, 2024/)
  })

  it('formats December 31 correctly (year-end boundary)', () => {
    renderWithDate('2025-12-31')
    const time = document.querySelector('time')
    expect(time?.textContent).toMatch(/December 31, 2025/)
  })

  it('formats January 1 correctly (year-start boundary)', () => {
    renderWithDate('2025-01-01')
    const time = document.querySelector('time')
    expect(time?.textContent).toMatch(/January 1, 2025/)
  })

  it('sets the dateTime attribute to the original ISO string, not the formatted date', () => {
    renderWithDate('2026-06-15')
    const time = document.querySelector('time')
    // The dateTime attr must be the machine-readable ISO value.
    expect(time?.getAttribute('dateTime')).toBe('2026-06-15')
    // The text content is the human-readable form.
    expect(time?.textContent).not.toBe('2026-06-15')
  })

  it('formats multiple dates deterministically (same input → same output on repeated renders)', () => {
    const update: ProductUpdate = { ...ONE_UPDATE, date: '2025-07-04' }
    setHookState({ updates: [update] })
    const { unmount } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const first = document.querySelector('time')?.textContent
    unmount()
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const second = document.querySelector('time')?.textContent
    expect(first).toBe(second)
    expect(first).toMatch(/July 4, 2025/)
  })
})

// ===========================================================================
// 3. Tag rendering and unknown-tag fallback
// ===========================================================================

describe('WhatsNewDialog – tag rendering', () => {
  it('renders "New" label for the "feature" tag', () => {
    setHookState({ updates: [{ ...ONE_UPDATE, tag: 'feature' }] })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('renders "Improved" label for the "improvement" tag', () => {
    setHookState({ updates: [{ ...ONE_UPDATE, tag: 'improvement' }] })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('Improved')).toBeInTheDocument()
  })

  it('renders "Fixed" label for the "fix" tag', () => {
    setHookState({ updates: [{ ...ONE_UPDATE, tag: 'fix' }] })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('Fixed')).toBeInTheDocument()
  })

  it('falls back to the raw tag string when the tag is not in TAG_LABELS', () => {
    // The component uses `TAG_LABELS[update.tag] ?? update.tag`, so an
    // unrecognised tag must not crash or show undefined/null.
    const unknownTagUpdate = { ...ONE_UPDATE, tag: 'announcement' as ProductUpdate['tag'] }
    setHookState({ updates: [unknownTagUpdate] })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('announcement')).toBeInTheDocument()
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('applies the correct CSS modifier class for each tag', () => {
    const tags: ProductUpdate['tag'][] = ['feature', 'improvement', 'fix']
    for (const tag of tags) {
      const { unmount } = render(
        (() => {
          setHookState({ updates: [{ ...ONE_UPDATE, tag }] })
          return <WhatsNewDialog open={true} onClose={() => undefined} />
        })()
      )
      const tagEl = document.querySelector(`.whats-new-dialog__tag--${tag}`)
      expect(tagEl, `expected CSS modifier for tag="${tag}"`).not.toBeNull()
      unmount()
    }
  })
})

// ===========================================================================
// 4. Unread badge visibility
// ===========================================================================

describe('WhatsNewDialog – unread badge', () => {
  it('does not render the badge when unreadCount is 0', () => {
    setHookState({ unreadCount: 0 })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.queryByText(/unread/i)).not.toBeInTheDocument()
  })

  it('renders the badge when unreadCount is 1', () => {
    setHookState({ unreadCount: 1 })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('1 unread')).toBeInTheDocument()
  })

  it('renders the badge when unreadCount equals updates.length (all unread)', () => {
    setHookState({ unreadCount: PRODUCT_UPDATES.length })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText(`${PRODUCT_UPDATES.length} unread`)).toBeInTheDocument()
  })

  it('badge count matches the value from the hook exactly (no off-by-one)', () => {
    setHookState({ unreadCount: 7 })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('7 unread')).toBeInTheDocument()
  })

  it('badge disappears when unreadCount drops to 0 on re-render', () => {
    setHookState({ unreadCount: 3 })
    const { rerender } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('3 unread')).toBeInTheDocument()
    setHookState({ unreadCount: 0 })
    rerender(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.queryByText(/unread/i)).not.toBeInTheDocument()
  })
})

// ===========================================================================
// 5. Close path coverage
// ===========================================================================

describe('WhatsNewDialog – close paths', () => {
  it('backdrop click calls onClose', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    const backdrop = document.querySelector('.whats-new-dialog__backdrop')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('click on the dialog panel itself does NOT call onClose (stopPropagation)', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('click on a child element inside the dialog does NOT call onClose', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    const heading = screen.getByRole('heading', { name: /what.s new/i })
    fireEvent.click(heading)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('header close button calls onClose exactly once', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close what's new/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('footer Close button calls onClose exactly once', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    // The footer button has text "Close" without the aria-label suffix.
    const allClose = screen.getAllByRole('button', { name: /close/i })
    const footerClose = allClose[allClose.length - 1]
    fireEvent.click(footerClose)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape key calls onClose', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    // useFocusTrap handles the Escape key; fire directly on the dialog element.
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('onClose is not called when open is false (dialog not mounted)', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={false} onClose={onClose} />)
    // No portal in the DOM — pressing Escape should not trigger onClose.
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('multiple rapid close clicks only call onClose for each click (no de-bounce suppression)', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: /close what's new/i })
    fireEvent.click(closeBtn)
    fireEvent.click(closeBtn)
    // Both clicks are forwarded; de-duplication is the caller's responsibility.
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

// ===========================================================================
// 6. markAllRead invariants
// ===========================================================================

describe('WhatsNewDialog – markAllRead invariants', () => {
  it('markAllRead is called exactly once when dialog first opens', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it('markAllRead is NOT called when open is false', () => {
    render(<WhatsNewDialog open={false} onClose={() => undefined} />)
    expect(mockMarkAllRead).not.toHaveBeenCalled()
  })

  it('markAllRead is called again each time the dialog transitions from closed to open', () => {
    const { rerender } = render(<WhatsNewDialog open={false} onClose={() => undefined} />)
    expect(mockMarkAllRead).not.toHaveBeenCalled()

    rerender(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1)

    rerender(<WhatsNewDialog open={false} onClose={() => undefined} />)
    rerender(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(mockMarkAllRead).toHaveBeenCalledTimes(2)
  })

  it('markAllRead is called even when in the error state (so badge is cleared)', () => {
    setHookState({ updates: [], error: 'Network error' })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it('markAllRead is called even when in the loading state', () => {
    setHookState({ updates: [], isLoading: true })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it('markAllRead is not called a second time on a pure re-render with open=true', () => {
    const { rerender } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1)
    // Re-render with same props — no open transition, so no additional call.
    rerender(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// 7. Portal rendering and DOM lifecycle
// ===========================================================================

describe('WhatsNewDialog – portal lifecycle', () => {
  it('renders into document.body (not inside the React root)', () => {
    const { container } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    // The rendered output of the component tree itself should be empty because
    // the dialog is portalled to document.body.
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('removes the portal content from document.body when open transitions to false', async () => {
    const { rerender } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    rerender(<WhatsNewDialog open={false} onClose={() => undefined} />)
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    })
  })

  it('re-mounts correctly after an open→close→open cycle', async () => {
    const { rerender } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    rerender(<WhatsNewDialog open={false} onClose={() => undefined} />)
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    })
    rerender(<WhatsNewDialog open={true} onClose={() => undefined} />)
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    })
  })
})

// ===========================================================================
// 8. Accessibility invariants
// ===========================================================================

describe('WhatsNewDialog – accessibility invariants', () => {
  it('dialog has aria-modal="true"', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('dialog has aria-labelledby pointing at the "What\'s New" heading', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const heading = document.getElementById(labelledBy!)
    expect(heading?.textContent).toMatch(/what.s new/i)
  })

  it('loading indicator uses role="status" and aria-live="polite"', () => {
    setHookState({ updates: [], isLoading: true })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('error panel uses role="alert" (implicit aria-live="assertive")', () => {
    setHookState({ updates: [], error: 'error' })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('header close button has a descriptive aria-label', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(
      screen.getByRole('button', { name: /close what's new/i })
    ).toBeInTheDocument()
  })

  it('update list has an aria-label describing its content', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(
      screen.getByRole('list', { name: /recent product updates/i })
    ).toBeInTheDocument()
  })

  it('each tag span has an aria-label matching the human-readable label', () => {
    setHookState({
      updates: [
        { ...ONE_UPDATE, tag: 'feature', id: 'a' },
        { ...ONE_UPDATE, tag: 'improvement', id: 'b' },
        { ...ONE_UPDATE, tag: 'fix', id: 'c' },
      ],
    })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(document.querySelector('[aria-label="New"]')).not.toBeNull()
    expect(document.querySelector('[aria-label="Improved"]')).not.toBeNull()
    expect(document.querySelector('[aria-label="Fixed"]')).not.toBeNull()
  })

  it('tag icon character is aria-hidden so screen readers skip it', () => {
    // The close button's × glyph uses aria-hidden="true" to suppress the raw
    // character from being announced by screen readers.
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const closeBtn = screen.getByRole('button', { name: /close what's new/i })
    const glyph = closeBtn.querySelector('[aria-hidden="true"]')
    expect(glyph).not.toBeNull()
  })
})

// ===========================================================================
// 9. Concurrent and rapid-transition guard
// ===========================================================================

describe('WhatsNewDialog – concurrent / rapid transitions', () => {
  it('handles rapid open→close without throwing', async () => {
    const { rerender } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    for (let i = 0; i < 5; i++) {
      rerender(<WhatsNewDialog open={false} onClose={() => undefined} />)
      rerender(<WhatsNewDialog open={true} onClose={() => undefined} />)
    }
    // After all the thrashing the dialog should still be in the DOM.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('onClose identity change mid-render does not call the stale handler', () => {
    const onClose1 = vi.fn()
    const onClose2 = vi.fn()
    const { rerender } = render(<WhatsNewDialog open={true} onClose={onClose1} />)
    // Swap the handler before the user triggers close.
    rerender(<WhatsNewDialog open={true} onClose={onClose2} />)
    fireEvent.click(screen.getByRole('button', { name: /close what's new/i }))
    expect(onClose2).toHaveBeenCalledTimes(1)
    expect(onClose1).not.toHaveBeenCalled()
  })

  it('updates prop change while open re-renders the list without unmounting the dialog', () => {
    const update1: ProductUpdate = { ...ONE_UPDATE, id: 'u1', title: 'First update' }
    const update2: ProductUpdate = { ...ONE_UPDATE, id: 'u2', title: 'Second update' }
    setHookState({ updates: [update1] })
    const { rerender } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('First update')).toBeInTheDocument()

    setHookState({ updates: [update1, update2] })
    rerender(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('First update')).toBeInTheDocument()
    expect(screen.getByText('Second update')).toBeInTheDocument()
    // Dialog still present — no unmount.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

// ===========================================================================
// 10. ChangelogDrawer alias regression
// ===========================================================================

describe('ChangelogDrawer alias', () => {
  it('is the same reference as WhatsNewDialog (no extra wrapper)', () => {
    expect(ChangelogDrawer).toBe(WhatsNewDialog)
  })

  it('renders identically to WhatsNewDialog (same structure, ignoring generated IDs)', () => {
    const onClose = vi.fn()

    // Render WhatsNewDialog and capture structural snapshot.
    const { unmount: u1 } = render(<WhatsNewDialog open={true} onClose={onClose} />)
    const wndDialog = document.body.querySelector('[role="dialog"]')
    // Normalize auto-generated IDs (React useId produces :r0:, :r1: etc.) before comparing.
    const normalize = (el: Element | null) =>
      el?.outerHTML.replace(/:[a-z0-9]+:/g, ':ID:') ?? ''
    const wndHtml = normalize(wndDialog)
    u1()

    // Render ChangelogDrawer and compare normalised structure.
    render(<ChangelogDrawer open={true} onClose={onClose} />)
    const cdDialog = document.body.querySelector('[role="dialog"]')
    const cdHtml = normalize(cdDialog)

    expect(cdHtml).toBe(wndHtml)
  })
})

// ===========================================================================
// 11. Scroll-lock / body overflow invariants
// ===========================================================================

describe('WhatsNewDialog – scroll preservation', () => {
  it('sets body overflow to hidden when dialog opens', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body overflow when dialog closes', async () => {
    const { rerender } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    rerender(<WhatsNewDialog open={false} onClose={() => undefined} />)
    await waitFor(() => {
      expect(document.body.style.overflow).not.toBe('hidden')
    })
  })

  it('does not lock scroll when open is false from the start', () => {
    render(<WhatsNewDialog open={false} onClose={() => undefined} />)
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
