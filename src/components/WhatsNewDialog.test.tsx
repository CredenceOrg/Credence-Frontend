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

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<WhatsNewDialog open={true} onClose={onClose} />)
    const backdrop = document.querySelector('.whats-new-dialog__backdrop')
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop!)
    expect(onClose).toHaveBeenCalledTimes(1)
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

  it('renders unread badge when unreadCount > 0', () => {
    setMockUpdates(2)
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByText('2 unread')).toBeInTheDocument()
  })
})
