import { useCallback, useEffect, useRef } from 'react'

export interface UseSessionOptions {
  /**
   * Async function that fetches / validates the current session.
   * Called once on mount (when `enabled` is true) and again whenever the
   * window receives a `focus` event.
   */
  onRefetch: () => Promise<void> | void
  /**
   * When `false` the hook does nothing — useful for disabling the hook when
   * the user is not authenticated. Defaults to `true`.
   */
  enabled?: boolean
}

/**
 * Calls `onRefetch` on mount and whenever the browser window regains focus
 * (the `window` `focus` event).
 *
 * **Focus vs. visibility change**
 *
 * `window` `focus` fires when the _entire browser window_ comes to the
 * foreground — for example the user alt-tabs back to the browser from another
 * app, or clicks the browser window from the taskbar. It does **not** fire
 * when the user merely switches between open tabs. `visibilitychange` covers
 * both tab-switches _and_ window focus/blur, so only responding to `focus`
 * gives the narrower "window came back to foreground" semantic we want here.
 *
 * **SSR-safe / cleanup**
 *
 * The `focus` listener is attached inside a `useEffect` so it is never
 * registered during SSR. It is removed when the component unmounts or when
 * `enabled` becomes `false`.
 *
 * @example
 * ```tsx
 * useSession({
 *   enabled: isConnected,
 *   onRefetch: async () => {
 *     await refetchSession()
 *   },
 * })
 * ```
 */
export function useSession({ onRefetch, enabled = true }: UseSessionOptions): void {
  // Keep a stable ref so re-renders with a new `onRefetch` identity do not
  // re-register the event listener.
  const onRefetchRef = useRef(onRefetch)
  onRefetchRef.current = onRefetch

  const handleFocus = useCallback(() => {
    void onRefetchRef.current()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return

    // Initial fetch on mount
    void onRefetchRef.current()

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [enabled, handleFocus])
}
