import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveStoredValue, useLocalStorage, writeToStorage } from './useLocalStorage'

const KEY = 'test:hook'

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // ---------------------------------------------------------------------------
  // resolveStoredValue — pure helper (jsdom paths)
  // ---------------------------------------------------------------------------

  describe('resolveStoredValue', () => {
    it('returns initialValue when the key is absent', () => {
      expect(resolveStoredValue(KEY, 'default')).toBe('default')
    })

    it('returns the parsed value when the key exists', () => {
      localStorage.setItem(KEY, JSON.stringify('stored'))
      expect(resolveStoredValue(KEY, 'default')).toBe('stored')
    })

    it('returns initialValue when stored JSON is corrupt — no throw', () => {
      localStorage.setItem(KEY, '{ bad json }}')
      expect(resolveStoredValue(KEY, 'fallback')).toBe('fallback')
    })

    it('returns initialValue when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage unavailable')
      })
      expect(resolveStoredValue(KEY, 'fallback')).toBe('fallback')
    })

    it('treats boolean false as a valid stored value', () => {
      localStorage.setItem(KEY, JSON.stringify(false))
      expect(resolveStoredValue(KEY, true)).toBe(false)
    })

    it('treats number 0 as a valid stored value', () => {
      localStorage.setItem(KEY, JSON.stringify(0))
      expect(resolveStoredValue(KEY, 99)).toBe(0)
    })

    it('treats empty string as a valid stored value', () => {
      localStorage.setItem(KEY, JSON.stringify(''))
      expect(resolveStoredValue(KEY, 'non-empty')).toBe('')
    })
  })

  // ---------------------------------------------------------------------------
  // writeToStorage — pure helper (jsdom paths)
  // ---------------------------------------------------------------------------

  describe('writeToStorage', () => {
    it('persists a value to localStorage', () => {
      writeToStorage(KEY, 'written')
      expect(JSON.parse(localStorage.getItem(KEY)!)).toBe('written')
    })

    it('does not throw when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      expect(() => writeToStorage(KEY, 'value')).not.toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // SSR window-guard — tested by calling the pure helpers directly (no React)
  // so vi.stubGlobal('window', undefined) does not break the React DOM renderer
  // ---------------------------------------------------------------------------

  describe('SSR window guard (pure functions, window stubbed)', () => {
    it('resolveStoredValue returns initialValue when window is undefined', () => {
      vi.stubGlobal('window', undefined)
      expect(resolveStoredValue(KEY, 'ssr-fallback')).toBe('ssr-fallback')
    })

    it('writeToStorage does not throw when window is undefined', () => {
      vi.stubGlobal('window', undefined)
      expect(() => writeToStorage(KEY, 'value')).not.toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // useLocalStorage hook — initial value resolution
  // ---------------------------------------------------------------------------

  describe('initial value', () => {
    it('returns initialValue when the key is absent', () => {
      const { result } = renderHook(() => useLocalStorage(KEY, 'default'))
      expect(result.current[0]).toBe('default')
    })

    it('returns the stored value when the key exists', () => {
      localStorage.setItem(KEY, JSON.stringify('persisted'))
      const { result } = renderHook(() => useLocalStorage(KEY, 'default'))
      expect(result.current[0]).toBe('persisted')
    })

    it('returns initialValue when stored JSON is corrupt — no throw', () => {
      localStorage.setItem(KEY, '{ bad json }}')
      const { result } = renderHook(() => useLocalStorage(KEY, 'fallback'))
      expect(result.current[0]).toBe('fallback')
    })

    it('treats boolean false as a valid stored value — not replaced by initialValue', () => {
      localStorage.setItem(KEY, JSON.stringify(false))
      const { result } = renderHook(() => useLocalStorage(KEY, true))
      expect(result.current[0]).toBe(false)
    })

    it('treats number 0 as a valid stored value — not replaced by initialValue', () => {
      localStorage.setItem(KEY, JSON.stringify(0))
      const { result } = renderHook(() => useLocalStorage(KEY, 99))
      expect(result.current[0]).toBe(0)
    })

    it('treats empty string as a valid stored value — not replaced by initialValue', () => {
      localStorage.setItem(KEY, JSON.stringify(''))
      const { result } = renderHook(() => useLocalStorage(KEY, 'non-empty'))
      expect(result.current[0]).toBe('')
    })

    it('handles stored objects correctly', () => {
      const stored = { theme: 'dark', count: 3 }
      localStorage.setItem(KEY, JSON.stringify(stored))
      const { result } = renderHook(() => useLocalStorage(KEY, { theme: 'light', count: 0 }))
      expect(result.current[0]).toEqual(stored)
    })
  })

  // ---------------------------------------------------------------------------
  // useLocalStorage hook — setter behaviour
  // ---------------------------------------------------------------------------

  describe('setter', () => {
    it('updates state when called', () => {
      const { result } = renderHook(() => useLocalStorage(KEY, 'initial'))
      act(() => result.current[1]('updated'))
      expect(result.current[0]).toBe('updated')
    })

    it('persists the new value to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage(KEY, 'initial'))
      act(() => result.current[1]('written'))
      expect(JSON.parse(localStorage.getItem(KEY)!)).toBe('written')
    })

    it('round-trips: value read back from localStorage equals what was set', () => {
      type Payload = { a: number; b: unknown[] }
      const payload: Payload = { a: 1, b: [true, null] }
      const { result } = renderHook(() => useLocalStorage<Payload>(KEY, { a: 0, b: [] }))
      act(() => result.current[1](payload))
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(payload)
      expect(result.current[0]).toEqual(payload)
    })

    it('overwrites an existing value', () => {
      localStorage.setItem(KEY, JSON.stringify('old'))
      const { result } = renderHook(() => useLocalStorage(KEY, 'default'))
      act(() => result.current[1]('new'))
      expect(result.current[0]).toBe('new')
      expect(JSON.parse(localStorage.getItem(KEY)!)).toBe('new')
    })

    it('still updates state when localStorage.setItem throws (quota, etc.)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      const { result } = renderHook(() => useLocalStorage(KEY, 'initial'))
      act(() => result.current[1]('in-memory-only'))
      expect(result.current[0]).toBe('in-memory-only')
    })

    it('persists boolean false correctly — not treated as absent on next read', () => {
      const { result } = renderHook(() => useLocalStorage(KEY, true))
      act(() => result.current[1](false))
      expect(result.current[0]).toBe(false)
      const { result: result2 } = renderHook(() => useLocalStorage(KEY, true))
      expect(result2.current[0]).toBe(false)
    })

    it('returns a stable setter reference across re-renders', () => {
      const { result, rerender } = renderHook(() => useLocalStorage(KEY, 0))
      const setterBefore = result.current[1]
      rerender()
      expect(result.current[1]).toBe(setterBefore)
    })
    it('handles undefined written value gracefully', () => {
      const { result } = renderHook(() => useLocalStorage(KEY, 'default'))
      act(() => result.current[1](undefined as any))
      expect(result.current[0]).toBe('default')
    })
  })

  describe('boundary and recovery states', () => {
    it('populates error state when localStorage.setItem throws and recovers on retry', () => {
      let fail = true
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => {
        if (fail) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }

      })
      const { result } = renderHook(() => useLocalStorage(KEY, 'initial'))
      
      act(() => result.current[1]('updated'))
      // The state itself updates even if storage fails
      expect(result.current[0]).toBe('updated')
      expect(result.current[2].error?.name).toBe('QuotaExceededError')
      
      // Recovery
      fail = false
      act(() => result.current[2].retry())
      expect(result.current[2].error).toBeNull()
      
      act(() => result.current[1]('recovered'))
      expect(result.current[0]).toBe('recovered')
      expect(result.current[2].error).toBeNull()
    })

    it('sets permissionGranted to false on SecurityError', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const err = new Error('Security Error')
        err.name = 'SecurityError'
        throw err
      })
      const { result } = renderHook(() => useLocalStorage(KEY, 'initial'))
      expect(result.current[2].permissionGranted).toBe(true) // Initial state

      act(() => result.current[1]('updated'))
      expect(result.current[2].permissionGranted).toBe(false)
      expect(result.current[2].error?.name).toBe('SecurityError')
    })
    
    it('synchronizes state when another tab modifies the storage (stale state handling)', () => {
      const { result } = renderHook(() => useLocalStorage(KEY, 'initial'))
      expect(result.current[0]).toBe('initial')
      
      act(() => {
        localStorage.setItem(KEY, JSON.stringify('from-another-tab'))
        window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
      })
      
      expect(result.current[0]).toBe('from-another-tab')
    })
  })
})
