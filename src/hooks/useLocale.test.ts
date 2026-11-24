import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import i18n from '../i18n/config'
import { useLocale } from './useLocale'

const DEFAULT_LANG = 'en'

beforeEach(() => {
  document.documentElement.lang = ''
})

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage(DEFAULT_LANG)
  })
})

describe('useLocale', () => {
  it('sets document.documentElement.lang to the default language on mount', async () => {
    renderHook(() => useLocale())
    await waitFor(() => {
      expect(document.documentElement.lang).toBe(DEFAULT_LANG)
    })
  })

  it('updates document.documentElement.lang when the language changes', async () => {
    renderHook(() => useLocale())

    await act(async () => {
      await i18n.changeLanguage('fr')
    })

    expect(document.documentElement.lang).toBe('fr')
  })

  it('updates document.documentElement.lang on each language change', async () => {
    renderHook(() => useLocale())

    await act(async () => {
      await i18n.changeLanguage('de')
    })
    expect(document.documentElement.lang).toBe('de')

    await act(async () => {
      await i18n.changeLanguage('fr')
    })
    expect(document.documentElement.lang).toBe('fr')

    await act(async () => {
      await i18n.changeLanguage(DEFAULT_LANG)
    })
    expect(document.documentElement.lang).toBe(DEFAULT_LANG)
  })

  it('updates document.documentElement.lang when the hook mounts after the language was already changed', async () => {
    await act(async () => {
      await i18n.changeLanguage('fr')
    })

    renderHook(() => useLocale())

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('fr')
    })
  })

  it('accepts a language code that has no dedicated resource bundle', async () => {
    renderHook(() => useLocale())

    await act(async () => {
      await i18n.changeLanguage('ja')
    })

    expect(document.documentElement.lang).toBe('ja')
  })

  it('does not throw when unmounted and the language changes', async () => {
    const { unmount } = renderHook(() => useLocale())
    unmount()

    await expect(
      act(async () => {
        await i18n.changeLanguage('fr')
      })
    ).resolves.toBeUndefined()
  })
})
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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
  beforeEach(() => {
    localStorageMock.clear()
    vi.resetModules()
    // Reset i18n to English before each test
    void i18n.changeLanguage('en')
    i18n.removeResourceBundle('es', 'translation')
  afterEach(() => {
    vi.restoreAllMocks()
  it('defaults to "en" when nothing is persisted', async () => {
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
    expect(result.current.locale).toBe('en')
  it('reads a valid persisted locale from localStorage', async () => {
    store[STORAGE_KEY] = 'es'
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
    // The initial value reflects the persisted locale
    expect(result.current.locale).toBe('es')
  it('falls back to "en" for an invalid stored value', async () => {
    store[STORAGE_KEY] = 'fr' // not a supported locale
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
    expect(result.current.locale).toBe('en')
  it('setLocale switches locale, writes to localStorage, and updates document.lang', async () => {
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
      await result.current.setLocale('es')
    expect(result.current.locale).toBe('es')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'es')
    expect(document.documentElement.lang).toBe('es')
  it('setLocale is a no-op when already on the requested locale', async () => {
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
    const changeLanguageSpy = vi.spyOn(i18n, 'changeLanguage')
      await result.current.setLocale('en')
    expect(changeLanguageSpy).not.toHaveBeenCalled()
  it('isLoading is false after setLocale resolves', async () => {
    const useLocale = await importHook()
    const { result } = renderHook(() => useLocale())
      await result.current.setLocale('es')
    expect(result.current.isLoading).toBe(false)
