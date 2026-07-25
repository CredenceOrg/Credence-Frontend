import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import { handleLanguageChanged, setPreviousLng } from './localeBreadcrumb'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    fallbackLng: 'en',
    lng: 'en',
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
document.documentElement.lang = initialLanguage

export default i18n
