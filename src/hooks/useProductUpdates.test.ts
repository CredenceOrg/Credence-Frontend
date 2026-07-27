import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useProductUpdates, PRODUCT_UPDATES_STORAGE_KEY } from './useProductUpdates'
import { PRODUCT_UPDATES } from '../data/productUpdates'

const mockFeedItems = [
  {
    id: 'update-1',
    date: '2026-07-24',
    title: 'First Update',
    description: 'Description 1',
    tag: 'feature' as const,
  },
  {
    id: 'update-2',
    date: '2026-07-20',
    title: 'Second Update',
    description: 'Description 2',
    tag: 'fix' as const,
  },
]

describe('useProductUpdates', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockFeedItems),
      })
    ))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.localStorage.clear()
  })

  it('returns initial fallback updates and updates fetched from JSON feed', async () => {
    const { result } = renderHook(() => useProductUpdates())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.updates).toEqual(mockFeedItems)
    expect(result.current.error).toBeNull()
  })

  it('falls back to default PRODUCT_UPDATES when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.reject(new Error('Network error'))
    ))

    const { result } = renderHook(() => useProductUpdates())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.updates).toBe(PRODUCT_UPDATES)
    expect(result.current.error).toBe('Network error')
  })

  it('returns unreadCount equal to total updates when no update has been seen', async () => {
    const { result } = renderHook(() => useProductUpdates())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.unreadCount).toBe(mockFeedItems.length)
  })

  it('returns unreadCount of 0 after markAllRead is called', async () => {
    const { result } = renderHook(() => useProductUpdates())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.unreadCount).toBe(mockFeedItems.length)

    act(() => {
      result.current.markAllRead()
    })

    expect(result.current.unreadCount).toBe(0)
  })

  it('persists the latest update id to localStorage after markAllRead', async () => {
    const { result } = renderHook(() => useProductUpdates())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.markAllRead()
    })

    const stored = JSON.parse(window.localStorage.getItem(PRODUCT_UPDATES_STORAGE_KEY) ?? 'null')
    expect(stored).toBe('update-1')
  })

  it('reads unread count from localStorage on mount', async () => {
    window.localStorage.setItem(PRODUCT_UPDATES_STORAGE_KEY, JSON.stringify('update-2'))

    const { result } = renderHook(() => useProductUpdates())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.unreadCount).toBe(1)
  })

  it('treats a stale or unrecognised stored id as all-unread', async () => {
    window.localStorage.setItem(
      PRODUCT_UPDATES_STORAGE_KEY,
      JSON.stringify('update-no-longer-exists')
    )

    const { result } = renderHook(() => useProductUpdates())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.unreadCount).toBe(mockFeedItems.length)
  })

  it('returns unreadCount 0 when the stored id matches the newest update', async () => {
    window.localStorage.setItem(PRODUCT_UPDATES_STORAGE_KEY, JSON.stringify('update-1'))

    const { result } = renderHook(() => useProductUpdates())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.unreadCount).toBe(0)
  })

  it('exports PRODUCT_UPDATES_STORAGE_KEY as the expected string', () => {
    expect(PRODUCT_UPDATES_STORAGE_KEY).toBe('credence:last-seen-update-id')
  })
})
