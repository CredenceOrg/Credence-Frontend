import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScrollPreserver } from './useScrollPreserver'

describe('useScrollPreserver', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
    vi.restoreAllMocks()
  })

  it('sets overflow to hidden and adds padding when active', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1008,
      configurable: true,
      writable: true,
    })

    renderHook(() => useScrollPreserver({ isActive: true }))

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.paddingRight).toBe('16px')
  })

  it('sets overflow to hidden without padding when scrollbar width is 0', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })

    renderHook(() => useScrollPreserver({ isActive: true }))

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.paddingRight).toBe('')
  })

  it('restores overflow and padding on cleanup', () => {
    document.body.style.overflow = 'visible'
    document.body.style.paddingRight = '8px'

    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1008,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(window, 'scrollY', {
      value: 200,
      configurable: true,
      writable: true,
    })

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    const { unmount } = renderHook(() => useScrollPreserver({ isActive: true }))
    unmount()

    expect(document.body.style.overflow).toBe('visible')
    expect(document.body.style.paddingRight).toBe('8px')
    expect(scrollToSpy).toHaveBeenCalledWith(0, 200)
  })

  it('does nothing when isActive is false', () => {
    document.body.style.overflow = 'visible'

    renderHook(() => useScrollPreserver({ isActive: false }))

    expect(document.body.style.overflow).toBe('visible')
  })

  it('preserves previous overflow value on close (default "visible")', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    const { rerender } = renderHook(({ active }) => useScrollPreserver({ isActive: active }), {
      initialProps: { active: true },
    })

    rerender({ active: false })

    expect(document.body.style.overflow).toBe('')
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
  })

  it('restores scroll position to saved value on deactivation', () => {
    Object.defineProperty(window, 'scrollY', {
      value: 350,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    const { rerender } = renderHook(({ active }) => useScrollPreserver({ isActive: active }), {
      initialProps: { active: true },
    })

    rerender({ active: false })

    expect(scrollToSpy).toHaveBeenCalledWith(0, 350)
  })

  it('does not affect padding when there is no scrollbar', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    })

    renderHook(() => useScrollPreserver({ isActive: true }))

    expect(document.body.style.paddingRight).toBe('')
  })
})
