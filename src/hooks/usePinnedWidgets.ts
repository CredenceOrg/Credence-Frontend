import { useState, useCallback, useEffect } from 'react'
import { PINNED_WIDGETS_STORAGE_KEY, MAX_PINNED_WIDGETS } from '../config/pinnedWidgets'

export function usePinnedWidgets() {
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(PINNED_WIDGETS_STORAGE_KEY)
      if (!raw) return []

      const stored: unknown = JSON.parse(raw)
      if (!Array.isArray(stored) || !stored.every((slug) => typeof slug === 'string')) {
        return []
      }

      return [...new Set(stored)].slice(0, MAX_PINNED_WIDGETS)
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_WIDGETS_STORAGE_KEY, JSON.stringify(pinned))
    } catch {
      // localStorage unavailable (private mode, quota, etc.) — fail silently
    }
  }, [pinned])

  const togglePin = useCallback((slug: string) => {
    setPinned((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : [...prev, slug].slice(0, MAX_PINNED_WIDGETS)
    )
  }, [])

  const move = useCallback((slug: string, delta: number) => {
    setPinned((prev) => {
      const currentIndex = prev.indexOf(slug)
      if (currentIndex === -1 || !Number.isFinite(delta)) return prev

      const targetIndex = Math.max(0, Math.min(prev.length - 1, currentIndex + Math.trunc(delta)))
      if (targetIndex === currentIndex) return prev

      const next = [...prev]
      next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, slug)
      return next
    })
  }, [])

  const isPinned = useCallback((slug: string) => pinned.includes(slug), [pinned])

  return { pinned, togglePin, isPinned, move }
}
