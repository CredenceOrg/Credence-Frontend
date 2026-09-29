import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAppLocalStorage } from './clearAppLocalStorage'

describe('clearAppLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('clears all items from localStorage', () => {
    localStorage.setItem('credence:settings', JSON.stringify({ theme: 'dark' }))
    localStorage.setItem('credence:onboarding:step', '3')
    localStorage.setItem('other-key', 'keep-me')
    clearAppLocalStorage()
    expect(localStorage.getItem('credence:settings')).toBeNull()
    expect(localStorage.getItem('credence:onboarding:step')).toBeNull()
    expect(localStorage.getItem('other-key')).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('does not throw when localStorage.clear throws', () => {
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
      throw new DOMException('Storage unavailable')
    })
    expect(() => clearAppLocalStorage()).not.toThrow()
  })

  it('does nothing when window is undefined (SSR)', () => {
    vi.stubGlobal('window', undefined)
    expect(() => clearAppLocalStorage()).not.toThrow()
  })
})
