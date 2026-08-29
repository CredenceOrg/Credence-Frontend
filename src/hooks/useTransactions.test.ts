import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactions } from './useTransactions'
import { apiFetch, ApiError } from '../api/client'
import type { Transaction } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

const apiFetchMock = vi.mocked(apiFetch)

type Page = { items: Transaction[]; nextCursor?: string }

let sequence: number
function makeTx(): Transaction {
  sequence += 1
  return {
    id: `tx-${sequence}`,
    hash: `hash-${sequence}`,
    type: 'bond',
    status: 'confirmed',
    amountUsdc: 100,
    timestamp: new Date(Date.now() - sequence * 1000).toISOString(),
  }
}

/**
 * Responds to every incoming request with the next queued page in order. Also
 * records the request URL so tests can assert cursor pass-through and scope.
 */
function setupWithPages(pages: Page[]) {
  const urls: string[] = []
  apiFetchMock.mockImplementation(async (path: string) => {
    urls.push(path)
    return pages.shift() ?? { items: [] }
  })
  const rendered = renderHook(() => useTransactions())
  return { rendered, urls } as const
}

function query(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '')
}

describe('useTransactions cursor pagination', () => {
  beforeEach(() => {
    localStorage.clear()
    apiFetchMock.mockClear()
    sequence = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads an empty result and reports end-of-stream (no next cursor, no next page)', async () => {
    const { rendered } = setupWithPages([{ items: [] }])

    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false))
    expect(rendered.result.current.data).toEqual([])
    expect(rendered.result.current.hasNextPage).toBe(false)
    expect(rendered.result.current.nextCursor).toBeUndefined()
  })

  it('loads a single-page result and reports end-of-stream', async () => {
    const items = [makeTx(), makeTx()]
    const { rendered } = setupWithPages([{ items }])

    await waitFor(() => expect(rendered.result.current.data).toHaveLength(2))
    expect(rendered.result.current.data).toEqual(items)
    expect(rendered.result.current.hasNextPage).toBe(false)
    expect(rendered.result.current.totalPages).toBe(1)
  })

  it('sends a fixed page size and, after the first page, echoes the cursor verbatim with an unchanged scope', async () => {
    const page1 = Array.from({ length: 20 }, () => makeTx())
    const page2 = [makeTx()]
    const { rendered, urls } = setupWithPages([
      { items: page1, nextCursor: 'VERBATIM-CURSOR' },
      { items: page2 },
    ])

    await waitFor(() => expect(rendered.result.current.data).toHaveLength(20))
    expect(rendered.result.current.hasNextPage).toBe(true)
    expect(rendered.result.current.nextCursor).toBe('VERBATIM-CURSOR')

    await act(async () => {
      await rendered.result.current.goToPage(2)
    })
    await waitFor(() => expect(rendered.result.current.data).toHaveLength(1))

    expect(urls).toHaveLength(2)
    // First request: no cursor, fixed limit, and no scope/filter params.
    expect(query(urls[0]).get('limit')).toBe('20')
    expect(query(urls[0]).get('cursor')).toBeNull()
    // Second request: the cursor is passed through exactly as returned; the
    // request remains scoped only to limit + cursor (authenticated server-side).
    expect(query(urls[1]).get('cursor')).toBe('VERBATIM-CURSOR')
    expect(query(urls[1]).get('limit')).toBe('20')
    expect(query(urls[1]).has('address')).toBe(false)
  })

  it('does not skip or duplicate records across pages when the server slices page-size + 1', async () => {
    const page1 = Array.from({ length: 20 }, () => makeTx())
    const page2 = [makeTx()]
    const { rendered } = setupWithPages([{ items: page1, nextCursor: 'c1' }, { items: page2 }])

    await waitFor(() => expect(rendered.result.current.data).toHaveLength(20))
    await act(async () => {
      await rendered.result.current.goToPage(2)
    })
    await waitFor(() => expect(rendered.result.current.data).toHaveLength(1))

    const visible = rendered.result.current.data
    const page2Ids = page2.map((t) => t.id)
    // Page 2 contains exactly the server-supplied records, in order, no repeats.
    expect(visible.map((t) => t.id)).toEqual(page2Ids)
    // Records from page 1 must not reappear (no unexpected duplication/skipping).
    for (const tx of page1) {
      expect(page2Ids).not.toContain(tx.id)
    }
    expect(rendered.result.current.hasNextPage).toBe(false)
  })

  it('serves the previous page from cache without issuing another network request', async () => {
    const page1 = [makeTx()]
    const page2 = [makeTx()]
    const { rendered, urls } = setupWithPages([
      { items: page1, nextCursor: 'c1' },
      { items: page2 },
    ])

    await waitFor(() => expect(rendered.result.current.data).toHaveLength(1))
    await act(async () => {
      await rendered.result.current.goToPage(2)
    })
    await waitFor(() => expect(rendered.result.current.page).toBe(2))
    expect(urls).toHaveLength(2)

    // Backward navigation must reuse the cached page, not re-fetch the network.
    await act(async () => {
      await rendered.result.current.goToPage(1)
    })
    expect(urls).toHaveLength(2)
    expect(rendered.result.current.page).toBe(1)
    expect(rendered.result.current.data).toEqual(page1)
    expect(rendered.result.current.hasNextPage).toBe(true)
    expect(rendered.result.current.nextCursor).toBe('c1')
  })

  it('preserves the current page when a subsequent page request fails, then recovers on retry', async () => {
    const page1 = [makeTx(), makeTx()]
    const { rendered } = setupWithPages([{ items: page1, nextCursor: 'c1' }])

    await waitFor(() => expect(rendered.result.current.data).toHaveLength(2))

    // The next-page request fails with a server error. goToPage surfaces it in
    // `error` state rather than throwing to the caller.
    await act(async () => {
      apiFetchMock.mockRejectedValueOnce(new ApiError(500, 'Boom'))
      await rendered.result.current.goToPage(2)
    })

    // Failure must not wipe the already-visible page or corrupt the cursor.
    expect(rendered.result.current.error?.status).toBe(500)
    expect(rendered.result.current.data).toEqual(page1)
    expect(rendered.result.current.page).toBe(1)
    expect(rendered.result.current.hasNextPage).toBe(true)

    // Retry after the failure succeeds and advances to page 2.
    await act(async () => {
      apiFetchMock.mockImplementationOnce(() =>
        Promise.resolve({ items: [makeTx()], nextCursor: undefined })
      )
      await rendered.result.current.goToPage(2)
    })
    expect(rendered.result.current.error).toBeNull()
    expect(rendered.result.current.data).toHaveLength(1)
    expect(rendered.result.current.hasNextPage).toBe(false)
  })

  it('settles on a single consistent page when the same page request is fired repeatedly', async () => {
    const page1 = [makeTx()]
    const page2 = [makeTx()]
    const { rendered } = setupWithPages([{ items: page1, nextCursor: 'c1' }])

    await waitFor(() => expect(rendered.result.current.data).toHaveLength(1))

    // Two rapid "load next" calls for the same page share one in-flight page-2
    // request; the superseded call must be ignored, leaving exactly page 2.
    let resolved!: () => void
    const gate = new Promise<void>((res) => (resolved = res))
    apiFetchMock.mockImplementation(() =>
      gate.then(() => ({ items: page2, nextCursor: undefined }))
    )

    let first: Promise<void> | undefined
    let second: Promise<void> | undefined
    await act(async () => {
      first = rendered.result.current.goToPage(2)
      second = rendered.result.current.goToPage(2)
      resolved()
      await Promise.all([first, second])
    })
    await act(async () => {})

    expect(rendered.result.current.data.map((t) => t.id)).toEqual(page2.map((t) => t.id))
    expect(rendered.result.current.data).toHaveLength(1)
    expect(rendered.result.current.page).toBe(2)
    expect(rendered.result.current.error).toBeNull()
  })

  it('prefetch does not mutate the displayed list but records the trailing page', async () => {
    const page1 = [makeTx()]
    const { rendered } = setupWithPages([{ items: page1, nextCursor: 'c1' }])

    await waitFor(() => expect(rendered.result.current.data).toHaveLength(1))
    await act(async () => {
      apiFetchMock.mockImplementationOnce(() =>
        Promise.resolve({ items: [makeTx()], nextCursor: undefined })
      )
      await rendered.result.current.prefetchPage(2)
    })

    // Prefetch is fire-and-forget: the displayed page stays page 1, but a
    // request is issued for the trailing page using its stored cursor.
    expect(rendered.result.current.page).toBe(1)
    expect(rendered.result.current.data).toEqual(page1)
    expect(apiFetchMock.mock.calls).toHaveLength(2)
    const prefetchUrl = String(apiFetchMock.mock.calls[1][0])
    expect(query(prefetchUrl).get('cursor')).toBe('c1')
    expect(rendered.result.current.totalPages).toBe(2)
  })

  it('clears pagination state on refetch and starts over from page 1', async () => {
    const { rendered } = setupWithPages([
      { items: [makeTx()], nextCursor: 'c1' },
      { items: [makeTx()] },
    ])

    await waitFor(() => expect(rendered.result.current.data).toHaveLength(1))
    expect(rendered.result.current.hasNextPage).toBe(true)

    await act(async () => {
      rendered.result.current.refetch()
    })
    await waitFor(() => expect(rendered.result.current.totalPages).toBe(1))
    expect(rendered.result.current.page).toBe(1)
    expect(rendered.result.current.hasNextPage).toBe(false)
  })
})
