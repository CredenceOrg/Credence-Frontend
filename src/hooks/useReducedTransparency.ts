import { useEffect, useState } from 'react'
import { DOM_EVENTS } from '../events'

/**
 * Hook to query and subscribe to the user's OS-level transparency preference.
 *
 * Returns `true` if the user prefers reduced transparency (i.e. `prefers-reduced-transparency: reduce`),
 * and `false` otherwise. Safe to run in SSR environments (returns `false` on the server).
 *
 * When `true`, surfaces should replace semi-transparent backgrounds (e.g. modal
 * backdrops, frosted panels) with opaque equivalents so that content behind the
 * overlay does not bleed through and cause contrast or readability problems.
 *
 * @returns boolean indicating whether reduced transparency is preferred.
 */
export function useReducedTransparency(): boolean {
  const [reducedTransparency, setReducedTransparency] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return Boolean(window.matchMedia('(prefers-reduced-transparency: reduce)')?.matches)
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mql = window.matchMedia('(prefers-reduced-transparency: reduce)')
    if (!mql) return

    // Re-sync on mount in case the preference changed before subscribing.
    setReducedTransparency(Boolean(mql.matches))

    const handler = (event: MediaQueryListEvent) => {
      setReducedTransparency(Boolean(event?.matches))
    }

    // Modern browsers support addEventListener, but provide a fallback for legacy environments.
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

  return reducedTransparency
}
