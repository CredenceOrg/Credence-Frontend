/* eslint-disable @typescript-eslint/no-unused-vars */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { DEFAULT_LOCALE_CONFIG, getDefaultLocale } from '../config/i18n'
import en from './locales/en.json'
import { handleLanguageChanged, setPreviousLng } from './localeBreadcrumb'

const defaultLocale = getDefaultLocale()

/** Locale codes that ship with this app. */
export const SUPPORTED_LOCALES = ['en', 'es'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/** Narrowing guard used by the settings schema and the hook. */
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
}

/**
 * Lazily loads a locale bundle and registers it with i18next.
 *
 * The function is idempotent: if the bundle is already loaded it resolves
 * immediately without issuing a second dynamic import. On any failure it
 * logs a warning and falls back silently — the app stays in its current
 * language rather than crashing.
 *
 * The `es` bundle is **not** included in the main chunk; Vite emits it as a
 * separate asset because the import path is dynamic.
 */
export async function loadLocale(locale: SupportedLocale): Promise<void> {
  if (locale === 'en') return // en is bundled synchronously at startup

  if (i18n.hasResourceBundle(locale, 'translation')) return

  try {
    const module = await import(`./locales/${locale}.json`)
    i18n.addResourceBundle(locale, 'translation', module.default ?? module, true, false)
  } catch (err) {
    console.warn(`[i18n] Failed to load locale "${locale}", staying on current language.`, err)
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    fallbackLng: defaultLocale || DEFAULT_LOCALE_CONFIG.defaultLocale,
    lng: defaultLocale || DEFAULT_LOCALE_CONFIG.defaultLocale,
    fallbackLng: 'en',
    // Do not hard-pin to 'en' — let LanguageDetector pick up any persisted
    // preference from localStorage, then the useLocale hook will lazy-load
    // the bundle and call i18n.changeLanguage() after mount.
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })
i18n.on('languageChanged', (lng) => {
  handleLanguageChanged(lng)
  document.documentElement.lang = lng
})

const initialLanguage = i18n.language || 'en'
setPreviousLng(initialLanguage)
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage
}

export default i18n
