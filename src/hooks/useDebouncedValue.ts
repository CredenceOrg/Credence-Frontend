import { useEffect, useRef, useState } from 'react'

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
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (delayMs <= 0) {
      setDebouncedValue(value)
      return
    }

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delayMs])

  return delayMs <= 0 ? value : debouncedValue
}
