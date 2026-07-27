// i18n runtime configuration
// Default locale can be overridden via Vite env var:
// - VITE_DEFAULT_LOCALE

export const SUPPORTED_LOCALES = ['en'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

const DEFAULT_LOCALE: SupportedLocale = 'en'

const isSupportedLocale = (value: string): value is SupportedLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(value)

export const getDefaultLocale = (): SupportedLocale => {
  const raw = import.meta.env.VITE_DEFAULT_LOCALE?.trim()

  if (!raw) {
    return DEFAULT_LOCALE
  }

  if (isSupportedLocale(raw)) {
    return raw
  }

  console.error(
    `[i18n] Invalid VITE_DEFAULT_LOCALE "${raw}". Supported locales: ${SUPPORTED_LOCALES.join(', ')}. Falling back to "${DEFAULT_LOCALE}".`
  )
  return DEFAULT_LOCALE
}

export const DEFAULT_LOCALE_CONFIG = {
  defaultLocale: getDefaultLocale(),
  supportedLocales: SUPPORTED_LOCALES,
} as const
