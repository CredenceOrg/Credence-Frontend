import { useCallback, useRef } from 'react'
import { logDebug } from '../lib/log'

export function useRoutePrefetch(preload: () => Promise<unknown>) {
  const prefetched = useRef(false)

  const handlePrefetch = useCallback(() => {
    if (prefetched.current) return
    prefetched.current = true
    logDebug('route_prefetch_start', {})
    preload()
      .then(() => {
        logDebug('route_prefetch_complete', {})
      })
      .catch(() => {
        prefetched.current = false
        logDebug('route_prefetch_retry', {})
      })
  }, [preload])

  return {
    onMouseEnter: handlePrefetch,
    onFocus: handlePrefetch,
    onTouchStart: handlePrefetch,
  }
}
