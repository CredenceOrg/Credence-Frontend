import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('getDefaultLocale resolution', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  const setEnv = (key: string, value: string | undefined) => {
    if (value === undefined) {
      vi.stubEnv(key, undefined as unknown as string)
    } else {
      vi.stubEnv(key, value)
    }
  }

  const getDefaultLocale = async () => {
    return ((await vi.importActual('./i18n')) as typeof import('./i18n')).getDefaultLocale()
  }

  it('uses VITE_DEFAULT_LOCALE when it is a supported locale', async () => {
    setEnv('VITE_DEFAULT_LOCALE', 'en')
    expect(await getDefaultLocale()).toBe('en')
  })

  it('falls back to "en" when VITE_DEFAULT_LOCALE is unset', async () => {
    setEnv('VITE_DEFAULT_LOCALE', undefined)
    expect(await getDefaultLocale()).toBe('en')
  })

  it('falls back to "en" when VITE_DEFAULT_LOCALE is whitespace', async () => {
    setEnv('VITE_DEFAULT_LOCALE', '   ')
    expect(await getDefaultLocale()).toBe('en')
  })

  it('falls back to "en" and logs an error for an unsupported locale (failure mode)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setEnv('VITE_DEFAULT_LOCALE', 'fr')

    expect(await getDefaultLocale()).toBe('en')
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid VITE_DEFAULT_LOCALE "fr"')
    )

    errorSpy.mockRestore()
  })
})
