import { useCallback, useEffect, useState } from 'react'
import i18n, { loadLocale, isSupportedLocale, type SupportedLocale } from '../i18n/config'

const STORAGE_KEY = 'credence:locale'
const FALLBACK: SupportedLocale = 'en'

/**
 * Reads the persisted locale from localStorage, validates it, and returns a
 * supported locale or the fallback `'en'`.
 */
function readPersistedLocale(): SupportedLocale {
  if (typeof window === 'undefined') return FALLBACK
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isSupportedLocale(raw) ? raw : FALLBACK
  } catch {
    return FALLBACK
  }
}

function writePersistedLocale(locale: SupportedLocale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignore write failures (quota, private browsing, etc.)
  }
}

export interface UseLocaleResult {
  /** The currently active locale. */
  locale: SupportedLocale
  /**
   * Switch the active locale.
   *
   * Lazy-loads the bundle if it has not been loaded yet, then calls
   * `i18n.changeLanguage()`. Persists the choice to localStorage.
   * Falls back to `'en'` on any load failure.
   */
  setLocale: (next: SupportedLocale) => Promise<void>
  /** True while a bundle is being fetched. */
  isLoading: boolean
}

/**
 * Manages the active i18n locale with lazy bundle loading and localStorage
 * persistence.
 *
 * Mount this hook once at the app root (or in `SettingsProvider`). All
 * `useTranslation()` consumers re-render automatically via i18next's built-in
 * subscriber mechanism after `i18n.changeLanguage()` resolves.
 *
 * @example
 * ```tsx
 * const { locale, setLocale } = useLocale()
 * ```
 */
export function useLocale(): UseLocaleResult {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    const persisted = readPersistedLocale()
    // If i18next has already resolved to a supported language (e.g. from its
    // own localStorage detection) prefer that; otherwise fall back to our key.
    const i18nLng = i18n.language?.slice(0, 2) as SupportedLocale
    return isSupportedLocale(i18nLng) ? i18nLng : persisted
  })
  const [isLoading, setIsLoading] = useState(false)

  // On mount, ensure the bundle for the initial locale is loaded and that
  // i18next is pointing at the right language. This handles the case where
  // a persisted non-English locale was read from localStorage but the bundle
  // has not been imported yet.
  useEffect(() => {
    if (locale === 'en') {
      if (i18n.language !== 'en') {
        void i18n.changeLanguage('en')
      }
      return
    }

    let cancelled = false
    setIsLoading(true)

    loadLocale(locale).then(() => {
      if (cancelled) return
      void i18n.changeLanguage(locale).finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    })

    return () => {
      cancelled = true
    }
  // Run only on mount — the initial locale is fixed by the state initializer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLocale = useCallback(async (next: SupportedLocale): Promise<void> => {
    if (next === locale && i18n.language === next) return

    setIsLoading(true)
    try {
      await loadLocale(next)
      await i18n.changeLanguage(next)
      setLocaleState(next)
      writePersistedLocale(next)
      document.documentElement.lang = next
    } catch {
      // loadLocale already warns; swallow here so callers don't need try/catch
    } finally {
      setIsLoading(false)
    }
  }, [locale])

  return { locale, setLocale, isLoading }
}
