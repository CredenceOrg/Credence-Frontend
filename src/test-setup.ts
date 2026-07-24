import '@testing-library/jest-dom'
import { vi } from 'vitest'
import './i18n/config'

// Guard against Node-environment test files (e.g. useLocalStorage.node.test.ts)
// that run without a DOM — they use the same global setup file but don't have window.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  const createLocalStorage = (): Storage => {
    const store = new Map<string, string>()

    return {
      getItem(key: string) {
        return store.has(key) ? store.get(key) ?? null : null
      },
      setItem(key: string, value: string) {
        store.set(key, String(value))
      },
      removeItem(key: string) {
        store.delete(key)
      },
      clear() {
        store.clear()
      },
      key(index: number) {
        return Array.from(store.keys())[index] ?? null
      },
      get length() {
        return store.size
      },
    } as Storage
  }

  if (typeof window.localStorage === 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: createLocalStorage(),
    })
  }

  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: window.localStorage,
    })
  }

  // Polyfill ResizeObserver for components that use it (e.g. TooltipOnOverflow)
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      private callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe() {
        // Fire callback asynchronously so overflow detection runs after render
        Promise.resolve().then(() => {
          this.callback([], this)
        })
      }
      unobserve() {}
      disconnect() {}
    }
  }
}
