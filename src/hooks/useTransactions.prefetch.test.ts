import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransactions } from './useTransactions'
import { apiFetch } from '../api/client'
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

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeTx(id: string, type = 'bond'): Transaction {
  return {
    id,
    hash: `hash-${id}`,
    type,
    status: 'confirmed',
    amountUsdc: 100,
    timestamp: '2026-01-15T12:00:00Z',
  }
}

function pageParams(path: string): URLSearchParams {
  return new URLSearchParams(path.split('?')[1] ?? '')
}

function callsForCursor(cursor: string): number {
  return apiFetchMock.mock.calls.filter(([path]) => pageParams(path).get('cursor') === cursor).length
}

/** First page resolves from every cursor-less call; page 2 is deferred. */
function mockPageOneThenDeferredPageTwo(pageOne: Page, deferredPageTwo: Deferred<Page>) {
  const signals: AbortSignal[] = []

  apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
    if (pageParams(path).get('cursor') === 'c1') {
      if (init?.signal) signals.push(init.signal)
      return deferredPageTwo.promise
    }
    return Promise.resolve(pageOne)
  })

  return { signals }
}

describe('useTransactions prefetch deduplication', () => {
  beforeEach(() => {
    localStorage.clear()
    apiFetchMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deduplicates prefetch ×2 and lets goToPage adopt the in-flight request', async () => {
    const pageOne = { items: [makeTx('p1')], nextCursor: 'c1' }
    const pageTwo = { items: [makeTx('p2', 'page_two')] }
    const deferredPageTwo = deferred<Page>()
    mockPageOneThenDeferredPageTwo(pageOne, deferredPageTwo)

    const { result } = renderHook(() => useTransactions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => {
      void result.current.prefetchPage(2)
      void result.current.prefetchPage(2)
    })

    // Two prefetch triggers, one request.
    expect(callsForCursor('c1')).toBe(1)

    let navigation!: Promise<void>
    await act(async () => {
      navigation = result.current.goToPage(2)
      await Promise.resolve()

      // goToPage joined the prefetch instead of aborting and refetching.
      expect(callsForCursor('c1')).toBe(1)

      deferredPageTwo.resolve(pageTwo)
      await navigation
    })

    expect(callsForCursor('c1')).toBe(1)
    expect(result.current.page).toBe(2)
    expect(result.current.data).toEqual(pageTwo.items)
    expect(result.current.isLoading).toBe(false)
  })

  it('does not issue a second request when prefetching a page that navigation is already loading', async () => {
    const pageOne = { items: [makeTx('p1')], nextCursor: 'c1' }
    const pageTwo = { items: [makeTx('p2', 'page_two')] }
    const deferredPageTwo = deferred<Page>()
    mockPageOneThenDeferredPageTwo(pageOne, deferredPageTwo)

    const { result } = renderHook(() => useTransactions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let navigation!: Promise<void>
    await act(async () => {
      navigation = result.current.goToPage(2)
      await Promise.resolve()
    })
    expect(callsForCursor('c1')).toBe(1)
    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      await result.current.prefetchPage(2)
    })
    expect(callsForCursor('c1')).toBe(1)

    await act(async () => {
      deferredPageTwo.resolve(pageTwo)
      await navigation
    })

    expect(callsForCursor('c1')).toBe(1)
    expect(result.current.page).toBe(2)
    expect(result.current.isLoading).toBe(false)
  })

  it('prefetching a different page does not abort an in-flight navigation', async () => {
    const pageOne = { items: [makeTx('p1')], nextCursor: 'c1' }
    const pageTwo = { items: [makeTx('p2', 'page_two')] }
    const deferredPageTwo = deferred<Page>()
    const { signals } = mockPageOneThenDeferredPageTwo(pageOne, deferredPageTwo)

    const { result } = renderHook(() => useTransactions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let navigation!: Promise<void>
    await act(async () => {
      navigation = result.current.goToPage(2)
      await Promise.resolve()
    })

    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)

    // No cursor for page 2 exists yet, so this is a no-op — but it must not
    // touch the navigation's abort controller either way.
    await act(async () => {
      await result.current.prefetchPage(3)
    })

    expect(signals[0].aborted).toBe(false)

    await act(async () => {
      deferredPageTwo.resolve(pageTwo)
      await navigation
    })
  })

  it('aborts the real network request when a navigation supersedes it', async () => {
    const pageOne = { items: [makeTx('p1')], nextCursor: 'c1' }
    const deferredPageTwo = deferred<Page>()
    const { signals } = mockPageOneThenDeferredPageTwo(pageOne, deferredPageTwo)

    const { result } = renderHook(() => useTransactions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    let pageTwoNavigation!: Promise<void>
    await act(async () => {
      pageTwoNavigation = result.current.goToPage(2)
      await Promise.resolve()
    })

    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)

    // Page 3 has no cursor yet, so its own fetch resolves without a request.
    // The important part is that navigating away cancels the actual page-2
    // controller rather than an unused placeholder controller.
    await act(async () => {
      await result.current.goToPage(3)
    })

    expect(signals[0].aborted).toBe(true)

    // Let the aborted stub settle so the navigation promise can finish.
    await act(async () => {
      deferredPageTwo.resolve({ items: [] })
      await pageTwoNavigation
    })
  })

  it('refetch aborts an in-flight prefetch and ignores its totalPages update', async () => {
    const pageOne = [makeTx('p1')]
    const pageTwo = [makeTx('p2', 'page_two')]
    const deferredPageTwo = deferred<Page>()
    const signals: AbortSignal[] = []

    let pageOneCalls = 0
    apiFetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (pageParams(path).get('cursor') === 'c1') {
        if (init?.signal) signals.push(init.signal)
        return deferredPageTwo.promise
      }

      pageOneCalls += 1
      // First load advertises a second page; the refetch is end-of-stream.
      return Promise.resolve(
        pageOneCalls === 1 ? { items: pageOne, nextCursor: 'c1' } : { items: pageOne }
      )
    })

    const { result } = renderHook(() => useTransactions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.totalPages).toBe(2)

    await act(async () => {
      void result.current.prefetchPage(2)
    })
    expect(signals).toHaveLength(1)

    await act(async () => {
      result.current.refetch()
      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    expect(signals[0].aborted).toBe(true)

    // The prefetch settles after the abort: its result must not resurrect the
    // page count that refetch reset.
    await act(async () => {
      deferredPageTwo.resolve({ items: pageTwo })
      await Promise.resolve()
    })

    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.data).toEqual(pageOne)
  })

  it('aborts an in-flight prefetch on unmount', async () => {
    const pageOne = { items: [makeTx('p1')], nextCursor: 'c1' }
    const deferredPageTwo = deferred<Page>()
    const { signals } = mockPageOneThenDeferredPageTwo(pageOne, deferredPageTwo)

    const { result, unmount } = renderHook(() => useTransactions())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      void result.current.prefetchPage(2)
    })
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)

    unmount()

    expect(signals[0].aborted).toBe(true)
  })
})
