import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useReducedMotion } from './useReducedMotion'

let mockUseState: ((init: unknown) => [unknown, unknown]) | null = null

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<{
    useState: (init: unknown) => [unknown, unknown]
    useEffect: (effect: unknown, deps: unknown) => void
  }>()
  return {
    ...actual,
    useState: (initialValue: unknown) => {
      if (mockUseState) {
        return mockUseState(initialValue)
      }
      return actual.useState(initialValue)
    },
    useEffect: (effect: unknown, deps: unknown) => {
      if (mockUseState) {
        return
      }
      return actual.useEffect(effect, deps)
    },
  }
})

describe('useReducedMotion', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
    mockUseState = null
  })

  it('returns false when window.matchMedia is undefined', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns false when window is undefined (SSR simulation)', () => {
    // Mock useState to just evaluate the initial value function and return it
    mockUseState = (init: unknown) => {
      const val = typeof init === 'function' ? init() : init
      return [val, vi.fn()]
    }

    const originalWindow = globalThis.window
    try {
      // Temporarily define window as undefined on globalThis
      Object.defineProperty(globalThis, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const result = useReducedMotion()
      expect(result).toBe(false)
    } finally {
      // Restore window
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        writable: true,
        configurable: true,
      })
      mockUseState = null
    }
  })

  it('returns true when media query matches', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(true)
  })

  it('updates state when media query changes using addEventListener', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn().mockImplementation((event, handler) => {
        if (event === 'change') {
          changeHandler = handler
        }
      }),
      removeEventListener: vi.fn().mockImplementation((event, handler) => {
        if (event === 'change' && changeHandler === handler) {
          changeHandler = null
        }
      }),
      dispatchEvent: vi.fn(),
    }))

    const { result, unmount } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
    expect(changeHandler).not.toBeNull()

    // Trigger runtime change
    act(() => {
      changeHandler!({ matches: true } as MediaQueryListEvent)
    })
    expect(result.current).toBe(true)

    // Unmount and verify cleanup
    unmount()
    expect(changeHandler).toBeNull()
  })

  it('updates state when media query changes using addListener (legacy fallback)', () => {
    let changeHandler: ((e: { matches: boolean }) => void) | null = null

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn().mockImplementation((handler) => {
        changeHandler = handler
      }),
      removeListener: vi.fn().mockImplementation((handler) => {
        if (changeHandler === handler) {
          changeHandler = null
        }
      }),
      addEventListener: undefined,
      removeEventListener: undefined,
      dispatchEvent: vi.fn(),
    }))

    const { result, unmount } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
    expect(changeHandler).not.toBeNull()

    // Trigger runtime change
    act(() => {
      changeHandler!({ matches: true })
    })
    expect(result.current).toBe(true)

    // Unmount and verify cleanup
    unmount()
    expect(changeHandler).toBeNull()
  })
})
