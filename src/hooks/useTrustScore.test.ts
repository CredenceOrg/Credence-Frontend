import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import type { TrustScore } from '../api/types'
import { useTrustScore } from './useTrustScore'

const apiFetchMock = vi.fn<typeof import('../api/client').apiFetch>()

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => apiFetchMock(...args),
  }
})

const VALID_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
const INVALID_ADDRESS = 'not-a-stellar-address'

const mockTrustScore: TrustScore = {
  address: VALID_ADDRESS,
  score: 620,
  tier: 'gold',
  attestations: 3,
  updatedAt: '2026-06-01T00:00:00.000Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useTrustScore', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not fetch when refetch is called with an invalid address', async () => {
    const { result } = renderHook(() => useTrustScore(INVALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    expect(apiFetchMock).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('does not fetch when refetch is called with an empty address', async () => {
    const { result } = renderHook(() => useTrustScore(''))

    await act(async () => {
      result.current.refetch()
    })

    expect(apiFetchMock).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('transitions loading → success and returns trust score data', async () => {
    const pending = deferred<TrustScore>()
    apiFetchMock.mockReturnValueOnce(pending.promise)

    const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

    act(() => {
      result.current.refetch()
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.data).toBeNull()

    await act(async () => {
      pending.resolve(mockTrustScore)
      await pending.promise
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toEqual(mockTrustScore)
    expect(result.current.error).toBeNull()
    expect(apiFetchMock).toHaveBeenCalledWith(
      `/trust-score/${encodeURIComponent(VALID_ADDRESS)}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('transitions loading → error when the API rejects', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(503, 'Service unavailable'))

    const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toMatchObject({
      status: 503,
      message: 'Service unavailable',
    })
  })

  it('aborts the prior in-flight request when refetch is called again', async () => {
    const first = deferred<TrustScore>()
    const second = deferred<TrustScore>()

    apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

    act(() => {
      result.current.refetch()
    })

    const firstSignal = apiFetchMock.mock.calls[0]?.[1]?.signal as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    act(() => {
      result.current.refetch()
    })

    expect(firstSignal.aborted).toBe(true)

    await act(async () => {
      first.resolve(mockTrustScore)
      await first.promise.catch(() => undefined)
    })

    await act(async () => {
      second.resolve({
        ...mockTrustScore,
        score: 810,
        tier: 'platinum',
      })
      await second.promise
    })

    await waitFor(() => {
      expect(result.current.data?.score).toBe(810)
    })
  })

  it('aborts in-flight requests on unmount', async () => {
    const pending = deferred<TrustScore>()
    apiFetchMock.mockReturnValueOnce(pending.promise)

    const { result, unmount } = renderHook(() => useTrustScore(VALID_ADDRESS))

    act(() => {
      result.current.refetch()
    })

    const signal = apiFetchMock.mock.calls[0]?.[1]?.signal as AbortSignal
    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
  })

  it('wraps unexpected thrown values in ApiError', async () => {
    apiFetchMock.mockRejectedValueOnce('unexpected')

    const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.error).toMatchObject({
      status: 0,
      message: 'Unexpected error while fetching trust score',
    })
  })

  it('retries via refetch after an error', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError(500, 'Server error'))
      .mockResolvedValueOnce(mockTrustScore)

    const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

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
      expect(result.current.data).toEqual(mockTrustScore)
    })

    expect(result.current.error).toBeNull()
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
  })
})
