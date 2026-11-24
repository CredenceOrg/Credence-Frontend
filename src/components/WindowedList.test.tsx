import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LONG_LIST_RENDER_THRESHOLD } from '../config/listing'
import WindowedList from './WindowedList'

interface ListItem {
  id: string
  label: string
}

function makeItems(count: number): ListItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    label: `Row ${index}`,
  }))
}

describe('WindowedList', () => {
  it('renders emptyMessage when items is empty and returns null when omitted', () => {
    const { container, rerender } = render(
      <WindowedList
        items={[]}
        itemHeight={40}
        emptyMessage="No items found"
        renderItem={(item: ListItem) => <span>{item.label}</span>}
      />
    )

    expect(screen.getByText('No items found')).toBeInTheDocument()

    rerender(
      <WindowedList
        items={[]}
        itemHeight={40}
        renderItem={(item: ListItem) => <span>{item.label}</span>}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders all rows without windowing for lists below LONG_LIST_RENDER_THRESHOLD', () => {
    const items = makeItems(25)

    render(
      <WindowedList
        items={items}
        itemHeight={40}
        role="list"
        ariaLabel="Small list"
        getItemKey={(item) => item.id}
        renderItem={(item) => <div role="listitem">{item.label}</div>}
      />
    )

    expect(screen.getByRole('list', { name: 'Small list' })).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(25)
    expect(screen.getByText('Row 0')).toBeInTheDocument()
    expect(screen.getByText('Row 24')).toBeInTheDocument()
  })

  it('renders only visible rows plus overscan for a large list of 1,000 items', () => {
    const items = makeItems(LONG_LIST_RENDER_THRESHOLD)

    render(
      <WindowedList
        items={items}
        itemHeight={40}
        containerHeight={200}
        overscan={2}
        role="list"
        ariaLabel="Large list"
        getItemKey={(item) => item.id}
        renderItem={(item) => <div role="listitem">{item.label}</div>}
      />
    )

    // Viewport 200px / 40px = 5 visible rows + 2 bottom overscan = 7 rows (indices 0..6)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(7)
    expect(screen.getByText('Row 0')).toBeInTheDocument()
    expect(screen.getByText('Row 6')).toBeInTheDocument()
    expect(screen.queryByText('Row 7')).not.toBeInTheDocument()
    expect(screen.queryByText('Row 999')).not.toBeInTheDocument()
  })

  it('shifts the rendered window when scrolled', () => {
    const items = makeItems(LONG_LIST_RENDER_THRESHOLD)

    render(
      <WindowedList
        items={items}
        itemHeight={40}
        containerHeight={200}
        overscan={2}
        role="list"
        ariaLabel="Scrollable list"
        getItemKey={(item) => item.id}
        renderItem={(item) => <div role="listitem">{item.label}</div>}
      />
    )

    const container = screen.getByRole('list', { name: 'Scrollable list' })
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 400,
    })

    fireEvent.scroll(container)

    // scrollTop 400 / 40 = 10 -> startIndex = 8, endIndex = ceil(600/40) + 2 = 17 (9 rows: 8..16)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(9)
    expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
    expect(screen.queryByText('Row 7')).not.toBeInTheDocument()
    expect(screen.getByText('Row 8')).toBeInTheDocument()
    expect(screen.getByText('Row 16')).toBeInTheDocument()
    expect(screen.queryByText('Row 17')).not.toBeInTheDocument()
  })

  it('uses stable keys via getItemKey across scroll updates', () => {
    const items = makeItems(LONG_LIST_RENDER_THRESHOLD)
    const getItemKey = vi.fn((item: ListItem) => item.id)

    render(
      <WindowedList
        items={items}
        itemHeight={40}
        containerHeight={200}
        overscan={2}
        role="list"
        ariaLabel="Keyed list"
        getItemKey={getItemKey}
        renderItem={(item) => <div role="listitem">{item.label}</div>}
      />
    )

    const row5BeforeScroll = screen.getByText('Row 5')

    const container = screen.getByRole('list', { name: 'Keyed list' })
    Object.defineProperty(container, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 120,
    })

    fireEvent.scroll(container)

    const row5AfterScroll = screen.getByText('Row 5')
    expect(row5AfterScroll).toBe(row5BeforeScroll)
    expect(getItemKey).toHaveBeenCalledWith(items[5], 5)
  })
})
