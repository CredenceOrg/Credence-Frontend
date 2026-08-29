import { useEffect, useRef, useState } from 'react'

/**
 * Optional configuration for `useDebouncedValue`.
 */
export interface UseDebouncedValueOptions {
  /**
   * Injectable `setTimeout` for tests or alternate runtimes. Defaults to the
   * global `setTimeout`. The implementation is captured in a ref so the
   * `useEffect` does not re-run when the caller passes an inline function.
   */
  setTimeoutImpl?: typeof setTimeout
  /**
   * Injectable `clearTimeout` for tests or alternate runtimes. Defaults to
   * the global `clearTimeout`. The implementation is captured in a ref so the
   * `useEffect` does not re-run when the caller passes an inline function.
   * Errors thrown by this implementation are silently swallowed so an
   * unmount-time cleanup can never crash the render path.
   */
  clearTimeoutImpl?: typeof clearTimeout
}

/**
 * Returns a debounced copy of `value` that only updates after the input has
 * remained stable for `delayMs` milliseconds.
 *
 * The hook clears any pending timer on:
 * - a new `value` (restarting the delay)
 * - unmount (preventing state updates on an unmounted component)
 *
 * **`delayMs <= 0`** disables debouncing entirely — the raw `value` is returned
 * synchronously on every render.
 *
 * @typeParam T — The value type. Referential identity of the returned value is
 * preserved when the input is unchanged.
 *
 * @param value  The source value to debounce.
 * @param delayMs  Debounce window in milliseconds. `<= 0` means no debounce.
 * @param options  Optional timer-injection knobs (see `UseDebouncedValueOptions`).
 *
 * @returns The debounced (or raw, when `delayMs <= 0`) value.
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const [query, setQuery] = useState('')
 *   const debouncedQuery = useDebouncedValue(query, 300)
 *
 *   useEffect(() => {
 *     if (debouncedQuery) searchAPI(debouncedQuery)
 *   }, [debouncedQuery])
 *
 *   return <input value={query} onChange={e => setQuery(e.target.value)} />
 * }
 * ```
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs: number,
  options?: UseDebouncedValueOptions
): T {
  const { setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = options ?? {}

  const [debouncedValue, setDebouncedValue] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Capture the timer impls in refs so the effect only re-runs on `value` /
  // `delayMs` changes — callers can pass inline function literals without
  // thrashing the effect every render.
  const setTimeoutImplRef = useRef(setTimeoutImpl)
  setTimeoutImplRef.current = setTimeoutImpl
  const clearTimeoutImplRef = useRef(clearTimeoutImpl)
  clearTimeoutImplRef.current = clearTimeoutImpl

  useEffect(() => {
    if (delayMs <= 0) {
      setDebouncedValue(value)
      return
    }

    if (timeoutRef.current !== null) {
      safeClearTimeout(clearTimeoutImplRef.current, timeoutRef.current)
    }

    timeoutRef.current = setTimeoutImplRef.current(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      if (timeoutRef.current !== null) {
        safeClearTimeout(clearTimeoutImplRef.current, timeoutRef.current)
      }
    }
  }, [value, delayMs])

  return delayMs <= 0 ? value : debouncedValue
}

/**
 * Defensive `clearTimeout` wrapper — swallows throws so a broken test double
 * cannot crash the render path during unmount cleanup.
 */
function safeClearTimeout(impl: typeof clearTimeout, handle: ReturnType<typeof setTimeout>): void {
  try {
    impl(handle)
  } catch {
    // Ignore — a broken timer impl should not crash React.
  }
}
