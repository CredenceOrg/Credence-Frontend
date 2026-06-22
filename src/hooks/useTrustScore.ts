import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import type { TrustScore } from '../api/types'
import { isValidStellarAddress } from '@/lib/stellar'

export interface UseTrustScoreResult {
  /** Trust score payload from `GET /trust-score/:address`, or null before/after a failed fetch. */
  data: TrustScore | null
  /** True while a validated lookup request is in flight. */
  isLoading: boolean
  /** Last fetch failure, excluding intentional AbortError cancellations. */
  error: ApiError | null
  /** Re-runs the lookup for the current address when it passes Stellar validation. */
  refetch: () => void
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

/**
 * Loads trust score data for a Stellar public key via the Credence API.
 *
 * Expects {@link TrustScore} from `src/api/types.ts`:
 * `{ address, score, tier, attestations, updatedAt }`.
 *
 * Does not fetch automatically — call {@link UseTrustScoreResult.refetch} after the
 * user submits a lookup. Invalid or empty addresses are ignored.
 *
 * In-flight requests are cancelled when `refetch` is called again or the hook unmounts.
 */
export function useTrustScore(address: string): UseTrustScoreResult {
  const [data, setData] = useState<TrustScore | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const fetchIdRef = useRef(0)
  const mountedRef = useRef(true)
  const addressRef = useRef(address)

  addressRef.current = address

  const fetchScore = useCallback(async () => {
    const targetAddress = addressRef.current.trim()

    if (!isValidStellarAddress(targetAddress)) {
      return
    }

    abortRef.current?.abort()

    const controller = new AbortController()
    abortRef.current = controller
    const fetchId = ++fetchIdRef.current

    setIsLoading(true)
    setError(null)
    setData(null)

    try {
      const result = await apiFetch<TrustScore>(
        `/trust-score/${encodeURIComponent(targetAddress)}`,
        { signal: controller.signal }
      )

      if (!mountedRef.current || fetchId !== fetchIdRef.current) {
        return
      }

      setData(result)
    } catch (err) {
      if (!mountedRef.current || fetchId !== fetchIdRef.current || isAbortError(err)) {
        return
      }

      setData(null)
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(0, 'Unexpected error while fetching trust score')
      )
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const refetch = useCallback(() => {
    void fetchScore()
  }, [fetchScore])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch,
  }
}
