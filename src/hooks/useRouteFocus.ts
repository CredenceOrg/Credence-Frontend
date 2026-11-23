import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { ANNOUNCE_DELAY_MS } from '../components/RouteAnnouncer'

export interface UseRouteFocusOptions {
  /**
   * Delay in milliseconds before moving focus after pathname change.
   * Matches RouteAnnouncer delay so screen readers receive announcement and focus change together.
   * @defaultValue ANNOUNCE_DELAY_MS (100)
   */
  delayMs?: number
  /**
   * ID of the main content container to fall back to when the page has no h1.
   * @defaultValue 'main-content'
   */
  mainId?: string
}

/**
 * Attempts to locate and focus the primary h1 heading within main content (or document).
 * Sets tabIndex="-1" so non-interactive headings can receive programmatic focus.
 *
 * @returns true if an h1 was found and focused, false otherwise.
 */
function tryFocusHeading(mainId: string): boolean {
  const main = document.getElementById(mainId) ?? document.querySelector('main')
  const h1 = (main ? main.querySelector('h1') : null) ?? document.querySelector('h1')

  if (h1) {
    if (h1.getAttribute('tabindex') !== '-1') {
      h1.setAttribute('tabindex', '-1')
    }
    h1.focus()
    return true
  }

  return false
}

/**
 * Focuses the fallback main content container.
 */
function focusFallback(mainId: string): void {
  const fallback = document.getElementById(mainId) ?? document.querySelector('main')
  if (fallback) {
    if (fallback.getAttribute('tabindex') !== '-1') {
      fallback.setAttribute('tabindex', '-1')
    }
    fallback.focus()
  }
}

/**
 * Manages focus on client-side route changes for keyboard and screen-reader accessibility (WCAG 2.4.3).
 *
 * Invariants:
 * 1. Initial render does NOT move focus.
 * 2. Query string (?tab=x) or hash changes do NOT move focus.
 * 3. On pathname changes, focus moves to the page's first h1 (given tabIndex={-1})
 *    after ANNOUNCE_DELAY_MS (100ms).
 * 4. If the page contains no h1, focus falls back to #main-content.
 * 5. If a route suspends (e.g. lazy chunk loading), focus ends on its h1 once loaded,
 *    not on <body>.
 */
export function useRouteFocus(options: UseRouteFocusOptions = {}): void {
  const { delayMs = ANNOUNCE_DELAY_MS, mainId = 'main-content' } = options
  const { pathname } = useLocation()
  const isFirstRender = useRef(true)
  const previousPathname = useRef(pathname)

  useEffect(() => {
    // Invariant 1: Do not move focus on initial page mount.
    if (isFirstRender.current) {
      isFirstRender.current = false
      previousPathname.current = pathname
      return
    }

    // Invariant 2: Do not move focus when only query params or hash change.
    if (previousPathname.current === pathname) {
      return
    }
    previousPathname.current = pathname

    let observer: MutationObserver | null = null
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null

    const timer = setTimeout(() => {
      // Invariant 3: Focus h1 if present after delayMs.
      const focused = tryFocusHeading(mainId)
      if (focused) {
        return
      }

      // Invariant 4: Fall back to #main-content.
      focusFallback(mainId)

      // Invariant 5: If the route is lazy/suspending, observe DOM mutations
      // so when the lazy component mounts its h1, focus moves to that h1.
      const target = document.body
      if (typeof MutationObserver !== 'undefined' && target) {
        observer = new MutationObserver(() => {
          if (tryFocusHeading(mainId)) {
            observer?.disconnect()
            observer = null
            if (maxWaitTimer) {
              clearTimeout(maxWaitTimer)
              maxWaitTimer = null
            }
          }
        })

        observer.observe(target, { childList: true, subtree: true })

        // Safety cap: disconnect observer after 5s to avoid permanent listeners.
        maxWaitTimer = setTimeout(() => {
          observer?.disconnect()
          observer = null
        }, 5000)
      }
    }, delayMs)

    return () => {
      clearTimeout(timer)
      if (maxWaitTimer) {
        clearTimeout(maxWaitTimer)
      }
      if (observer) {
        observer.disconnect()
      }
    }
  }, [pathname, delayMs, mainId])
}

export default useRouteFocus
