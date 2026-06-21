import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalStorage } from './useLocalStorage'

// Use a proper in-memory localStorage mock so tests are isolated from
// the jsdom localStorage implementation (which lacks .clear() on this platform).
function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    reset: () => {
      store = {}
      vi.clearAllMocks()
    },
  }
}

const mockStorage = makeLocalStorageMock()

beforeEach(() => {
  mockStorage.reset()
  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  })
})

describe('useLocalStorage', () => {
  describe('initial read', () => {
    it('returns initialValue when key is absent', () => {
      const { result } = renderHook(() => useLocalStorage('absent-key', 'default'))
      expect(result.current[0]).toBe('default')
    })

    it('returns stored value when key exists', () => {
      mockStorage.setItem('stored-key', JSON.stringify('stored'))
      const { result } = renderHook(() => useLocalStorage('stored-key', 'default'))
      expect(result.current[0]).toBe('stored')
    })

    it('falls back to initialValue on corrupt JSON without throwing', () => {
      mockStorage.setItem('bad-key', 'not-valid-json{{{')
      const { result } = renderHook(() => useLocalStorage('bad-key', 'fallback'))
      expect(result.current[0]).toBe('fallback')
    })

    it('boolean false is not treated as missing', () => {
      mockStorage.setItem('bool-key', JSON.stringify(false))
      const { result } = renderHook(() => useLocalStorage('bool-key', true))
      expect(result.current[0]).toBe(false)
    })

    it('returns initialValue when localStorage is unavailable (SSR / restricted env)', () => {
      // Simulate storage being blocked: getItem throws, hook must fall back via try/catch.
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: () => { throw new Error('storage unavailable') }, setItem: vi.fn() },
        writable: true,
        configurable: true,
      })
      const { result } = renderHook(() => useLocalStorage('ssr-key', 'ssr-default'))
      expect(result.current[0]).toBe('ssr-default')
    })
  })

  describe('setter', () => {
    it('round-trips: stored value updates in the hook and persists to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage('rt-key', 'initial'))
      act(() => result.current[1]('updated'))
      expect(result.current[0]).toBe('updated')
      expect(JSON.parse(mockStorage.getItem('rt-key')!)).toBe('updated')
    })

    it('persists on subsequent calls (overwrite)', () => {
      const { result } = renderHook(() => useLocalStorage('ow-key', 'first'))
      act(() => result.current[1]('second'))
      act(() => result.current[1]('third'))
      expect(result.current[0]).toBe('third')
      expect(JSON.parse(mockStorage.getItem('ow-key')!)).toBe('third')
    })

    it('handles object values', () => {
      const obj = { foo: 'bar', count: 42 }
      const { result } = renderHook(() =>
        useLocalStorage<{ foo: string; count: number }>('obj-key', { foo: '', count: 0 }),
      )
      act(() => result.current[1](obj))
      expect(result.current[0]).toEqual(obj)
      expect(JSON.parse(mockStorage.getItem('obj-key')!)).toEqual(obj)
    })

    it('preserves boolean false when set via setter', () => {
      const { result } = renderHook(() => useLocalStorage('set-bool-key', true))
      act(() => result.current[1](false))
      expect(result.current[0]).toBe(false)
      expect(JSON.parse(mockStorage.getItem('set-bool-key')!)).toBe(false)
    })

    it('a new hook instance with the same key reads the persisted value', () => {
      mockStorage.setItem('reread-key', JSON.stringify('persisted'))
      const { result } = renderHook(() => useLocalStorage('reread-key', 'original'))
      expect(result.current[0]).toBe('persisted')
    })
  })
})
