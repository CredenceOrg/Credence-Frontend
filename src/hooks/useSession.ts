import { useEffect } from 'react'
import { apiFetch } from '../api/client'
import { useQuery, type UseQueryResult } from './useQuery'

export interface SessionInfo {
  address?: string
  [key: string]: unknown
}

async function fetchSession(): Promise<SessionInfo> {
  return apiFetch<SessionInfo>('/session')
}

/**
 * Central hook for auth state. Exposes current-user info and refetches on window focus.
 */
export function useSession(): UseQueryResult<SessionInfo> {
  const { data, error, isLoading, refetch } = useQuery<SessionInfo>(fetchSession)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFocus = () => {
      void refetch()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [refetch])

  return { data, error, isLoading, refetch }
}
