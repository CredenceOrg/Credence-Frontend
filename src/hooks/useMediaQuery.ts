import { useEffect, useState } from 'react'

/**
 * SSR-safe hook that subscribes to a CSS media query and returns whether it
 * currently matches. The listener is cleaned up on unmount.
 *
 * @param query - A valid CSS media query string, e.g. `'(max-width: 767px)'`.
 * @returns `true` while the query matches, `false` otherwise. Returns `false`
 *   in environments without `window.matchMedia` (SSR, Node test runners).
 *
 * @example
 * ```tsx
 * const isNarrow = useMediaQuery('(max-width: 767px)')
 * return <span>{isNarrow ? 'Mobile' : 'Desktop'}</span>
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mql = window.matchMedia(query)
    setMatches(mql.matches)

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    mql.addEventListener?.('change', handler)
    return () => mql.removeEventListener?.('change', handler)
  }, [query])

  return matches
}

/**
 * Returns `true` when the viewport is at the mobile breakpoint (< 768 px).
 *
 * @example
 * ```tsx
 * const isMobile = useIsMobile()
 * return <h2>{isMobile ? 'Recent Activity' : 'Recent Activity Timeline'}</h2>
 * ```
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
