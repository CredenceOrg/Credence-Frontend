import { render, renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { setRef, useForwardRef, type NestedRef } from './useForwardRef'

describe('useForwardRef', () => {
  it('returns_target_ref_initialized_with_provided_initial_value', () => {
    const { result } = renderHook(() => useForwardRef<HTMLDivElement>(null, null))
    expect(result.current.current).toBeNull()

    const initialElement = document.createElement('div')
    const { result: resultWithInit } = renderHook(() =>
      useForwardRef<HTMLDivElement>(null, initialElement)
    )
    expect(resultWithInit.current.current).toBe(initialElement)
  })

  it('propagates_node_to_single_object_ref', () => {
    const objectRef = createRef<HTMLDivElement>()
    const element = document.createElement('div')

    const { result, rerender } = renderHook(({ ref }) => useForwardRef<HTMLDivElement>(ref), {
      initialProps: { ref: objectRef },
    })

    result.current.current = element
    rerender({ ref: objectRef })

    expect(objectRef.current).toBe(element)
  })

  it('propagates_node_to_single_callback_ref', () => {
    const callbackRef = vi.fn()
    const element = document.createElement('button')

    renderHook(() => useForwardRef<HTMLButtonElement>(callbackRef, element))

    expect(callbackRef).toHaveBeenCalledWith(element)
  })

  it('propagates_node_to_deeply_nested_array_of_refs', () => {
    const ref1 = createRef<HTMLDivElement>()
    const ref2 = vi.fn()
    const ref3 = createRef<HTMLDivElement>()
    const ref4 = vi.fn()

    const nestedRefs: NestedRef<HTMLDivElement> = [ref1, [ref2, [ref3, [ref4]]]]
    const element = document.createElement('div')

    renderHook(() => useForwardRef<HTMLDivElement>(nestedRefs, element))

    expect(ref1.current).toBe(element)
    expect(ref2).toHaveBeenCalledWith(element)
    expect(ref3.current).toBe(element)
    expect(ref4).toHaveBeenCalledWith(element)
  })

  it('propagates_null_to_nested_refs_on_unmount', () => {
    const ref1 = createRef<HTMLDivElement>()
    const ref2 = vi.fn()
    const nestedRefs: NestedRef<HTMLDivElement> = [ref1, [ref2]]
    const element = document.createElement('div')

    const { unmount } = renderHook(() => useForwardRef<HTMLDivElement>(nestedRefs, element))

    expect(ref1.current).toBe(element)
    expect(ref2).toHaveBeenCalledWith(element)

    unmount()

    expect(ref1.current).toBeNull()
    expect(ref2).toHaveBeenLastCalledWith(null)
  })

  it('handles_null_and_undefined_nested_refs_gracefully', () => {
    const ref1 = createRef<HTMLSpanElement>()
    const ref2 = vi.fn()
    const element = document.createElement('span')

    const nestedRefs: NestedRef<HTMLSpanElement> = [
      null,
      undefined,
      ref1,
      [null, undefined, [ref2, undefined]],
    ]

    expect(() => {
      renderHook(() => useForwardRef<HTMLSpanElement>(nestedRefs, element))
    }).not.toThrow()

    expect(ref1.current).toBe(element)
    expect(ref2).toHaveBeenCalledWith(element)
  })

  it('handles_failing_callback_ref_without_blocking_other_refs', () => {
    const failingCallback = vi.fn(() => {
      throw new Error('Callback ref error')
    })
    const validRef = createRef<HTMLInputElement>()
    const validCallback = vi.fn()
    const element = document.createElement('input')

    const nestedRefs: NestedRef<HTMLInputElement> = [failingCallback, validRef, [validCallback]]

    expect(() => {
      renderHook(() => useForwardRef<HTMLInputElement>(nestedRefs, element))
    }).not.toThrow()

    expect(validRef.current).toBe(element)
    expect(validCallback).toHaveBeenCalledWith(element)
  })

  it('works_in_a_real_react_component_rendering_pipeline', () => {
    const outerRef1 = createRef<HTMLHeadingElement>()
    const outerCallback = vi.fn()
    const nestedRefs: NestedRef<HTMLHeadingElement> = [outerRef1, [outerCallback]]

    function TestComponent({ forwardedRef }: { forwardedRef: NestedRef<HTMLHeadingElement> }) {
      const internalRef = useForwardRef<HTMLHeadingElement>(forwardedRef)
      return <h1 ref={internalRef}>Header Title</h1>
    }

    const { unmount } = render(<TestComponent forwardedRef={nestedRefs} />)

    expect(outerRef1.current).toBeInstanceOf(HTMLHeadingElement)
    expect(outerRef1.current?.textContent).toBe('Header Title')
    expect(outerCallback).toHaveBeenCalledWith(outerRef1.current)

    unmount()

    expect(outerRef1.current).toBeNull()
    expect(outerCallback).toHaveBeenLastCalledWith(null)
  })
})

describe('setRef', () => {
  it('returns_early_when_ref_is_null_or_undefined', () => {
    expect(() => {
      setRef(null, document.createElement('div'))
      setRef(undefined, document.createElement('div'))
    }).not.toThrow()
  })

  it('handles_read_only_object_ref_safely', () => {
    const frozenRef = Object.freeze({ current: null })
    const element = document.createElement('div')

    expect(() => {
      setRef(frozenRef as unknown as NestedRef<HTMLDivElement>, element)
    }).not.toThrow()
  })
})
