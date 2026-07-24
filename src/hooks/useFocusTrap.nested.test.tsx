/**
 * Nested-overlay contract tests for useFocusTrap
 *
 * These tests lock in the inside-out close ordering guarantee:
 *   - Only the innermost (topmost) active trap handles Escape; the event must
 *     not propagate to an outer trap's listener.
 *   - Tab / Shift+Tab cycling is constrained to the innermost container when
 *     two traps are active simultaneously.
 *
 * Why DOM nesting?
 * ConfirmDialog / ConnectWalletModal use createPortal and are *siblings* in
 * document.body, so their containers are not in each other's DOM subtrees.
 * In that case the keydown event from the inner dialog bubbles up through the
 * portal root and never reaches the outer dialog's container element.
 *
 * However, a useFocusTrap consumer can choose to render an inner overlay
 * directly inside the outer container (no portal), or nest the two containers
 * in a shared DOM parent.  The hook itself must therefore guarantee the
 * stopPropagation contract so that any composition strategy remains safe.
 * These tests cover that general hook-level contract using real DOM nesting.
 */

import { render, act } from '@testing-library/react'
import React, { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

// ---------------------------------------------------------------------------
// Nested-overlay host component
//
// Renders two containers where innerContainer is a DOM child of outerContainer.
// Both containers have an active useFocusTrap instance.
// ---------------------------------------------------------------------------

interface NestedTrapProps {
  onOuterEscape: () => void
  onInnerEscape: () => void
  /** When false the inner trap is deactivated (only outer remains). */
  innerActive?: boolean
}

function NestedTrapFixture({
  onOuterEscape,
  onInnerEscape,
  innerActive = true,
}: NestedTrapProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useFocusTrap({
    containerRef: outerRef,
    isActive: true,
    onEscape: onOuterEscape,
  })

  useFocusTrap({
    containerRef: innerRef,
    isActive: innerActive,
    onEscape: onInnerEscape,
  })

  return (
    <div ref={outerRef} data-testid="outer-container">
      <button type="button" data-testid="outer-btn-1">
        Outer 1
      </button>
      <button type="button" data-testid="outer-btn-2">
        Outer 2
      </button>
      <div ref={innerRef} data-testid="inner-container">
        <button type="button" data-testid="inner-btn-1">
          Inner 1
        </button>
        <button type="button" data-testid="inner-btn-2">
          Inner 2
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useFocusTrap — nested overlay contract', () => {
  beforeEach(() => {
    // Synchronise requestAnimationFrame so focus moves happen immediately.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    // Make the buttons "visible" (offsetParent non-null) for every test.  The
    // NestedTrapFixture buttons are created via JSX so we have to patch after
    // render; see individual tests where needed.
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // Helper: renders the fixture, patches button offsetParent visibility, and
  // returns query helpers + the rendered containers.
  // -------------------------------------------------------------------------
  function setup(props: NestedTrapProps) {
    const { getByTestId } = render(<NestedTrapFixture {...props} />)

    // Patch offsetParent on all buttons so getFocusableElements picks them up.
    document.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
      Object.defineProperty(btn, 'offsetParent', {
        get: () => document.body,
        configurable: true,
      })
    })

    const outerContainer = getByTestId('outer-container') as HTMLDivElement
    const innerContainer = getByTestId('inner-container') as HTMLDivElement
    const outerBtn1 = getByTestId('outer-btn-1') as HTMLButtonElement
    const outerBtn2 = getByTestId('outer-btn-2') as HTMLButtonElement
    const innerBtn1 = getByTestId('inner-btn-1') as HTMLButtonElement
    const innerBtn2 = getByTestId('inner-btn-2') as HTMLButtonElement

    return { outerContainer, innerContainer, outerBtn1, outerBtn2, innerBtn1, innerBtn2 }
  }

  // -------------------------------------------------------------------------
  // Escape: only innermost trap fires
  // -------------------------------------------------------------------------

  it('escape_key_fires_only_inner_onEscape_when_both_traps_active', () => {
    const onOuterEscape = vi.fn()
    const onInnerEscape = vi.fn()

    const { innerContainer } = setup({ onOuterEscape, onInnerEscape })

    act(() => {
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      innerContainer.dispatchEvent(escEvent)
    })

    // Contract: only the innermost trap's handler should be invoked.
    expect(onInnerEscape).toHaveBeenCalledOnce()
    expect(onOuterEscape).not.toHaveBeenCalled()
  })

  it('escape_key_fires_outer_onEscape_when_only_outer_trap_is_active', () => {
    const onOuterEscape = vi.fn()
    const onInnerEscape = vi.fn()

    const { outerContainer } = setup({
      onOuterEscape,
      onInnerEscape,
      innerActive: false,
    })

    act(() => {
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      outerContainer.dispatchEvent(escEvent)
    })

    expect(onOuterEscape).toHaveBeenCalledOnce()
    expect(onInnerEscape).not.toHaveBeenCalled()
  })

  it('escape_key_calls_preventDefault_and_stops_propagation', () => {
    const onOuterEscape = vi.fn()
    const onInnerEscape = vi.fn()

    const { innerContainer } = setup({ onOuterEscape, onInnerEscape })

    let capturedEvent: KeyboardEvent | null = null

    act(() => {
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
      capturedEvent = escEvent
      innerContainer.dispatchEvent(escEvent)
    })

    // The event must have been cancelled (preventDefault) and stopped (stopPropagation).
    expect(capturedEvent!.defaultPrevented).toBe(true)
    // The outer handler must not have been triggered — stopPropagation worked.
    expect(onOuterEscape).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Tab: stays inside the innermost container
  // -------------------------------------------------------------------------

  it('tab_key_wraps_within_inner_container_when_inner_trap_is_active', () => {
    const onOuterEscape = vi.fn()
    const onInnerEscape = vi.fn()

    const { innerContainer, innerBtn1, innerBtn2 } = setup({
      onOuterEscape,
      onInnerEscape,
    })

    // Focus the last button in the inner container.
    act(() => {
      innerBtn2.focus()
    })
    expect(document.activeElement).toBe(innerBtn2)

    // Tab from last inner element should wrap to first inner element,
    // not escape to an outer element.
    act(() => {
      const tabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      })
      innerContainer.dispatchEvent(tabEvent)
    })

    expect(document.activeElement).toBe(innerBtn1)
  })

  it('shift_tab_key_wraps_within_inner_container_when_inner_trap_is_active', () => {
    const onOuterEscape = vi.fn()
    const onInnerEscape = vi.fn()

    const { innerContainer, innerBtn1, innerBtn2 } = setup({
      onOuterEscape,
      onInnerEscape,
    })

    // Focus the first button in the inner container.
    act(() => {
      innerBtn1.focus()
    })
    expect(document.activeElement).toBe(innerBtn1)

    // Shift+Tab from first inner element should wrap to last inner element,
    // not jump to an outer element.
    act(() => {
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
      innerContainer.dispatchEvent(shiftTabEvent)
    })

    expect(document.activeElement).toBe(innerBtn2)
  })

  // -------------------------------------------------------------------------
  // Sad path: pressing Escape twice closes overlays inside-out
  // -------------------------------------------------------------------------

  it('escape_pressed_twice_closes_inner_then_outer_in_order', () => {
    const closedOrder: string[] = []
    const onOuterEscape = vi.fn(() => closedOrder.push('outer'))
    const onInnerEscape = vi.fn(() => closedOrder.push('inner'))

    const { innerContainer, outerContainer } = setup({
      onOuterEscape,
      onInnerEscape,
    })

    // First Escape: should close inner only.
    act(() => {
      innerContainer.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )
    })

    expect(onInnerEscape).toHaveBeenCalledOnce()
    expect(onOuterEscape).not.toHaveBeenCalled()

    // Second Escape (now only outer trap active): should close outer.
    // Simulate by dispatching from the outer container (inner trap would have
    // been deactivated by the caller after the first Escape, but here we just
    // dispatch from outerContainer directly to mimic that state).
    act(() => {
      outerContainer.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      )
    })

    expect(onOuterEscape).toHaveBeenCalledOnce()
    expect(closedOrder).toEqual(['inner', 'outer'])
  })
})
