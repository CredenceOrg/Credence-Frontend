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
 * **Invariants** (relied upon by the boundary/recovery suite):
 * - At most one timer is pending at any moment: scheduling a window releases the
 *   handle of the window it supersedes before registering its own.
 * - A timer handle is released **at most once**. The ref is cleared *before*
 *   `clearTimeout` runs, so a handle can never be observed again after release —
 *   not after it has fired, and not after `delayMs` becomes `<= 0`.
 * - A superseded window can never resurrect a stale value: cancel-then-commit is
 *   strictly ordered, and unmount never attempts a state update.
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
      // Synchronous mode: adopt the raw value immediately. Releasing first is
      // defensive (the superseded window's cleanup normally already released
      // the handle) and guarantees no cancelled window can commit afterwards.
      releaseTimeout(timeoutRef, clearTimeoutImplRef.current)
      setDebouncedValue(value)
      return
    }

    // This window supersedes any pending one: release its handle *before*
    // scheduling so at most one live timer handle exists at a time.
    releaseTimeout(timeoutRef, clearTimeoutImplRef.current)

    timeoutRef.current = setTimeoutImplRef.current(() => {
      // The handle is spent the moment the callback runs. Drop the reference
      // before committing so a later value change can never clear a dead
      // handle (a double release for instrumented / injected clocks).
      timeoutRef.current = null
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      // Superseded or unmounted: cancel the pending commit and release its
      // handle exactly once.
      releaseTimeout(timeoutRef, clearTimeoutImplRef.current)
    }
  }, [value, delayMs])

  return delayMs <= 0 ? value : debouncedValue
}

/**
 * Releases the timer handle held by `ref` at most once: the ref is cleared
 * *before* `clearTimeout` is invoked, so a released handle is never read — and
 * therefore never cleared — a second time, even when the injected
 * `clearTimeout` throws.
 */
function releaseTimeout(
  ref: { current: ReturnType<typeof setTimeout> | null },
  impl: typeof clearTimeout
): void {
  const handle = ref.current
  if (handle === null) return

  ref.current = null
  safeClearTimeout(impl, handle)
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
