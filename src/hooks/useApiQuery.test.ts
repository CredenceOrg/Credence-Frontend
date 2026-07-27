import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { useApiQuery, invalidateApiQuery, clearApiQueryCache } from './useApiQuery'

const apiFetchMock = vi.fn<typeof import('../api/client').apiFetch>()

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => apiFetchMock(...args),
  }
})

interface MockData {
  score: number
  tier: string
}

const mockData: MockData = { score: 720, tier: 'gold' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  apiFetchMock.mockReset()
  clearApiQueryCache()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useApiQuery', () => {
  it('fetches on mount and transitions loading → success', async () => {
    apiFetchMock.mockResolvedValueOnce(mockData)

    const { result } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeNull()

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
    expect(result.current.isStale).toBe(false)
  })

  it('skips fetch when enabled=false', async () => {
    const { result } = renderHook(() =>
      useApiQuery<MockData>('/trust-score/GABC', { enabled: false })
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('transitions loading → error when the API rejects', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(503, 'Service unavailable'))

    const { result } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toMatchObject({
      status: 503,
      message: 'Service unavailable',
    })
  })

  it('serves from cache within stale time', async () => {
    apiFetchMock.mockResolvedValue(mockData)

    const { result, unmount } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    unmount()

    const { result: result2 } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    expect(result2.current.data).toEqual(mockData)
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })

  it('re-fetches when stale time has expired', async () => {
    apiFetchMock.mockResolvedValue(mockData)

    const { result, unmount } = renderHook(() =>
      useApiQuery<MockData>('/trust-score/GABC', { staleTimeMs: 1 })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    unmount()

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    const { result: result2 } = renderHook(() =>
      useApiQuery<MockData>('/trust-score/GABC', { staleTimeMs: 1 })
    )

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false)
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  it('refetch() always bypasses cache', async () => {
    const freshData = { score: 900, tier: 'platinum' }
    apiFetchMock.mockResolvedValueOnce(mockData).mockResolvedValueOnce(freshData)

    const { result } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(apiFetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refetch()
    })

    expect(result.current.data).toEqual(freshData)
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  it('aborts in-flight request on unmount', async () => {
    const pending = deferred<MockData>()
    apiFetchMock.mockReturnValueOnce(pending.promise)

    const { result, unmount } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    expect(result.current.isLoading).toBe(true)

    const signal = apiFetchMock.mock.calls[0]?.[1]?.signal as AbortSignal
    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })

  it('aborts superseded request when refetch is called', async () => {
    const first = deferred<MockData>()
    const second = deferred<MockData>()
    apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1)
    })

    const firstSignal = apiFetchMock.mock.calls[0]?.[1]?.signal as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    // Fire refetch without awaiting — avoids deadlock with deferred
    act(() => {
      void result.current.refetch()
    })

    expect(firstSignal.aborted).toBe(true)

    await act(async () => {
      second.resolve({ score: 810, tier: 'platinum' })
      await second.promise
    })

    await waitFor(() => {
      expect(result.current.data?.score).toBe(810)
    })
  })

  it('wraps unexpected errors in ApiError', async () => {
    apiFetchMock.mockRejectedValueOnce('unexpected string error')

    const { result } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error?.status).toBe(0)
  })

  it('isStale is true when cached data is older than staleTimeMs', async () => {
    apiFetchMock.mockResolvedValue(mockData)

    const { result, unmount } = renderHook(() =>
      useApiQuery<MockData>('/trust-score/GABC', { staleTimeMs: 1 })
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isStale).toBe(false)
    unmount()

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    const { result: result2 } = renderHook(() =>
      useApiQuery<MockData>('/trust-score/GABC', { staleTimeMs: 1 })
    )

    expect(result2.current.data).toEqual(mockData)
    expect(result2.current.isStale).toBe(true)
  })

  it('invalidateApiQuery clears a specific cached entry', async () => {
    apiFetchMock.mockResolvedValue(mockData)

    const { result, unmount } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    unmount()
    invalidateApiQuery('/trust-score/GABC')

    const { result: result2 } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false)
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  it('clearApiQueryCache removes all entries', async () => {
    apiFetchMock.mockResolvedValue(mockData)

    const { result, unmount } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    unmount()
    clearApiQueryCache()

    const { result: result2 } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result2.current.isLoading).toBe(false)
    })

    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not fetch when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })

    const { result } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeUndefined()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('passes AbortSignal to apiFetch', async () => {
    apiFetchMock.mockResolvedValueOnce(mockData)

    const { result } = renderHook(() => useApiQuery<MockData>('/trust-score/GABC'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/trust-score/GABC',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })
})
