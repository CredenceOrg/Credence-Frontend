import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WhatsNewDialog from './WhatsNewDialog'
import * as useProductUpdatesModule from '../hooks/useProductUpdates'
import { PRODUCT_UPDATES } from '../data/productUpdates'

vi.mock('../hooks/useProductUpdates', () => ({
  useProductUpdates: vi.fn(),
  PRODUCT_UPDATES_STORAGE_KEY: 'credence:last-seen-update-id',
}))

const mockMarkAllRead = vi.fn()

function setMockUpdates(unreadCount = 0) {
  vi.mocked(useProductUpdatesModule.useProductUpdates).mockReturnValue({
    updates: PRODUCT_UPDATES,
    unreadCount,
    markAllRead: mockMarkAllRead,
  })
}

describe('WhatsNewDialog', () => {
  beforeEach(() => {
    mockMarkAllRead.mockReset()
    setMockUpdates(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render when open is false', () => {
    render(<WhatsNewDialog open={false} onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog with correct role and label when open', () => {
    render(<WhatsNewDialog open={true} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: /what.s new/i })).toBeInTheDocument()
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
    // At least one "New" tag should be present (from 'feature' updates)
    const newTags = screen.getAllByText('New')
    expect(newTags.length).toBeGreaterThan(0)
  })
})
