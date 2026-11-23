import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import i18n from '../i18n/config'

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const store: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) }),
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'credence:locale'

async function importHook() {
  // Re-import fresh each time so the module-level state initialiser re-runs
  // with a clean localStorage. Use vi.resetModules() before calling this.
  const { useLocale } = await import('./useLocale')
  return useLocale
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLocale', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
    // Reset i18n to English before each test
    void i18n.changeLanguage('en')
    i18n.removeResourceBundle('es', 'translation')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to "en" when nothing is persisted', async () => {
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
    expect(result.current.locale).toBe('en')
  })

  it('reads a valid persisted locale from localStorage', async () => {
    store[STORAGE_KEY] = 'es'
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
    // The initial value reflects the persisted locale
    expect(result.current.locale).toBe('es')
  })

  it('falls back to "en" for an invalid stored value', async () => {
    store[STORAGE_KEY] = 'fr' // not a supported locale
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
    expect(result.current.locale).toBe('en')
  })

  it('setLocale switches locale, writes to localStorage, and updates document.lang', async () => {
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      await result.current.setLocale('es')
    })

    expect(result.current.locale).toBe('es')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'es')
    expect(document.documentElement.lang).toBe('es')
  })

  it('setLocale is a no-op when already on the requested locale', async () => {
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())

    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage')

    await act(async () => {
      await result.current.setLocale('en')
    })

    expect(changeLanguageSpy).not.toHaveBeenCalled()
  })

  it('isLoading is false after setLocale resolves', async () => {
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())

    await act(async () => {
      await result.current.setLocale('es')
    })

    expect(result.current.isLoading).toBe(false)
  })
})
