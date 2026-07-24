import { useTranslation } from 'react-i18next'
import './Currency.css'

export interface CurrencyProps {
  /** Amount in major units (dollars, not cents). */
  amount: number
  /** ISO 4217 currency code. Defaults to USD. */
  currency?: string
  /** BCP 47 locale. Defaults to the active i18n language. */
  locale?: string
  /** Overrides the currency's CLDR fraction digits when set. */
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  /** Rendered when `amount` is not a finite number. */
  fallback?: string
  /** Additional class names appended to the root element. */
  className?: string
}

export default function Currency({
  amount,
  currency = 'USD',
  locale,
  minimumFractionDigits,
  maximumFractionDigits,
  fallback = '—',
  className = '',
}: CurrencyProps) {
  const { i18n } = useTranslation()

  if (!Number.isFinite(amount)) {
    return <span className={`currency currency--invalid ${className}`.trim()}>{fallback}</span>
  }

  const resolvedLocale = locale ?? i18n.language

  let formatted: string
  try {
    formatted = new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency,
      ...(minimumFractionDigits !== undefined ? { minimumFractionDigits } : {}),
      ...(maximumFractionDigits !== undefined ? { maximumFractionDigits } : {}),
    }).format(amount)
  } catch {
    // Unknown currency code or locale: render the plain number with the code
    // suffix instead of throwing mid-render.
    formatted = `${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)} ${currency}`
  }

  return <span className={`currency ${className}`.trim()}>{formatted}</span>
}
