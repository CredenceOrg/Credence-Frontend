import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch, ApiError } from '../api/client'
import type { TrustScoreHistory, TrustScoreHistoryPoint } from '../api/types'
import { isValidStellarAddress } from '@/lib/stellar'

export interface UseTrustHistoryResult {
  data: TrustScoreHistoryPoint[]
  isLoading: boolean
  error: ApiError | null
  refetch: () => void
}

function normalizeHistory(input: unknown): TrustScoreHistoryPoint[] | null {
  if (!input || typeof input !== 'object') return null
  const candidate = input as Partial<TrustScoreHistory>
  if (!Array.isArray(candidate.points)) return null

  const points: TrustScoreHistoryPoint[] = []
  for (const point of candidate.points) {
    if (
      !point ||
      typeof point !== 'object' ||
      typeof point.score !== 'number' ||
      !Number.isFinite(point.score) ||
      typeof point.recordedAt !== 'string'
    ) {
      return null
    }
    points.push({
      score: Math.min(1000, Math.max(0, point.score)),
      recordedAt: point.recordedAt,
    })
  }
  return points.sort((left, right) =>
    new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime()
  )
}

export function useTrustHistory(address: string, enabled = true): UseTrustHistoryResult {
  const [data, setData] = useState<TrustScoreHistoryPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const addressRef = useRef(address)
  addressRef.current = address
  const controllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  const fetchHistory = useCallback(async () => {
    if (!enabled) {
      setData([])
      setError(null)
      setIsLoading(false)
      return
    }
    const targetAddress = addressRef.current.trim()
    if (!isValidStellarAddress(targetAddress)) {
      setData([])
      setError(null)
      setIsLoading(false)
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const result = await apiFetch<TrustScoreHistory>(
        `/trust-score/${encodeURIComponent(targetAddress)}/history`,
        { signal: controller.signal }
      )
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      const normalized = normalizeHistory(result)
      if (!normalized) {
        setData([])
        setError(new ApiError(0, 'Malformed trust score history response'))
        return
      }
      setData(normalized)
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      if (err instanceof Error && err.name === 'AbortError') return
      setData([])
      setError(
        err instanceof ApiError
          ? err
          : new ApiError(0, 'Unexpected error while fetching trust score history')
      )
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [enabled])

  useEffect(() => {
    mountedRef.current = true
    void fetchHistory()
    return () => {
      mountedRef.current = false
      controllerRef.current?.abort()
    }
  }, [address, fetchHistory])

  return { data, isLoading, error, refetch: () => void fetchHistory() }
}
