// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { clearSessionStorage } from './clearSessionStorage'

const PRESERVED_KEYS = ['credence:settings', 'credence:onboarding:onboardedAt', 'theme']
const CLEARED_KEYS = [
  'credence:recent-lookups',
  'credence:onboarding:step',
  'credence:pendingTransactions',
  'credence:pinned_widgets',
]

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('clearSessionStorage', () => {
  it('removes form-state keys from localStorage', () => {
    // Seed all keys
    for (const key of [...PRESERVED_KEYS, ...CLEARED_KEYS]) {
      localStorage.setItem(key, key)
    }

    clearSessionStorage()

    // Cleared keys should be gone
    for (const key of CLEARED_KEYS) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })

  it('preserves preference keys (settings, theme, onboarding completion) on logout', () => {
    for (const key of [...PRESERVED_KEYS, ...CLEARED_KEYS]) {
      localStorage.setItem(key, key)
    }

    clearSessionStorage()

    // Preserved keys should still be in localStorage
    for (const key of PRESERVED_KEYS) {
      expect(localStorage.getItem(key)).toBe(key)
    }
  })

  it('handles empty localStorage without throwing', () => {
    expect(() => clearSessionStorage()).not.toThrow()
  })

  it('handles unavailable localStorage without throwing', () => {
    // Simulate a storage-quota error or private-browsing restriction
    const removeItem = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

    expect(() => clearSessionStorage()).not.toThrow()
    removeItem.mockRestore()
  })
})