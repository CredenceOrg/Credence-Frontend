import { useEffect, useState } from 'react'
import { getRateLimitRemainingMs, subscribeRateLimit } from '../api/client'

/**
 * Tracks the remaining milliseconds of the active API rate-limit window.
 *
 * Re-renders on every rate-limit notification and once per tick while a
 * window is active, so countdown UIs and retry buttons can react without
 * polling the client themselves.
 */
export function useRateLimitRemainingMs(): number {
  const [remainingMs, setRemainingMs] = useState(() => getRateLimitRemainingMs())
  const isActive = remainingMs > 0

  useEffect(() => {
    const sync = () => setRemainingMs(getRateLimitRemainingMs())
    const unsubscribe = subscribeRateLimit(sync)
    sync()

    if (!isActive) return unsubscribe

    const timer = window.setInterval(sync, 250)
    return () => {
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [isActive])

  return remainingMs
}
