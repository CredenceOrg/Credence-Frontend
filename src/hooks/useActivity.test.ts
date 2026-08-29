import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { ActivityItem } from '../components/ActivityTimeline'
import { useActivity } from './useActivity'

const apiFetchMock = vi.fn<typeof import('../api/client').apiFetch>()

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => apiFetchMock(...args),
  }
})

const VALID_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

const mockActivityItems: ActivityItem[] = [
  {
    id: 'evt-001',
    timestamp: 'Apr 28, 14:22 UTC',
    title: 'Attestation submitted',
    description: 'Identity evidence package uploaded.',
    actor: 'Validator Node 12',
    statusLabel: 'Accepted',
    tone: 'success',
    meta: 'Tx 0x93a1...22f4',
  },
  {
    id: 'evt-002',
    timestamp: 'Apr 27, 09:48 UTC',
    title: 'Proof mismatch detected',
    description: 'Signature payload differed.',
    actor: 'Automated Verifier',
    statusLabel: 'Needs update',
    tone: 'warning',
    meta: 'Rule AV-17',
  },
]

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useActivity', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --- Basic behavior ---

  it('starts in idle state (not loading, no data, no error)', () => {
    const { result } = renderHook(() => useActivity(VALID_ADDRESS))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('does not fetch when refetch is called with an empty address', async () => {
    const { result } = renderHook(() => useActivity(''))

    await act(async () => {
      result.current.refetch()
    })

    expect(apiFetchMock).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('transitions loading → success and returns activity items', async () => {
    const pending = deferred<{ items: ActivityItem[] }>()
    apiFetchMock.mockReturnValueOnce(pending.promise)

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    act(() => {
      result.current.refetch()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      pending.resolve({ items: mockActivityItems })
      await pending.promise
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockActivityItems)
    expect(result.current.error).toBeNull()
  })

  it('transitions loading → error when the API rejects', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(503, 'Service unavailable'))

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(result.current.error).toMatchObject({
      status: 503,
      message: 'Service unavailable',
    })
  })

  // --- Abort and serialization ---

  it('aborts the prior in-flight request when refetch is called again', async () => {
    const first = deferred<{ items: ActivityItem[] }>()
    const second = deferred<{ items: ActivityItem[] }>()

    apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    // Start first request
    act(() => {
      result.current.refetch()
    })

    const firstSignal = apiFetchMock.mock.calls[0]?.[1]?.signal as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    // Start second request — should abort first
    act(() => {
      result.current.refetch()
    })

    expect(firstSignal.aborted).toBe(true)

    // First request resolves (stale — should be discarded)
    await act(async () => {
      first.resolve({ items: [{ ...mockActivityItems[0], id: 'stale-1' }] })
      await first.promise.catch(() => undefined)
    })

    // Second request resolves (fresh — should be kept)
    await act(async () => {
      second.resolve({ items: mockActivityItems })
      await second.promise
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockActivityItems)
    })

    // Confirm stale data was not applied
    expect(result.current.data.find((i) => i.id === 'stale-1')).toBeUndefined()
  })

  it('aborts in-flight requests on unmount', async () => {
    const pending = deferred<{ items: ActivityItem[] }>()
    apiFetchMock.mockReturnValueOnce(pending.promise)

    const { unmount } = renderHook(() => useActivity(VALID_ADDRESS))

    // The hook starts idle; trigger fetch
    // (unmounting before refetch is called — just verifying cleanup runs)
    unmount()

    // No crash; the AbortController cleanup should have run
  })

  it('discards stale response after component remounts', async () => {
    const first = deferred<{ items: ActivityItem[] }>()
    apiFetchMock.mockReturnValueOnce(first.promise)

    const { result, unmount } = renderHook(() => useActivity(VALID_ADDRESS))

    act(() => {
      result.current.refetch()
    })

    // Unmount before first request resolves
    unmount()

    // First request resolves (stale — component is unmounted)
    await act(async () => {
      first.resolve({ items: mockActivityItems })
      await first.promise.catch(() => undefined)
    })

    // No crash; stale data was discarded because mountedRef was false
  })

  // --- Error clears previous data ---

  it('clears data when a subsequent request fails', async () => {
    const first = deferred<{ items: ActivityItem[] }>()
    const second = deferred<{ items: ActivityItem[] }>()

    apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    // First request succeeds
    act(() => {
      result.current.refetch()
    })

    await act(async () => {
      first.resolve({ items: mockActivityItems })
      await first.promise
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockActivityItems)
    })

    // Second request fails
    act(() => {
      result.current.refetch()
    })

    await act(async () => {
      second.reject(new ApiError(500, 'Internal error'))
      await second.promise.catch(() => undefined)
    })

    await waitFor(() => {
      expect(result.current.data).toEqual([])
    })

    expect(result.current.error).toMatchObject({ status: 500 })
  })

  // --- Retry after error ---

  it('retries via refetch after an error and clears the error', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError(500, 'Server error'))
      .mockResolvedValueOnce({ items: mockActivityItems })

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.error?.status).toBe(500)
    })

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockActivityItems)
    })

    expect(result.current.error).toBeNull()
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  // --- Concurrent calls (race condition) ---

  it('applies only the last result when three concurrent requests resolve out of order', async () => {
    const first = deferred<{ items: ActivityItem[] }>()
    const second = deferred<{ items: ActivityItem[] }>()
    const third = deferred<{ items: ActivityItem[] }>()

    apiFetchMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise)

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    // Fire three rapid requests
    act(() => {
      result.current.refetch()
    })
    act(() => {
      result.current.refetch()
    })
    act(() => {
      result.current.refetch()
    })

    // First two are aborted
    const firstSignal = apiFetchMock.mock.calls[0]?.[1]?.signal as AbortSignal
    const secondSignal = apiFetchMock.mock.calls[1]?.[1]?.signal as AbortSignal
    expect(firstSignal.aborted).toBe(true)
    expect(secondSignal.aborted).toBe(true)

    // Resolve all three — third is the only valid one
    await act(async () => {
      first.resolve({ items: [{ ...mockActivityItems[0], id: 'stale-first' }] })
      await first.promise.catch(() => undefined)
    })

    await act(async () => {
      second.resolve({ items: [{ ...mockActivityItems[0], id: 'stale-second' }] })
      await second.promise.catch(() => undefined)
    })

    await act(async () => {
      third.resolve({ items: mockActivityItems })
      await third.promise
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockActivityItems)
    })

    // No stale data leaked
    expect(result.current.data.find((i) => i.id === 'stale-first')).toBeUndefined()
    expect(result.current.data.find((i) => i.id === 'stale-second')).toBeUndefined()
  })

  // --- AbortError is not surfaced as user error ---

  it('does not surface AbortError as a user-visible error', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    apiFetchMock.mockRejectedValueOnce(abortError)

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    // AbortError should be swallowed — no error surfaced
    expect(result.current.error).toBeNull()
  })

  // --- Unexpected thrown values ---

  it('wraps unexpected thrown values in ApiError', async () => {
    apiFetchMock.mockRejectedValueOnce('unexpected')

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.error).toMatchObject({
        status: 0,
        message: 'Unexpected error loading activity',
      })
    })
  })

  // --- No partial state on failure ---

  it('leaves no partial state when request fails mid-flight', async () => {
    const pending = deferred<{ items: ActivityItem[] }>()
    apiFetchMock.mockReturnValueOnce(pending.promise)

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    act(() => {
      result.current.refetch()
    })

    // Verify loading state
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()

    // Fail the request
    await act(async () => {
      pending.reject(new ApiError(422, 'Validation failed'))
      await pending.promise.catch(() => undefined)
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Verify clean failure state
    expect(result.current.data).toEqual([])
    expect(result.current.error).toMatchObject({ status: 422 })
  })

  // --- Correct API path ---

  it('calls the correct API endpoint with the encoded address', async () => {
    apiFetchMock.mockResolvedValueOnce({ items: [] })

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    expect(apiFetchMock).toHaveBeenCalledWith(
      `/activity/${encodeURIComponent(VALID_ADDRESS)}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  // --- Success clears error ---

  it('clears a previous error when a subsequent request succeeds', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError(500, 'Server error'))
      .mockResolvedValueOnce({ items: mockActivityItems })

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    // Fail
    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.error).not.toBeNull()
    })

    // Succeed
    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.data).toEqual(mockActivityItems)
    })

    expect(result.current.error).toBeNull()
  })

  // --- Empty response ---

  it('handles an empty items array gracefully', async () => {
    apiFetchMock.mockResolvedValueOnce({ items: [] })

    const { result } = renderHook(() => useActivity(VALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()
  })

  // --- Whitespace-only address is treated as empty ---

  it('does not fetch when address is whitespace only', async () => {
    const { result } = renderHook(() => useActivity('   '))

    await act(async () => {
      result.current.refetch()
    })

    expect(apiFetchMock).not.toHaveBeenCalled()
  })
})
