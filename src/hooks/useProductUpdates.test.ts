import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useProductUpdates, PRODUCT_UPDATES_STORAGE_KEY } from './useProductUpdates'
import { PRODUCT_UPDATES, LATEST_UPDATE_ID } from '../data/productUpdates'

describe('useProductUpdates', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('returns all product updates', () => {
    const { result } = renderHook(() => useProductUpdates())
    expect(result.current.updates).toBe(PRODUCT_UPDATES)
    expect(result.current.updates.length).toBeGreaterThan(0)
  })

  it('returns unreadCount equal to total updates when no update has been seen', () => {
    const { result } = renderHook(() => useProductUpdates())
    expect(result.current.unreadCount).toBe(PRODUCT_UPDATES.length)
  })

  it('returns unreadCount of 0 after markAllRead is called', () => {
    const { result } = renderHook(() => useProductUpdates())
    expect(result.current.unreadCount).toBe(PRODUCT_UPDATES.length)

    act(() => {
      result.current.markAllRead()
    })

    expect(result.current.unreadCount).toBe(0)
  })

  it('persists the latest update id to localStorage after markAllRead', () => {
    const { result } = renderHook(() => useProductUpdates())

    act(() => {
      result.current.markAllRead()
    })

    const stored = JSON.parse(window.localStorage.getItem(PRODUCT_UPDATES_STORAGE_KEY) ?? 'null')
    expect(stored).toBe(LATEST_UPDATE_ID)
  })

  it('reads unread count from localStorage on mount', () => {
    // Simulate having seen the second update (index 1 in the list)
    const secondUpdateId = PRODUCT_UPDATES[1].id
    window.localStorage.setItem(PRODUCT_UPDATES_STORAGE_KEY, JSON.stringify(secondUpdateId))

    const { result } = renderHook(() => useProductUpdates())
    // Updates at indices 0 through (index-1) are unread → index 1 means 1 unread
    expect(result.current.unreadCount).toBe(1)
  })

  it('treats a stale or unrecognised stored id as all-unread', () => {
    window.localStorage.setItem(
      PRODUCT_UPDATES_STORAGE_KEY,
      JSON.stringify('update-no-longer-exists')
    )

    const { result } = renderHook(() => useProductUpdates())
    expect(result.current.unreadCount).toBe(PRODUCT_UPDATES.length)
  })

  it('returns unreadCount 0 when the stored id matches the newest update', () => {
    window.localStorage.setItem(PRODUCT_UPDATES_STORAGE_KEY, JSON.stringify(LATEST_UPDATE_ID))

    const { result } = renderHook(() => useProductUpdates())
    expect(result.current.unreadCount).toBe(0)
  })

  it('exports PRODUCT_UPDATES_STORAGE_KEY as the expected string', () => {
    expect(PRODUCT_UPDATES_STORAGE_KEY).toBe('credence:last-seen-update-id')
  })
})
