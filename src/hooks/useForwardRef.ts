import { ForwardedRef, MutableRefObject, useLayoutEffect, useEffect, useRef } from 'react'

export type ReactRef<T> = ForwardedRef<T> | MutableRefObject<T | null> | null | undefined
export type NestedRef<T> = ReactRef<T> | NestedRef<T>[]

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Safely updates a single ref or a nested hierarchy of refs with the given value.
 */
export function setRef<T>(ref: NestedRef<T>, value: T | null): void {
  if (!ref) return

  if (Array.isArray(ref)) {
    for (const item of ref) {
      setRef(item, value)
    }
    return
  }

  if (typeof ref === 'function') {
    try {
      ref(value)
    } catch {
      // Safe fallback for failing callback refs
    }
  } else if (typeof ref === 'object' && 'current' in ref) {
    try {
      ;(ref as MutableRefObject<T | null>).current = value
    } catch {
      // Safe fallback for read-only or frozen ref objects
    }
  }
}

/**
 * Custom hook to merge and forward a local ref with external forwarded refs.
 * Supports nested arrays of callback and object refs and propagates values correctly.
 */
export function useForwardRef<T>(
  ref?: NestedRef<T>,
  initialValue: T | null = null
): MutableRefObject<T | null> {
  const targetRef = useRef<T | null>(initialValue)

  useIsomorphicLayoutEffect(() => {
    setRef(ref, targetRef.current)
    return () => {
      setRef(ref, null)
    }
  })

  return targetRef
}
