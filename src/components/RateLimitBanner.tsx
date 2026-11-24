import { useEffect, useState } from 'react'
import Banner from './Banner'
import { subscribeRateLimit } from '../api/client'
import { useRateLimitRemainingMs } from '../hooks/useRateLimit'

/**
 * Global, polite announcement for API throttling.
 *
 * Renders only while a rate-limit window is active, counts the remaining
 * seconds down from the `retryAfter` value, and disappears at zero. A new
 * rate-limit notice re-opens a banner the user previously dismissed.
 */
export default function RateLimitBanner() {
  const remainingMs = useRateLimitRemainingMs()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => subscribeRateLimit(() => setDismissed(false)), [])

  if (remainingMs <= 0 || dismissed) return null

  const seconds = Math.ceil(remainingMs / 1000)

  return (
    <div
      className="rateLimitBanner"
      aria-live="polite"
      aria-atomic="true"
      style={{ marginBottom: 'var(--credence-space-4)' }}
    >
      <Banner
        severity="info"
        title="Rate limit reached"
        dismissible
        onDismiss={() => setDismissed(true)}
      >
        <p>Too many requests, retry in {seconds} s</p>
      </Banner>
    </div>
  )
}
