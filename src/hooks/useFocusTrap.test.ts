import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFocusTrap } from './useFocusTrap'

function makeFocusable(tag: string = 'button'): HTMLElement {
  const el = document.createElement(tag)
  if (tag === 'button') (el as HTMLButtonElement).type = 'button'
  if (tag === 'a') el.setAttribute('href', '#')
  // Make it "visible" by giving it a non-null offsetParent simulation via mocking
  Object.defineProperty(el, 'offsetParent', { get: () => document.body, configurable: true })
  document.body.appendChild(el)
  return el
}

describe('useFocusTrap', () => {
  let container: HTMLDivElement
  let btn1: HTMLButtonElement
  let btn2: HTMLButtonElement
  let btn3: HTMLButtonElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)

    btn1 = document.createElement('button')
    btn1.type = 'button'
    btn1.textContent = 'First'
    btn2 = document.createElement('button')
    btn2.type = 'button'
    btn2.textContent = 'Second'
    btn3 = document.createElement('button')
    btn3.type = 'button'
    btn3.textContent = 'Third'

    for (const btn of [btn1, btn2, btn3]) {
      Object.defineProperty(btn, 'offsetParent', {
        get: () => document.body,
        configurable: true,
      })
      container.appendChild(btn)
    }
  })

  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('focuses the first focusable element when no initialFocusRef is given', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const containerRef = { current: container }
    renderHook(() => useFocusTrap({ containerRef, isActive: true }))

    expect(document.activeElement).toBe(btn1)
    rafSpy.mockRestore()
  })

  it('focuses the initialFocusRef element when provided', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const containerRef = { current: container }
    const initialFocusRef = { current: btn2 }

    renderHook(() => useFocusTrap({ containerRef, isActive: true, initialFocusRef }))

    expect(document.activeElement).toBe(btn2)
    rafSpy.mockRestore()
  })

  it('does not trap focus when isActive is false', () => {
    const containerRef = { current: container }
    renderHook(() => useFocusTrap({ containerRef, isActive: false }))

    // Focus should not have moved to inside the container
    expect(container.contains(document.activeElement)).toBe(false)
  })

  it('wraps Tab from last element to first', () => {
    const containerRef = { current: container }
    renderHook(() => useFocusTrap({ containerRef, isActive: true }))

    btn3.focus()
    expect(document.activeElement).toBe(btn3)

    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    container.dispatchEvent(tabEvent)

    expect(document.activeElement).toBe(btn1)
  })

  it('wraps Shift+Tab from first element to last', () => {
    const containerRef = { current: container }
    renderHook(() => useFocusTrap({ containerRef, isActive: true }))

    btn1.focus()
    expect(document.activeElement).toBe(btn1)

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
    })
    container.dispatchEvent(shiftTabEvent)

    expect(document.activeElement).toBe(btn3)
  })

  it('calls onEscape and prevents default when Escape is pressed', () => {
    const onEscape = vi.fn()
    const containerRef = { current: container }

    renderHook(() => useFocusTrap({ containerRef, isActive: true, onEscape }))

    const escEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    const preventDefaultSpy = vi.spyOn(escEvent, 'preventDefault')

    container.dispatchEvent(escEvent)

    expect(onEscape).toHaveBeenCalledOnce()
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('restores focus to previouslyFocused element on deactivate', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const externalButton = makeFocusable('button')
    externalButton.focus()

    const containerRef = { current: container }

    const { rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) => useFocusTrap({ containerRef, isActive }),
      { initialProps: { isActive: true } }
    )

    // Deactivate
    rerender({ isActive: false })

    expect(document.activeElement).toBe(externalButton)
    rafSpy.mockRestore()
  })

  it('restores focus to returnFocusRef when provided on deactivate', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const returnTarget = makeFocusable('button')
    const containerRef = { current: container }
    const returnFocusRef = { current: returnTarget }

    const { rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useFocusTrap({ containerRef, isActive, returnFocusRef }),
      { initialProps: { isActive: true } }
    )

    rerender({ isActive: false })

    expect(document.activeElement).toBe(returnTarget)
    rafSpy.mockRestore()
  })

  it('does not restore focus when returnFocusOnDeactivate is false', async () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const externalButton = makeFocusable('button')
    externalButton.focus()

    const containerRef = { current: container }

    const { rerender } = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useFocusTrap({ containerRef, isActive, returnFocusOnDeactivate: false }),
      { initialProps: { isActive: true } }
    )

    rerender({ isActive: false })

    expect(document.activeElement).not.toBe(externalButton)
    rafSpy.mockRestore()
  })

  it('ignores non-Tab/Escape key events', () => {
    const onEscape = vi.fn()
    const containerRef = { current: container }

    renderHook(() => useFocusTrap({ containerRef, isActive: true, onEscape }))

    btn1.focus()
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    container.dispatchEvent(enterEvent)

    expect(onEscape).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(btn1)
  })
})
