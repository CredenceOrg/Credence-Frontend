import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInfiniteQuery } from './useInfiniteQuery'

type FeedItem = { id: string }
type FeedPage = { items: FeedItem[]; nextCursor: string | null }

function FeedHarness({ fetchPage }: { fetchPage: (cursor: string | null) => Promise<FeedPage> }) {
  const query = useInfiniteQuery<FeedItem, string | null>({
    queryKey: 'feed',
    fetchPage,
  })

  return (
    <div>
      <div data-testid="status">{query.status}</div>
      <div data-testid="items">{query.data.map((item) => item.id).join(',')}</div>
      <button type="button" onClick={() => void query.fetchNextPage()}>
        next
      </button>
    </div>
  )
}

describe('useInfiniteQuery', () => {
  it('loads the first page and appends the next page using the next cursor', async () => {
    const fetchPage = vi
      .fn<
        [cursor: string | null],
        Promise<FeedPage>
      >()
      .mockResolvedValueOnce({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [{ id: 'c' }], nextCursor: null })

    render(<FeedHarness fetchPage={fetchPage} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('items').textContent).toBe('a,b')

    await act(async () => {
      screen.getByRole('button', { name: 'next' }).click()
    })

    await waitFor(() => expect(screen.getByTestId('items').textContent).toBe('a,b,c'))
    expect(fetchPage).toHaveBeenCalledWith(null)
    expect(fetchPage).toHaveBeenCalledWith('cursor-1')
  })
})
