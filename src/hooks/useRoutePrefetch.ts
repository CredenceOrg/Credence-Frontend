import { useCallback, useRef } from 'react'

export function useRoutePrefetch(preload: () => Promise<unknown>) {
  const prefetched = useRef(false)

  const handlePrefetch = useCallback(() => {
    if (prefetched.current) return
    prefetched.current = true
    preload().catch(() => {
      prefetched.current = false
    })
  }, [preload])

  return {
    onMouseEnter: handlePrefetch,
    onFocus: handlePrefetch,
    onTouchStart: handlePrefetch,
  }
}
