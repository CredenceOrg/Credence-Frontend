import { useCallback, useEffect, useRef } from 'react'
import { apiFetch } from '../api/client'
import { useQuery, type UseQueryResult } from './useQuery'

export interface SessionInfo {
  address?: string
  [key: string]: unknown
}

async function fetchSession(): Promise<SessionInfo> {
  return apiFetch<SessionInfo>('/session')
}

/** Minimum interval (ms) between focus-triggered refetches to avoid burst traffic. */
const FOCUS_REFETCH_THROTTLE_MS = 2_000

/**
 * Central hook for auth state. Exposes current-user info and refetches on window focus.
 *
 * Focus refetches are throttled to at most once every {@link FOCUS_REFETCH_THROTTLE_MS}
 * milliseconds so rapid alt-tab / visibility changes don't flood the API.
 */
export function useSession(): UseQueryResult<SessionInfo> {
  const { data, error, isLoading, refetch } = useQuery<SessionInfo>(fetchSession)
  const lastFocusRefetchRef = useRef(0)

  const throttledRefetch = useCallback(() => {
    const now = Date.now()
    if (now - lastFocusRefetchRef.current < FOCUS_REFETCH_THROTTLE_MS) return
    lastFocusRefetchRef.current = now
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.addEventListener('focus', throttledRefetch)
    return () => window.removeEventListener('focus', throttledRefetch)
  }, [throttledRefetch])

  return { data, error, isLoading, refetch }
}
