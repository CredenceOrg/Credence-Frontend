import { useEffect, useState } from 'react'

/**
 * Returns `true` when the browser believes it has network connectivity,
 * `false` when it is offline. Subscribes to the `online` / `offline` window
 * events and cleans up on unmount.
 *
 * Guards against environments where `navigator` or `window` are unavailable
 * (e.g. SSR, certain test environments) by defaulting to `true` (optimistic).
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
