import { RefObject, useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0
  )
}

export interface UseFocusTrapOptions {
  containerRef: RefObject<HTMLElement | null>
  isActive: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
  onEscape?: () => void
  returnFocusOnDeactivate?: boolean
}

/**
 * Traps keyboard focus inside a container while active and restores focus on deactivate.
 */
export function useFocusTrap({
  containerRef,
  isActive,
  initialFocusRef,
  returnFocusRef,
  onEscape,
  returnFocusOnDeactivate = true,
}: UseFocusTrapOptions): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    const container = containerRef.current
    if (!container) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null

    const focusInitial = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
        return
      }
      const focusables = getFocusableElements(container)
      focusables[0]?.focus()
    }

    requestAnimationFrame(focusInitial)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscape?.()
        return
      }

      if (event.key !== 'Tab') return

      const focusables = getFocusableElements(container)
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('keydown', handleKeyDown)

      if (!returnFocusOnDeactivate) return

      const returnTarget = returnFocusRef?.current ?? previouslyFocusedRef.current
      if (returnTarget && typeof returnTarget.focus === 'function') {
        requestAnimationFrame(() => returnTarget.focus())
      }
    }
  }, [containerRef, isActive, initialFocusRef, returnFocusRef, onEscape, returnFocusOnDeactivate])
}
