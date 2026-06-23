import { useCallback, useState } from 'react'

/**
 * Reads the stored value for `key` from localStorage.
 * Returns `initialValue` when the key is absent, the JSON is corrupt, or storage is
 * unavailable (including SSR where `window` is undefined).
 *
 * @internal Exposed so the SSR branch can be exercised in a Node-environment test.
 */
export function resolveStoredValue<T>(key: string, initialValue: T): T {
  if (typeof window === 'undefined') return initialValue
  try {
    const raw = window.localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : initialValue
  } catch {
    return initialValue
  }
}

/**
 * Writes `value` to localStorage under `key`.
 * Silently no-ops when `window` is undefined (SSR) or the write fails (quota, etc.).
 *
 * @internal Exposed so the SSR write branch can be exercised in a Node-environment test.
 */
export function writeToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore write failures (storage quota exceeded, private browsing, etc.)
  }
}

/**
 * Persists a typed value to localStorage and exposes it as React state.
 *
 * @template T - The type of the stored value.
 * @param key - The localStorage key to read from and write to.
 * @param initialValue - Fallback used when the key is absent or the stored JSON is corrupt.
 * @returns A `[value, setValue]` tuple; `setValue` writes through to localStorage synchronously.
 *
 * SSR-safe: reads and writes skip when `window` is undefined (server rendering).
 * Falsy-but-valid stored values (`false`, `0`, `""`, `null`) are returned as-is and are
 * never replaced by `initialValue`.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => resolveStoredValue(key, initialValue))

  const setValue = useCallback(
    (value: T) => {
      setStoredValue(value)
      writeToStorage(key, value)
    },
    [key],
  )

  return [storedValue, setValue]
}
