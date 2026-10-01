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

vi.mock('@/lib/stellar', () => ({
  isValidStellarAddress: vi.fn((addr) => !!addr && addr.startsWith('G') && addr.length === 56),
}))

const VALID_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
const SECOND_VALID_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const INVALID_ADDRESS = 'not-a-stellar-address'

const mockTrustScore: TrustScore = {
  address: VALID_ADDRESS,
  score: 620,
  tier: 'gold',
  attestations: 3,
  updatedAt: '2026-06-01T00:00:00.000Z',
}

const secondMockTrustScore: TrustScore = {
  address: SECOND_VALID_ADDRESS,
  score: 750,
  tier: 'platinum',
  attestations: 5,
  updatedAt: '2026-06-02T00:00:00.000Z',
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

  describe('address validation and boundaries', () => {
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
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('does not fetch when refetch is called with a whitespace-only address', async () => {
      const { result } = renderHook(() => useTrustScore('   \t\n  '))

      await act(async () => {
        result.current.refetch()
      })

      expect(apiFetchMock).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('trims whitespace around a valid address and queries the trimmed address', async () => {
      const pending = deferred<TrustScore>()
      apiFetchMock.mockReturnValueOnce(pending.promise)

      const paddedAddress = `  ${VALID_ADDRESS}  `
      const { result } = renderHook(() => useTrustScore(paddedAddress))

      act(() => {
        result.current.refetch()
      })

      expect(apiFetchMock).toHaveBeenCalledWith(
        `/trust-score/${encodeURIComponent(VALID_ADDRESS)}`,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )

      await act(async () => {
        pending.resolve(mockTrustScore)
        await pending.promise
      })
    })
  })

  describe('successful fetches', () => {
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
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  describe('API and unexpected errors', () => {
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
      expect(result.current.error).toBeInstanceOf(ApiError)
      expect(result.current.error).toMatchObject({
        status: 503,
        message: 'Service unavailable',
      })
    })

    it('clears existing data when a subsequent refetch fails with ApiError', async () => {
      apiFetchMock
        .mockResolvedValueOnce(mockTrustScore)
        .mockRejectedValueOnce(new ApiError(404, 'Account not found'))

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.data).toEqual(mockTrustScore)
      })

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toMatchObject({
        status: 404,
        message: 'Account not found',
      })
    })

    it('wraps unexpected thrown Error instances in fallback ApiError', async () => {
      apiFetchMock.mockRejectedValueOnce(new Error('Network disconnected'))

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeInstanceOf(ApiError)
      expect(result.current.error).toMatchObject({
        status: 0,
        message: 'Unexpected error while fetching trust score',
      })
    })

    it('wraps unexpected non-Error thrown values in fallback ApiError', async () => {
      apiFetchMock.mockRejectedValueOnce('raw string rejection')

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeInstanceOf(ApiError)
      expect(result.current.error).toMatchObject({
        status: 0,
        message: 'Unexpected error while fetching trust score',
      })
    })
  })

  describe('abort handling', () => {
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

    it('does not expose user-facing error when aborted via DOMException AbortError', async () => {
      const abortError = new DOMException('The user aborted a request.', 'AbortError')
      apiFetchMock.mockRejectedValueOnce(abortError)

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeNull()
      expect(result.current.data).toBeNull()
    })

    it('does not expose user-facing error when aborted via standard Error named AbortError', async () => {
      const abortError = new Error('Request was aborted')
      abortError.name = 'AbortError'
      apiFetchMock.mockRejectedValueOnce(abortError)

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.error).toBeNull()
      expect(result.current.data).toBeNull()
    })
  })

  describe('same-address vs different-address refetch', () => {
    it('retains existing data during same-address refetch until new data arrives', async () => {
      const first = deferred<TrustScore>()
      const second = deferred<TrustScore>()

      apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      act(() => {
        result.current.refetch()
      })

      await act(async () => {
        first.resolve(mockTrustScore)
        await first.promise
      })

      await waitFor(() => {
        expect(result.current.data).toEqual(mockTrustScore)
      })

      act(() => {
        result.current.refetch()
      })

      // While the same-address refetch is in flight, existing data must remain (no flicker)
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toEqual(mockTrustScore)
      expect(result.current.error).toBeNull()

      const updatedScore: TrustScore = {
        ...mockTrustScore,
        score: 790,
      }

      await act(async () => {
        second.resolve(updatedScore)
        await second.promise
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(updatedScore)
      expect(result.current.error).toBeNull()
    })

    it('immediately clears existing data when fetching a different address', async () => {
      const first = deferred<TrustScore>()
      const second = deferred<TrustScore>()

      apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      const { result, rerender } = renderHook(
        ({ address }: { address: string }) => useTrustScore(address),
        { initialProps: { address: VALID_ADDRESS } }
      )

      act(() => {
        result.current.refetch()
      })

      await act(async () => {
        first.resolve(mockTrustScore)
        await first.promise
      })

      await waitFor(() => {
        expect(result.current.data).toEqual(mockTrustScore)
      })

      // Change the address and refetch
      rerender({ address: SECOND_VALID_ADDRESS })

      act(() => {
        result.current.refetch()
      })

      // When fetching a new address, existing data must be immediately cleared
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeNull()
      expect(result.current.error).toBeNull()

      await act(async () => {
        second.resolve(secondMockTrustScore)
        await second.promise
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual(secondMockTrustScore)
      expect(result.current.error).toBeNull()
    })
  })

  describe('concurrency and race conditions', () => {
    it('does not let an older resolving request overwrite a newer request', async () => {
      const first = deferred<TrustScore>()
      const second = deferred<TrustScore>()

      apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      // Trigger first request
      act(() => {
        result.current.refetch()
      })

      // Trigger second request before first finishes
      act(() => {
        result.current.refetch()
      })

      const secondScore: TrustScore = { ...mockTrustScore, score: 900 }

      // Second request resolves first
      await act(async () => {
        second.resolve(secondScore)
        await second.promise
      })

      await waitFor(() => {
        expect(result.current.data?.score).toBe(900)
        expect(result.current.isLoading).toBe(false)
      })

      // First (older) request resolves later
      await act(async () => {
        first.resolve(mockTrustScore)
        await first.promise
      })

      // State must not be overwritten by the older request
      expect(result.current.data?.score).toBe(900)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('does not let an older rejecting request overwrite a newer successful request', async () => {
      const first = deferred<TrustScore>()
      const second = deferred<TrustScore>()

      apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      act(() => {
        result.current.refetch()
      })

      act(() => {
        result.current.refetch()
      })

      const secondScore: TrustScore = { ...mockTrustScore, score: 850 }

      // Second request resolves successfully
      await act(async () => {
        second.resolve(secondScore)
        await second.promise
      })

      await waitFor(() => {
        expect(result.current.data?.score).toBe(850)
        expect(result.current.isLoading).toBe(false)
      })

      // First (older) request rejects later
      await act(async () => {
        first.reject(new ApiError(500, 'Late failure from first request'))
        await first.promise.catch(() => undefined)
      })

      // Newer success state must remain untouched
      expect(result.current.data?.score).toBe(850)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('does not update state when an older request resolves while a newer request is in flight', async () => {
      const first = deferred<TrustScore>()
      const second = deferred<TrustScore>()

      apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      act(() => {
        result.current.refetch()
      })

      act(() => {
        result.current.refetch()
      })

      // First (stale) request resolves while second is still pending
      await act(async () => {
        first.resolve(mockTrustScore)
        await first.promise
      })

      // Data must not be updated to first request's data, and loading must stay true
      expect(result.current.data).toBeNull()
      expect(result.current.isLoading).toBe(true)

      const secondScore: TrustScore = { ...mockTrustScore, score: 777 }
      await act(async () => {
        second.resolve(secondScore)
        await second.promise
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.score).toBe(777)
    })

    it('does not set error when an older request rejects while a newer request is in flight', async () => {
      const first = deferred<TrustScore>()
      const second = deferred<TrustScore>()

      apiFetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      act(() => {
        result.current.refetch()
      })

      act(() => {
        result.current.refetch()
      })

      // First (stale) request rejects while second is still pending
      await act(async () => {
        first.reject(new ApiError(500, 'Old failure'))
        await first.promise.catch(() => undefined)
      })

      // Error must not be exposed and loading must still be true
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(true)

      const secondScore: TrustScore = { ...mockTrustScore, score: 920 }
      await act(async () => {
        second.resolve(secondScore)
        await second.promise
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.score).toBe(920)
      expect(result.current.error).toBeNull()
    })
  })

  describe('unmount cleanup and recovery', () => {
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

    it('does not update state when an in-flight request resolves after unmount', async () => {
      const pending = deferred<TrustScore>()
      apiFetchMock.mockReturnValueOnce(pending.promise)

      const { result, unmount } = renderHook(() => useTrustScore(VALID_ADDRESS))

      act(() => {
        result.current.refetch()
      })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      unmount()

      await act(async () => {
        pending.resolve(mockTrustScore)
        await pending.promise
      })

      expect(result.current.data).toBeNull()
      expect(result.current.isLoading).toBe(true)
      expect(consoleError).not.toHaveBeenCalled()
      expect(consoleWarn).not.toHaveBeenCalled()
    })

    it('does not update state when an in-flight request rejects after unmount', async () => {
      const pending = deferred<TrustScore>()
      apiFetchMock.mockReturnValueOnce(pending.promise)

      const { result, unmount } = renderHook(() => useTrustScore(VALID_ADDRESS))

      act(() => {
        result.current.refetch()
      })

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      unmount()

      await act(async () => {
        pending.reject(new ApiError(500, 'Server error'))
        await pending.promise.catch(() => undefined)
      })

      expect(result.current.error).toBeNull()
      expect(consoleError).not.toHaveBeenCalled()
      expect(consoleWarn).not.toHaveBeenCalled()
    })

    it('recovers cleanly via refetch after an ApiError failure', async () => {
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

      expect(result.current.data).toBeNull()

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.data).toEqual(mockTrustScore)
      })

      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(apiFetchMock).toHaveBeenCalledTimes(2)
    })

    it('recovers cleanly via refetch after an unexpected error', async () => {
      apiFetchMock
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(mockTrustScore)

      const { result } = renderHook(() => useTrustScore(VALID_ADDRESS))

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.error).toMatchObject({
          status: 0,
          message: 'Unexpected error while fetching trust score',
        })
      })

      expect(result.current.data).toBeNull()

      await act(async () => {
        result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.data).toEqual(mockTrustScore)
      })

      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(apiFetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
