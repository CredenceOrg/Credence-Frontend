import { useCallback, useState } from 'react'

/**
 * Persists a value in localStorage under `key`. Falls back to `initialValue`
 * when the key is absent, the stored JSON is corrupt, or `window` is
 * undefined (SSR). The setter writes through to localStorage synchronously.
 *
 * @typeParam T - The type of the stored value.
 * @param key - The localStorage key.
 * @param initialValue - Fallback used when no valid stored entry exists.
 * @returns A stateful [value, setter] pair backed by localStorage.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const item = window.localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T) => {
      try {
        setStoredValue(value)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(value))
        }
      } catch {
        // ignore write failures (private browsing, quota exceeded)
      }
    },
    [key],
  )

  return [storedValue, setValue]
}
