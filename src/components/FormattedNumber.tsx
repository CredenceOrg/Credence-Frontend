/**
 * @file FormattedNumber.tsx
 * @description Locale-aware number display component. Closes #597.
 *
 * Renders a number using `Intl.NumberFormat` so that:
 * - Thousand separators match the active locale (e.g. `,` in en-US, `.` in de-DE)
 * - Decimal separators match the active locale (e.g. `.` in en-US, `,` in de-DE)
 * - Currency symbols are placed according to locale convention
 * - Digit scripts are locale-correct (e.g. Arabic-Indic for ar-EG)
 *
 * The locale is resolved from (in priority order):
 *   1. The explicit `locale` prop — highest priority
 *   2. `i18next.language` — the currently active i18n language
 *   3. `'en-US'` fallback — matches the rest of the formatting utilities
 *
 * Non-finite numbers (NaN, ±Infinity) render a safe `'—'` em-dash rather than
 * surfacing JavaScript implementation details in the UI.
 *
 * @example
 * // Basic usage — reads locale from i18next
 * <FormattedNumber value={1234567.89} />
 *
 * // Explicit locale
 * <FormattedNumber value={1234567.89} locale="de-DE" />
 *
 * // Currency
 * <FormattedNumber value={99.9} numberStyle="currency" currency="EUR" locale="fr-FR" />
 *
 * // Percentage
 * <FormattedNumber value={0.125} numberStyle="percent" />
 */

import './FormattedNumber.css'
import { useTranslation } from 'react-i18next'
import { formatNumber, type FormatNumberOptions } from '../lib/format'

export interface FormattedNumberProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  /** The numeric value to display. */
  value: number

  /**
   * BCP 47 locale string (e.g. `'en-US'`, `'de-DE'`, `'ar-EG'`).
   * When omitted the active i18next language is used, falling back to `'en-US'`.
   */
  locale?: string

  /**
   * `Intl.NumberFormat` style.  Named `numberStyle` to avoid colliding with the
   * native HTML `style` attribute on `<span>`.
   *
   * - `'decimal'`  — plain number with thousand/decimal separators (default)
   * - `'currency'` — number with a currency symbol; requires `currency` prop
   * - `'percent'`  — value × 100 with a `%` sign
   */
  numberStyle?: FormatNumberOptions['style']

  /**
   * ISO 4217 currency code (e.g. `'USD'`, `'EUR'`, `'GBP'`).
   * Required when `numberStyle="currency"`; ignored otherwise.
   */
  currency?: string

  /**
   * How the currency symbol is displayed.
   * `'symbol'` (default) → `$`, `'narrowSymbol'` → `$`, `'code'` → `USD`,
   * `'name'` → `US dollars`.
   */
  currencyDisplay?: FormatNumberOptions['currencyDisplay']

  /** Minimum number of fraction digits. Defaults to `2`. */
  minimumFractionDigits?: number

  /** Maximum number of fraction digits. Defaults to `2`. */
  maximumFractionDigits?: number

  /** Minimum number of significant digits. Overrides fraction digit props when set. */
  minimumSignificantDigits?: number

  /** Maximum number of significant digits. Overrides fraction digit props when set. */
  maximumSignificantDigits?: number

  /**
   * Accessible machine-readable label override.
   *
   * When the formatted string uses non-ASCII digit scripts (e.g. Arabic-Indic
   * numerals with `ar-EG`) assistive technology may struggle to announce the
   * value numerically. Pass `ariaLabel` to provide an unambiguous label.
   *
   * When omitted a sensible default is derived: for currency style
   * `"{value} {currency}"` is used; for percent `"{value * 100} percent"`;
   * for decimal the raw numeric value.
   */
  ariaLabel?: string

  /**
   * Screen-reader-only prefix inserted before the formatted number.
   * Mirrors the pattern used by `Badge` and `StatusBadge`.
   *
   * @example
   * <FormattedNumber value={1234} srPrefix="Bond amount:" />
   * // Screen reader: "Bond amount: 1,234.00"
   */
  srPrefix?: string
}

/**
 * Locale-aware number rendering component.
 *
 * Wraps `formatNumber` (which in turn wraps `Intl.NumberFormat`) and surfaces
 * locale, numberStyle, currency, and precision controls as React props. The
 * active i18next language is used as the default locale so the component
 * participates in the app's i18n lifecycle without extra wiring.
 */
export default function FormattedNumber({
  value,
  locale: localeProp,
  numberStyle = 'decimal',
  currency,
  currencyDisplay = 'symbol',
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  minimumSignificantDigits,
  maximumSignificantDigits,
  ariaLabel,
  srPrefix,
  className = '',
  ...rest
}: FormattedNumberProps) {
  const { i18n } = useTranslation()
  // Resolve locale: explicit prop > i18next language > hardcoded fallback
  const locale = localeProp ?? i18n.language ?? 'en-US'

  const formatted = formatNumber(value, {
    locale,
    style: numberStyle,
    currency,
    currencyDisplay,
    minimumFractionDigits,
    maximumFractionDigits,
    minimumSignificantDigits,
    maximumSignificantDigits,
  })

  // Build a sensible default aria-label when the caller hasn't provided one.
  // For non-finite values formatNumber returns '—'; reflect that in the label too.
  const defaultAriaLabel = (() => {
    if (!Number.isFinite(value)) return 'not a number'
    if (numberStyle === 'currency') return `${value} ${currency ?? 'USD'}`
    if (numberStyle === 'percent') return `${(value * 100).toFixed(2)} percent`
    return String(value)
  })()

  const accessibleLabel = ariaLabel ?? defaultAriaLabel

  return (
    <span className={`formatted-number ${className}`.trim()} aria-label={accessibleLabel} {...rest}>
      {srPrefix && <span className="formatted-number__sr">{srPrefix} </span>}
      {formatted}
    </span>
  )
}
