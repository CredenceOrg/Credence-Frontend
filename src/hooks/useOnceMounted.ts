import { useEffect, useRef } from 'react'

/**
 * Runs the provided callback exactly once per component mount, even under
 * React 18 StrictMode where effects are intentionally double-invoked in
 * development. A true unmount followed by a remount (new component instance)
 * will trigger the callback again.
 *
 * If the callback returns a cleanup function, it will be invoked on unmount
 * (or during StrictMode's simulated unmount before the effect re-runs).
 *
 * @param callback - The function to run once on mount. May optionally return
 *                   a cleanup function invoked on unmount.
 *
 * @example
 * ```tsx
 * function PageViewTracker({ page }: { page: string }) {
 *   useOnceMounted(() => {
 *     analytics.track('page_view', { page })
 *   })
 *   return <main>…</main>
 * }
 * ```
 */
export function useOnceMounted(callback: () => void | (() => void)): void {
  const calledRef = useRef(false)
  const cleanupRef = useRef<(() => void) | undefined>()
  const callbackRef = useRef(callback)

  // Keep the callback ref current so the effect always calls the latest
  // version without needing callback in the dependency array.
  callbackRef.current = callback

  useEffect(() => {
    // In StrictMode dev, effects are intentionally double-invoked
    // (mount → cleanup → mount again). Because useRef values persist across
    // render cycles, calledRef.current stays true after the first invocation
    // and the second effect run becomes a no-op.
    if (calledRef.current) return
    calledRef.current = true

    const result = callbackRef.current()
    if (typeof result === 'function') {
      cleanupRef.current = result
    }

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = undefined
    }
  }, [])
}
