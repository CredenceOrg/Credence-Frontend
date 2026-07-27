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
      }),
    ).resolves.toBeUndefined()
  })
})
