import { useCallback, useEffect, useRef } from 'react'
import { DEFAULT_SCROLL_THROTTLE_MS } from '../config/scroll'

/**
 * Custom hook that returns a throttled version of the provided `callback` function.
 * Throttles execution so that the callback is invoked at most once per `delayMs` interval.
 * Ideal for scroll-tracking, resize, and mousemove event handlers to prevent excessive `setState` calls.
 *
 * Behavior:
 * - Fires immediately on the first invocation (leading edge).
 * - Trailing calls within the throttle window trigger execution at the end of the window.
 * - When `delayMs <= 0`, throttling is disabled and the callback executes synchronously on every call.
 * - Clears pending timers on unmount to avoid memory leaks or state updates on unmounted components.
 *
 * @typeParam T - The callback function signature.
 * @param callback - The target callback function to throttle.
 * @param delayMs - Minimum time window between callback executions in milliseconds. Defaults to {@link DEFAULT_SCROLL_THROTTLE_MS}.
 * @returns A referentially stable throttled callback function.
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delayMs: number = DEFAULT_SCROLL_THROTTLE_MS
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback)
  const lastExecTimeRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastArgsRef = useRef<Parameters<T> | null>(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      if (delayMs <= 0) {
        callbackRef.current(...args)
        return
      }

      const now = Date.now()
      const elapsed = now - lastExecTimeRef.current
      lastArgsRef.current = args

      if (elapsed >= delayMs) {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        lastExecTimeRef.current = now
        callbackRef.current(...args)
      } else if (timeoutRef.current === null) {
        const remaining = delayMs - elapsed
        timeoutRef.current = setTimeout(() => {
          lastExecTimeRef.current = Date.now()
          timeoutRef.current = null
          if (lastArgsRef.current) {
            callbackRef.current(...lastArgsRef.current)
            lastArgsRef.current = null
          }
        }, remaining)
      }
    },
    [delayMs]
  )

  return throttledCallback
}
