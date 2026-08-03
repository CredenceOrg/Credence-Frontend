import { useCallback, useState } from 'react'

export interface UseAuthRefreshOptions {
  isConnected: boolean
  connect: () => Promise<void>
  reauthThresholdMinutes: number
}

export interface UseAuthRefreshResult {
  lastReauthTime: number | null
  reauth: () => Promise<void>
  isReauthRequired: () => boolean
}

/**
 * Manages wallet re-authentication state.
 *
 * Tracks the last successful re-auth timestamp and determines whether
 * re-authentication is required based on a configurable threshold.
 *
 * @param options - Connection state, connect function, and threshold.
 */
export function useAuthRefresh({
  isConnected,
  connect,
  reauthThresholdMinutes,
}: UseAuthRefreshOptions): UseAuthRefreshResult {
  const [lastReauthTime, setLastReauthTime] = useState<number | null>(null)

  const reauth = useCallback(async () => {
    await connect()
    setLastReauthTime(Date.now())
  }, [connect])

  const isReauthRequired = useCallback(() => {
    if (!isConnected || lastReauthTime === null) {
      return true
    }
    const elapsedMs = Date.now() - lastReauthTime
    const thresholdMs = reauthThresholdMinutes * 60 * 1000
    return elapsedMs >= thresholdMs
  }, [isConnected, lastReauthTime, reauthThresholdMinutes])

  return {
    lastReauthTime,
    reauth,
    isReauthRequired,
  }
}