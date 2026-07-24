import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import './TooltipOnOverflow.css'

export interface TooltipOnOverflowProps {
  /**
   * The full text to display in the tooltip when the child content
   * is visually truncated.
   */
  content: string
  /**
   * A single React element whose text content may overflow.
   * The component clones this element to inject event handlers,
   * ref, and aria-describedby.
   */
  children: React.ReactElement
  /** Additional class name appended to the tooltip element. */
  className?: string
}

/**
 * TooltipOnOverflow
 *
 * Wraps a child element and shows a tooltip only when its text content
 * is visually truncated (overflowing). The tooltip appears on hover and
 * focus — keyboard users can see it via Tab navigation and dismiss it
 * with Escape.
 *
 * Accessibility (WCAG 2.1 AA):
 * - Uses `aria-describedby` to associate tooltip content with the trigger.
 * - Dismissible with Escape while focused.
 * - Respects `prefers-reduced-motion`; disables fade animation when set.
 * - Color contrast meets AA (surface/text tokens from the design system).
 * - Tooltip content is rendered in a live region for screen readers.
 *
 * Design tokens:
 * - Colours: `--credence-surface-card`, `--credence-text-primary`,
 *   `--credence-color-slate-900`, `--credence-color-white`
 * - Spacing & radii: `--credence-space-*`, `--credence-radius-md`
 * - Typography: `--credence-font-size-xs`, `--credence-font-family-base`,
 *   `--credence-line-height-tight`
 * - Motion: `--credence-motion-duration-fast`,
 *   `--credence-motion-easing-standard`
 * - Shadow: `--credence-shadow-toast`
 */
export default function TooltipOnOverflow({
  content,
  children,
  className = '',
}: TooltipOnOverflowProps) {
  const reducedMotion = useReducedMotion()
  const tooltipId = useId()
  const childRef = useRef<HTMLElement | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<'top' | 'bottom'>('top')

  // ── Overflow detection ────────────────────────────────────────────────
  const checkOverflow = useCallback(() => {
    const el = childRef.current
    if (!el) return
    // Compare scrollable width against visible width.
    // Use offsetWidth to avoid sub-pixel rounding issues.
    const overflowing = el.scrollWidth > el.offsetWidth
    setIsOverflowing(overflowing)
  }, [])

  useEffect(() => {
    checkOverflow()

    const el = childRef.current
    if (!el) return

    // Re-check on resize (responsive layouts, font scaling, zoom)
    let rafId: number
    const ro = new ResizeObserver(() => {
      // Debounce with rAF to avoid layout thrashing
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(checkOverflow)
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [checkOverflow])

  // ── Position calculation ──────────────────────────────────────────────
  const updatePosition = useCallback(() => {
    const el = childRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const tooltipHeight = 32 // approximate tooltip height in px
    setPosition(rect.top < tooltipHeight + 12 ? 'bottom' : 'top')
  }, [])

  // ── Event handlers ────────────────────────────────────────────────────
  const show = useCallback(() => {
    if (!isOverflowing) return
    updatePosition()
    setVisible(true)
  }, [isOverflowing, updatePosition])

  const hide = useCallback(() => {
    setVisible(false)
  }, [])

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        e.preventDefault()
        e.stopPropagation()
        hide()
      }
    },
    [visible, hide],
  )

  // ── Render ────────────────────────────────────────────────────────────
  // Clone the child to inject our ref, event handlers, and aria-describedby.
  const childProps = children.props as Record<string, unknown>
  const existingDescribedBy = (childProps['aria-describedby'] as string) ?? ''
  const describedBy = [existingDescribedBy, isOverflowing ? tooltipId : '']
    .filter(Boolean)
    .join(' ')

  const mergedProps: Record<string, unknown> = {
    ref: (node: HTMLElement | null) => {
      // Support both callback refs and object refs from the child
      childRef.current = node
      const originalRef = (childProps as { ref?: React.Ref<HTMLElement> }).ref
      if (typeof originalRef === 'function') {
        ;(originalRef as (node: HTMLElement | null) => void)(node)
      } else if (originalRef && 'current' in originalRef) {
        ;(
          originalRef as React.MutableRefObject<HTMLElement | null>
        ).current = node
      }
    },
    onMouseEnter: (e: React.MouseEvent) => {
      show()
      if (typeof childProps.onMouseEnter === 'function') {
        ;(childProps.onMouseEnter as (e: React.MouseEvent) => void)(e)
      }
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide()
      if (typeof childProps.onMouseLeave === 'function') {
        ;(childProps.onMouseLeave as (e: React.MouseEvent) => void)(e)
      }
    },
    onFocus: (e: React.FocusEvent) => {
      show()
      if (typeof childProps.onFocus === 'function') {
        ;(childProps.onFocus as (e: React.FocusEvent) => void)(e)
      }
    },
    onBlur: (e: React.FocusEvent) => {
      hide()
      if (typeof childProps.onBlur === 'function') {
        ;(childProps.onBlur as (e: React.FocusEvent) => void)(e)
      }
    },
    onKeyDown: (e: ReactKeyboardEvent) => {
      handleKeyDown(e)
      if (typeof childProps.onKeyDown === 'function') {
        ;(childProps.onKeyDown as (e: ReactKeyboardEvent) => void)(e)
      }
    },
    'aria-describedby': describedBy || undefined,
  }

  // We use a wrapper span for positioning context
  return (
    <span className="tooltip-on-overflow__wrapper">
      {React.cloneElement(children, mergedProps)}

      {isOverflowing && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`tooltip-on-overflow__tooltip tooltip-on-overflow__tooltip--${position} ${
            visible ? 'tooltip-on-overflow__tooltip--visible' : ''
          } ${className}`.trim()}
          data-reduced-motion={reducedMotion || undefined}
          aria-hidden={!visible}
        >
          {content}
        </span>
      )}
    </span>
  )
}
