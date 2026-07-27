import { useEffect, useState } from 'react'
import { DOM_EVENTS } from '../events'

/**
 * Hook to query and subscribe to the user's OS-level motion preference.
 *
 * Returns `true` if the user prefers reduced motion (i.e. `prefers-reduced-motion: reduce`),
 * and `false` otherwise. Safe to run in SSR environments (returns `false` on the server).
 *
 * @returns boolean indicating whether reduced motion is preferred.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches)
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!mql) return

    // Re-sync on mount in case the preference changed before subscribing.
    setReducedMotion(Boolean(mql.matches))

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(Boolean(event?.matches))
    }

    // Modern browsers support addEventListener, but fallback check is good practice
    const legacyMql = mql as unknown as {
      addListener?: (handler: (ev: MediaQueryListEvent) => void) => void
      removeListener?: (handler: (ev: MediaQueryListEvent) => void) => void
    }

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener(DOM_EVENTS.CHANGE, handler)
      return () => {
        mql.removeEventListener(DOM_EVENTS.CHANGE, handler)
      }
    } else if (typeof legacyMql?.addListener === 'function') {
      // Fallback for older browsers / legacy environments
      legacyMql.addListener(handler)
      return () => {
        legacyMql.removeListener?.(handler)
      }
    }
  }, [])

  return reducedMotion
}
