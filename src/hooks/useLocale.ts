import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export function useLocale(): void {
  const { i18n } = useTranslation()

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = i18n.language
  }, [i18n.language])
}
