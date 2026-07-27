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
      <div data-testid="hasNextPage">{String(query.hasNextPage)}</div>
      <div data-testid="isFetchingNextPage">{String(query.isFetchingNextPage)}</div>
      <button type="button" onClick={() => void query.fetchNextPage()}>
        next
      </button>
    </div>
  )
}

describe('useInfiniteQuery', () => {
  it('loads_first_page_and_appends_next_page_using_next_cursor', async () => {
    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
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

  // ---------------------------------------------------------------------------
  // Dedupe concurrent requests
  // ---------------------------------------------------------------------------

  it('dedupe_concurrent_fetchNextPage_calls_for_the_same_cursor_issues_only_one_request', async () => {
    // Simulates two rapid fetchNextPage() calls with the same pending cursor
    // before either resolves. Only one network call should be issued.
    let resolveSecondPage!: (value: FeedPage) => void
    const secondPagePromise = new Promise<FeedPage>((res) => {
      resolveSecondPage = res
    })

    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      // Initial page load.
      .mockResolvedValueOnce({ items: [{ id: 'a' }], nextCursor: 'c1' })
      // Second page — kept pending so we can verify the duplicate is dropped.
      .mockReturnValueOnce(secondPagePromise)

    render(<FeedHarness fetchPage={fetchPage} />)

    // Wait for the first page to settle.
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('items').textContent).toBe('a')
    expect(fetchPage).toHaveBeenCalledTimes(1)

    // Click "next" twice before the second page resolves. The second click
    // hits the requestedCursorsRef deduplication guard and must be a no-op.
    await act(async () => {
      screen.getByRole('button', { name: 'next' }).click()
      screen.getByRole('button', { name: 'next' }).click()
    })

    // One initial call + one deduplicated "next" call = 2 total.
    expect(fetchPage).toHaveBeenCalledTimes(2)

    // Resolve the in-flight second-page request.
    act(() => {
      resolveSecondPage({ items: [{ id: 'b' }], nextCursor: null })
    })

    await waitFor(() => expect(screen.getByTestId('items').textContent).toBe('a,b'))
    // Still exactly two total calls — no extra one from the duplicate click.
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('sets_hasNextPage_to_false_and_prevents_further_fetches_when_last_page_loaded', async () => {
    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      .mockResolvedValueOnce({ items: [{ id: 'a' }], nextCursor: null })

    render(<FeedHarness fetchPage={fetchPage} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('hasNextPage').textContent).toBe('false')

    // Clicking "next" when hasNextPage is false must not trigger any further fetch.
    await act(async () => {
      screen.getByRole('button', { name: 'next' }).click()
    })

    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('surfaces_fetch_errors_via_error_field_and_clears_dedup_key_for_retry', async () => {
    // After a fetch error the cursor key must be evicted from requestedCursorsRef
    // so a subsequent manual retry can issue a new request.
    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce({ items: [{ id: 'a' }], nextCursor: null })

    function ErrorHarness() {
      const query = useInfiniteQuery<FeedItem, string | null>({
        queryKey: 'feed-err',
        fetchPage,
      })
      return (
        <div>
          <div data-testid="status">{query.status}</div>
          <div data-testid="error">{query.error?.message ?? ''}</div>
          <div data-testid="items">{query.data.map((item) => item.id).join(',')}</div>
        </div>
      )
    }

    render(<ErrorHarness />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'))
    expect(screen.getByTestId('error').textContent).toBe('network failure')
    // The fetcher was called once (the failed attempt).
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  // ---------------------------------------------------------------------------
  // Empty page
  // ---------------------------------------------------------------------------

  it('handles_empty_first_page_with_no_items_and_sets_status_to_success', async () => {
    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      .mockResolvedValueOnce({ items: [], nextCursor: null })

    render(<FeedHarness fetchPage={fetchPage} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('items').textContent).toBe('')
    expect(screen.getByTestId('hasNextPage').textContent).toBe('false')
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('handles_empty_first_page_with_nextCursor_and_allows_fetching_next_page', async () => {
    // The first page returns no items but indicates more data is available.
    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      .mockResolvedValueOnce({ items: [], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [{ id: 'a' }], nextCursor: null })

    render(<FeedHarness fetchPage={fetchPage} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('items').textContent).toBe('')
    expect(screen.getByTestId('hasNextPage').textContent).toBe('true')

    await act(async () => {
      screen.getByRole('button', { name: 'next' }).click()
    })

    await waitFor(() => expect(screen.getByTestId('items').textContent).toBe('a'))
    expect(fetchPage).toHaveBeenCalledWith(null)
    expect(fetchPage).toHaveBeenCalledWith('cursor-1')
  })

  it('handles_empty_subsequent_page_and_appends_nothing', async () => {
    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      .mockResolvedValueOnce({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [], nextCursor: null })

    render(<FeedHarness fetchPage={fetchPage} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('items').textContent).toBe('a,b')

    await act(async () => {
      screen.getByRole('button', { name: 'next' }).click()
    })

    // Items from the first page are preserved; empty second page adds nothing.
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('items').textContent).toBe('a,b')
    expect(screen.getByTestId('hasNextPage').textContent).toBe('false')
  })

  // ---------------------------------------------------------------------------
  // Error on subsequent page
  // ---------------------------------------------------------------------------

  it('preserves_existing_data_when_subsequent_page_errors', async () => {
    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      .mockResolvedValueOnce({ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'cursor-1' })
      .mockRejectedValueOnce(new Error('network failure'))

    function ErrorOnSecondPageHarness({
      fetchPage,
    }: {
      fetchPage: (cursor: string | null) => Promise<FeedPage>
    }) {
      const query = useInfiniteQuery<FeedItem, string | null>({
        queryKey: 'feed-err-p2',
        fetchPage,
      })
      return (
        <div>
          <div data-testid="status">{query.status}</div>
          <div data-testid="error">{query.error?.message ?? ''}</div>
          <div data-testid="items">{query.data.map((item) => item.id).join(',')}</div>
          <button type="button" onClick={() => void query.fetchNextPage()}>
            next
          </button>
        </div>
      )
    }

    render(<ErrorOnSecondPageHarness fetchPage={fetchPage} />)

    // First page loads successfully.
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('items').textContent).toBe('a,b')

    // Trigger the second page fetch which fails.
    await act(async () => {
      screen.getByRole('button', { name: 'next' }).click()
    })

    // Status should be error, but first-page items must be preserved.
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'))
    expect(screen.getByTestId('error').textContent).toBe('network failure')
    expect(screen.getByTestId('items').textContent).toBe('a,b')
  })

  it('constructs_a_generic_error_message_when_fetch_rejects_with_a_non_Error_value', async () => {
    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      .mockRejectedValueOnce('string rejection')

    function ErrorHarness() {
      const query = useInfiniteQuery<FeedItem, string | null>({
        queryKey: 'feed-nonerror',
        fetchPage,
      })
      return (
        <div>
          <div data-testid="status">{query.status}</div>
          <div data-testid="error">{query.error?.message ?? ''}</div>
          <div data-testid="items">{query.data.map((item) => item.id).join(',')}</div>
        </div>
      )
    }

    render(<ErrorHarness />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'))
    expect(screen.getByTestId('error').textContent).toBe('Failed to fetch page')
  })

  it('isFetchingNextPage_is_true_while_page_is_in_flight_and_false_after_resolve', async () => {
    let resolveNextPage!: (value: FeedPage) => void
    const nextPagePromise = new Promise<FeedPage>((res) => {
      resolveNextPage = res
    })

    const fetchPage = vi
      .fn<[cursor: string | null], Promise<FeedPage>>()
      .mockResolvedValueOnce({ items: [{ id: 'a' }], nextCursor: 'c1' })
      .mockReturnValueOnce(nextPagePromise)

    render(<FeedHarness fetchPage={fetchPage} />)

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'))
    expect(screen.getByTestId('isFetchingNextPage').textContent).toBe('false')

    // Start loading the next page.
    await act(async () => {
      screen.getByRole('button', { name: 'next' }).click()
    })

    // In-flight: flag must be true.
    expect(screen.getByTestId('isFetchingNextPage').textContent).toBe('true')

    // Resolve and confirm the flag clears.
    act(() => {
      resolveNextPage({ items: [{ id: 'b' }], nextCursor: null })
    })

    await waitFor(() =>
      expect(screen.getByTestId('isFetchingNextPage').textContent).toBe('false')
    )
    expect(screen.getByTestId('items').textContent).toBe('a,b')
  })
})
