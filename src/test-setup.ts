import '@testing-library/jest-dom'
import { vi } from 'vitest'

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
}
