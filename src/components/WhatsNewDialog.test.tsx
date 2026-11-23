import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WhatsNewDialog, { ChangelogDrawer } from './WhatsNewDialog'
import * as useProductUpdatesModule from '../hooks/useProductUpdates'
import { PRODUCT_UPDATES } from '../data/productUpdates'

vi.mock('../hooks/useProductUpdates', () => ({
  useProductUpdates: vi.fn(),
  PRODUCT_UPDATES_STORAGE_KEY: 'credence:last-seen-update-id',
}))

const mockMarkAllRead = vi.fn()
const mockRefetch = vi.fn()

function setMockUpdates(unreadCount = 0, isLoading = false, error: string | null = null) {
  vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
    updates: PRODUCT_UPDATES,
    unreadCount,
    isLoading,
    error,
    markAllRead: mockMarkAllRead,
    refetch: mockRefetch,
  })
}

describe('WhatsNewDialog / ChangelogDrawer', () => {
  beforeEach(() => {
    mockMarkAllRead.mockReset()
    mockRefetch.mockReset()
    setMockUpdates(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports ChangelogDrawer alias', () => {
    expect(ChangelogDrawer).toBe(WhatsNewDialog)
  })

  it('does not render when open is false', () => {
    render(<WhatsNewDialog open={false} onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog with correct role and label when open', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: /what.s new/i })).toBeInTheDocument()
  })

  it('renders loading state when isLoading is true and list is empty', () => {
    vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
      updates: [],
      unreadCount: 0,
      isLoading: true,
      error: null,
      markAllRead: mockMarkAllRead,
      refetch: mockRefetch,
    })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/loading changelog/i)).toBeInTheDocument()
  })

  it('renders error state and handles retry when fetch fails and list is empty', () => {
    vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
      updates: [],
      unreadCount: 0,
      isLoading: false,
      error: 'Network error',
      markAllRead: mockMarkAllRead,
      refetch: mockRefetch,
    })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/unable to load product updates/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('renders a list item for every product update', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const list = screen.getByRole('list', { name: /recent product updates/i })
    expect(list.querySelectorAll('li')).toHaveLength(PRODUCT_UPDATES.length)
  })

  it('renders the long-list windowing wrapper for large datasets', () => {
    const longUpdates = Array.from({ length: 1005 }, (_, index) => ({
      ...PRODUCT_UPDATES[0],
      id: `update-${index}`,
      title: `Update ${index}`,
      description: `Description ${index}`,
    }))

    vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
      updates: longUpdates,
      unreadCount: 0,
      isLoading: false,
      error: null,
      markAllRead: mockMarkAllRead,
      refetch: mockRefetch,
    })

    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const list = screen.getByRole('list', { name: /recent product updates/i })
    expect(list.querySelectorAll('li').length).toBeGreaterThan(0)
  })

  it('uses the supplied container height for the long-list viewport', () => {
    const longUpdates = Array.from({ length: 1005 }, (_, index) => ({
      ...PRODUCT_UPDATES[0],
      id: `update-${index}`,
      title: `Update ${index}`,
      description: `Description ${index}`,
    }))

    vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
      updates: longUpdates,
      unreadCount: 0,
      isLoading: false,
      error: null,
      markAllRead: mockMarkAllRead,
      refetch: mockRefetch,
    })

    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const list = screen.getByRole('list', { name: /recent product updates/i })
    expect(list).toHaveStyle({ height: '420px' })
  })

  it('renders the title and description for each update', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    for (const update of PRODUCT_UPDATES) {
      expect(screen.getByText(update.title)).toBeInTheDocument()
      expect(screen.getByText(update.description)).toBeInTheDocument()
    }
  })

  it('renders a <time> element with the correct dateTime attribute for each update', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const times = document.querySelectorAll('time')
    const dateTimes = Array.from(times).map((t) => t.getAttribute('dateTime'))
    for (const update of PRODUCT_UPDATES) {
      expect(dateTimes).toContain(update.date)
    }
  })

  it('calls markAllRead when opened', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(mockMarkAllRead).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the Close button is clicked', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close what's new/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the Close button in the footer is clicked', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    fireEvent.click(closeButtons[closeButtons.length - 1])
    expect(onClose).toHaveBeenCalled()
  })

  describe('handleBackdropClick boundaries', () => {
    const getBackdrop = () =>
      document.querySelector('.whats-new-dialog__backdrop') as HTMLElement | null
    const getDialog = () => document.querySelector('.whats-new-dialog') as HTMLElement

    it('calls onClose when the press and click both land on the backdrop', () => {
      const onClose = vi.fn()
      render(<WhatsNewDialog open={true} onClose={onClose} />)
      const backdrop = getBackdrop()
      expect(backdrop).not.toBeNull()

      fireEvent.mouseDown(backdrop!)
      fireEvent.click(backdrop!)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not close when the interaction starts on the dialog content', () => {
      const onClose = vi.fn()
      render(<WhatsNewDialog open={true} onClose={onClose} />)
      const dialog = getDialog()

      fireEvent.mouseDown(dialog)
      fireEvent.click(dialog)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('does not close when the interaction starts on a nested descendant', () => {
      const onClose = vi.fn()
      render(<WhatsNewDialog open={true} onClose={onClose} />)
      const title = screen.getByRole('heading', { name: /what.s new/i })

      fireEvent.mouseDown(title)
      fireEvent.click(title)
      expect(onClose).not.toHaveBeenCalled()
    })

    it('does not close when a press starts inside the dialog and the click lands on the backdrop', () => {
      const onClose = vi.fn()
      render(<WhatsNewDialog open={true} onClose={onClose} />)
      const backdrop = getBackdrop()
      const dialog = getDialog()

      // Press inside the dialog (e.g. selecting text), release over the backdrop:
      // the browser reports the click on their nearest common ancestor (the
      // backdrop), which must not be treated as a backdrop dismissal.
      fireEvent.mouseDown(dialog)
      fireEvent.mouseUp(backdrop!)
      fireEvent.click(backdrop!)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('does not close when a press starts on the backdrop but the click lands on the dialog', () => {
      const onClose = vi.fn()
      render(<WhatsNewDialog open={true} onClose={onClose} />)
      const backdrop = getBackdrop()
      const dialog = getDialog()

      fireEvent.mouseDown(backdrop!)
      fireEvent.mouseUp(dialog)
      fireEvent.click(dialog)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('treats each independent backdrop press/click as a dismissal', () => {
      const onClose = vi.fn()
      render(<WhatsNewDialog open={true} onClose={onClose} />)
      const backdrop = getBackdrop()

      fireEvent.mouseDown(backdrop!)
      fireEvent.click(backdrop!)
      fireEvent.mouseDown(backdrop!)
      fireEvent.click(backdrop!)

      expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('renders no backdrop (and never closes) while the dialog is closed', () => {
      const onClose = vi.fn()
      render(<WhatsNewDialog open={false} onClose={onClose} />)
      expect(getBackdrop()).toBeNull()
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('locks body scroll while open and restores it on close', async () => {
    const { rerender } = render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<WhatsNewDialog open={false} onClose={() => undefined} />)
    await waitFor(() => {
      expect(document.body.style.overflow).not.toBe('hidden')
    })
  })

  it('renders tag labels for each update', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const newTags = screen.getAllByText('New')
    expect(newTags.length).toBeGreaterThan(0)
  })

  it('renders stale data when isLoading is true but updates are present', () => {
    vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
      updates: PRODUCT_UPDATES,
      unreadCount: 0,
      isLoading: true,
      error: null,
      markAllRead: mockMarkAllRead,
      refetch: mockRefetch,
    })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const list = screen.getByRole('list', { name: /recent product updates/i })
    expect(list).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders stale data when error is present but updates exist', () => {
    vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
      updates: PRODUCT_UPDATES,
      unreadCount: 0,
      isLoading: false,
      error: 'Network Error',
      markAllRead: mockMarkAllRead,
      refetch: mockRefetch,
    })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const list = screen.getByRole('list', { name: /recent product updates/i })
    expect(list).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('handles invalid or missing dates gracefully', () => {
    const badDateUpdates = [
      { ...PRODUCT_UPDATES[0], id: 'bad-1', date: 'invalid-date-string' },
      { ...PRODUCT_UPDATES[0], id: 'bad-2', date: '' }
    ]
    vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
      updates: badDateUpdates,
      unreadCount: 0,
      isLoading: false,
      error: null,
      markAllRead: mockMarkAllRead,
      refetch: mockRefetch,
    })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('invalid-date-string')).toBeInTheDocument()
    expect(screen.getByText('Unknown Date')).toBeInTheDocument()
  })

  it('renders correctly when updates contain duplicate IDs', () => {
    const duplicateUpdates = [
      PRODUCT_UPDATES[0],
      PRODUCT_UPDATES[0]
    ]
    vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
      updates: duplicateUpdates,
      unreadCount: 0,
      isLoading: false,
      error: null,
      markAllRead: mockMarkAllRead,
      refetch: mockRefetch,
    })
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    const list = screen.getByRole('list', { name: /recent product updates/i })
    expect(list.querySelectorAll('li')).toHaveLength(2)
  })

  it('renders unread badge when unreadCount > 0', () => {
    setMockUpdates(2)
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('2 unread')).toBeInTheDocument()
  })
})
