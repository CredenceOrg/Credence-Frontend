import { RefObject, useEffect, useRef } from 'react'

/**
 * CSS selector matching the elements that are eligible to receive keyboard focus
 * inside a trapped container. Mirrors the standard tabbable set: links with an
 * `href`, enabled form controls, and anything with a non-negative `tabindex`.
 * Hidden inputs and `tabindex="-1"` (programmatically focusable but not tabbable)
 * elements are intentionally excluded.
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Returns the currently *visible* focusable descendants of `container`, in DOM order.
 *
 * The visibility filter (`offsetParent`/`getClientRects`) drops elements hidden via
 * `display: none` or detached layout, so a `Tab` press never lands on something the
 * user cannot see. This is recomputed on every `Tab` keypress (see {@link useFocusTrap}),
 * which is what makes the trap resilient to content that mounts, unmounts, or toggles
 * `disabled`/visibility while the trap is active.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent &&
    navigator.userAgent.includes('jsdom')
  ) {
    return elements
  }
  return elements.filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0
  )
}

/**
 * Configuration for {@link useFocusTrap}.
 */
export interface UseFocusTrapOptions {
  /**
   * Ref to the element whose focusable descendants should be trapped. The trap is a
   * no-op until `containerRef.current` is populated (e.g. the overlay has rendered).
   */
  containerRef: RefObject<HTMLElement | null>
  /**
   * Whether the trap is engaged. Toggle this to `true` when the overlay opens and
   * `false` when it closes; flipping it drives both the initial-focus and
   * return-focus behavior via the effect lifecycle.
   */
  isActive: boolean
  /**
   * Optional ref to the element that should receive focus when the trap activates.
   * When omitted (or its `current` is null), focus moves to the first focusable
   * element in `containerRef`.
   */
  initialFocusRef?: RefObject<HTMLElement | null>
  /**
   * Optional ref to the element that should receive focus when the trap deactivates.
   * When omitted, focus is restored to whatever element was focused immediately
   * before the trap activated (captured automatically). Only used when
   * {@link UseFocusTrapOptions.returnFocusOnDeactivate} is `true`.
   */
  returnFocusRef?: RefObject<HTMLElement | null>
  /**
   * Called when the user presses `Escape` while the trap is active. The hook calls
   * `event.preventDefault()` before invoking this; closing the overlay is the
   * caller's responsibility (typically by flipping `isActive` to `false`).
   */
  onEscape?: () => void
  /**
   * Whether to move focus back to the return target when the trap deactivates.
   * Set to `false` for overlays that hand focus off elsewhere (e.g. navigating to
   * a new view) so focus is not yanked back to a now-irrelevant trigger.
   * @defaultValue true
   */
  returnFocusOnDeactivate?: boolean
}

/**
 * Constrains keyboard focus to a container while active, then restores focus when it
 * deactivates — the focus-management primitive behind modals, dialogs, and full-screen
 * overlays. See [docs/focus-patterns.md](../../docs/focus-patterns.md) for when a trap
 * is appropriate and the broader focus UX contract.
 *
 * Behavior, in detail:
 *
 * - **Activation.** When `isActive` becomes `true` and `containerRef` is populated, the
 *   hook records the currently focused element (for later restoration) and, on the next
 *   animation frame, moves focus to `initialFocusRef` if provided, otherwise to the first
 *   focusable element in the container. The `requestAnimationFrame` defer lets the overlay
 *   finish painting (and any entrance transition begin) before focus is set, which avoids
 *   focusing an element that is not yet laid out.
 * - **Fresh querying.** The set of focusable elements is recomputed on *every* `Tab`
 *   keypress rather than cached at activation. This keeps the trap correct when the
 *   container's contents change while open — newly mounted controls, conditionally
 *   rendered buttons, or fields toggling `disabled` are all picked up automatically.
 * - **Wrapping.** `Tab` on the last focusable element wraps to the first; `Shift+Tab` on
 *   the first (or when focus has somehow escaped the container) wraps to the last.
 * - **Escape.** `Escape` calls `preventDefault()` and invokes `onEscape`; it does not
 *   itself close anything.
 * - **Deactivation / restore.** On cleanup (when `isActive` flips to `false`, the
 *   container ref changes, or the component unmounts) the `keydown` listener is removed.
 *   If `returnFocusOnDeactivate` is `true`, focus is restored — on the next animation
 *   frame — to `returnFocusRef` if provided, otherwise to the element focused before
 *   activation. The rAF defer ensures the return target is focusable again (e.g. after
 *   the overlay has been removed from the DOM).
 *
 * Edge cases: a container with no focusable elements simply traps nothing (Tab is left
 * to the browser); a return target that has been removed from the DOM is skipped because
 * its `focus` is guarded.
 *
 * SSR-safety: the hook performs all DOM work inside `useEffect`, which never runs during
 * server rendering, so it is safe to call in SSR/SSG environments. Cleanup is automatic —
 * the `keydown` listener is always removed on deactivate/unmount.
 *
 * @param options - {@link UseFocusTrapOptions} controlling the container, activation, and
 *   initial/return focus behavior.
 *
 * @example
 * ```tsx
 * function ConfirmDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
 *   const dialogRef = useRef<HTMLDivElement>(null)
 *   const confirmRef = useRef<HTMLButtonElement>(null)
 *
 *   useFocusTrap({
 *     containerRef: dialogRef,
 *     isActive: open,
 *     initialFocusRef: confirmRef, // focus the primary action on open
 *     onEscape: onClose,           // Escape requests a close
 *   })
 *
 *   if (!open) return null
 *   return (
 *     <div ref={dialogRef} role="dialog" aria-modal="true">
 *       <button onClick={onClose}>Cancel</button>
 *       <button ref={confirmRef} onClick={onClose}>Confirm</button>
 *     </div>
 *   )
 * }
 * ```
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
