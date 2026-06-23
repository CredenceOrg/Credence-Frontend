import { useEffect, useRef, useState } from 'react'

/**
 * Returns a debounced version of the input value.
 *
 * The debounced value will only update after the input value has remained
 * unchanged for the specified delay. This helps reduce unnecessary re-renders
 * and computations when dealing with rapid input changes.
 *
 * @param value - The value to debounce
 * @param delayMs - Delay in milliseconds before updating the debounced value
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * function SearchInput() {
 *   const [searchTerm, setSearchTerm] = useState('')
 *   const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)
 *
 *   useEffect(() => {
 *     // Only search after user stops typing for 300ms
 *     searchAPI(debouncedSearchTerm)
 *   }, [debouncedSearchTerm])
 *
 *   return <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
 * }
 * ```
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delayMs])

  return debouncedValue
}
