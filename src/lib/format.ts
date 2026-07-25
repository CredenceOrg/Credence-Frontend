/**
 * @file format.ts
 * @description Shared formatting utilities for the Credence UI.
 *
 * All monetary display helpers live here so that Bond.tsx,
 * CreateBondFlow.tsx, and any future components share a single
 * implementation instead of forking ad-hoc copies.
 *
 * This is the single source of truth for USDC formatting.
 */

/**
 * Number formatter for consistent locale-independent formatting.
 */
const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formats a numeric USDC amount for display with "USDC" suffix.
 *
 * Uses the `en-US` locale to ensure locale-independent thousands
 * separators and decimal notation across all user environments.
 *
 * @example
 * formatUsdc(1234.5)  // → "1,234.5 USDC"
 * formatUsdc(0)       // → "0 USDC"
 * formatUsdc(1e7)     // → "10,000,000 USDC"
 */
export function formatUsdc(amount: number): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC`
}

/**
 * Normalizes user-entered USDC string into a consistent representation.
 *
 * Converts user input (with or without commas) to a fixed 2-decimal string.
 * Returns empty string for invalid input. Clamps negative values to 0.
 *
 * @example
 * normalizeUSDC('1,234.5')   // → "1234.50"
 * normalizeUSDC('100')       // → "100.00"
 * normalizeUSDC('not a number') // → ""
 * normalizeUSDC('-100')      // → "0.00"
 */
export function normalizeUSDC(rawValue: string): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return ''

  const clamped = Math.max(0, numericValue)
  return clamped.toFixed(2)
}

/**
 * Formats a USDC string for display with thousand separators.
 *
 * Returns invalid text unchanged for manual correction by user.
 *
 * @example
 * formatUSDC('1234.5')   // → "1,234.50"
 * formatUSDC('abc')      // → "abc" (unchanged)
 * formatUSDC('')         // → ""
 */
export function formatUSDC(rawValue: string): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return rawValue

  return numberFormatter.format(numericValue)
}

/**
 * UI display formatter for USDC amounts.
 * Similar to formatUSDC but optimized for UI display contexts.
 *
 * @example
 * formatUSDCDisplay('1234.5')   // → "1,234.50"
 * formatUSDCDisplay('1000')     // → "1,000.00"
 */
export function formatUSDCDisplay(rawValue: string): string {
  const trimmed = rawValue.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/,/g, '')
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return rawValue

  return numberFormatter.format(numericValue)
}

/**
 * Sanitizes USDC input by removing invalid characters while preserving valid decimal input.
 *
 * Removes all non-digit and non-dot characters, trims fractions to 2 decimal places,
 * and normalizes leading zeros. Handles multiple dots by using only the first one.
 *
 * @example
 * sanitizeUSDCInput('$1,000.50')  // → "1000.50"
 * sanitizeUSDCInput('12.345')     // → "12.34"
 * sanitizeUSDCInput('00123')      // → "123"
 * sanitizeUSDCInput('0.5')        // → "0.5"
 * sanitizeUSDCInput('100..00')    // → "100.00"
 */
export function sanitizeUSDCInput(nextValue: string): string {
  const cleaned = nextValue.replace(/[^\d.]/g, '')

  // Return empty string if nothing left after cleaning
  if (!cleaned) return ''

  // Handle multiple dots by splitting on first dot only
  const dotIndex = cleaned.indexOf('.')
  if (dotIndex === -1) {
    // No dot, just remove leading zeros
    const trimmed = cleaned.replace(/^0+(?=\d)/, '')
    return trimmed || '0'
  }

  const whole = cleaned.substring(0, dotIndex)
  const fraction = cleaned.substring(dotIndex + 1).replace(/\./g, '') // Remove any additional dots
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '') || '0'
  const trimmedFraction = fraction.slice(0, 2)

  return `${trimmedWhole}.${trimmedFraction}`
}

/**
 * Formats a numeric amount with locale-aware separators.
 *
 * Uses `toLocaleString` so thousands and decimal separators match
 * the conventions of the target locale.  Useful for displaying
 * monetary values in a user's preferred locale.
 *
 * @example
 * formatMoney(1234.5, 'en-US')  // → "1,234.5"
 * formatMoney(1234.5, 'es-ES')  // → "1234,5"
 * formatMoney(1234.5, 'fr-FR')  // → "1 234,5"
 * formatMoney(1234.5, 'ja-JP')  // → "1,234.5"
 * formatMoney(1234.5, 'ar-EG')  // → "١٬٢٣٤٫٥"
 */
export function formatMoney(amount: number, locale: string = 'en-US'): string {
  if (!Number.isFinite(amount)) {
    if (Number.isNaN(amount)) return 'NaN'
    if (amount === Infinity) return '∞'
    if (amount === -Infinity) return '-∞'
  }
  return amount.toLocaleString(locale, { maximumFractionDigits: 2 })
}

/**
 * Options accepted by {@link formatNumber}.
 */
export interface FormatNumberOptions {
  /**
   * BCP 47 locale string (e.g. `'en-US'`, `'de-DE'`, `'ar-EG'`).
   * Defaults to `'en-US'` when omitted.
   */
  locale?: string
  /**
   * `Intl.NumberFormat` style.
   * - `'decimal'`  — plain number (default)
   * - `'currency'` — with currency symbol; requires `currency`
   * - `'percent'`  — multiplied by 100 with % sign
   */
  style?: 'decimal' | 'currency' | 'percent'
  /**
   * ISO 4217 currency code (e.g. `'USD'`, `'EUR'`).
   * Required when `style = 'currency'`; ignored otherwise.
   */
  currency?: string
  /**
   * How the currency symbol is displayed.
   * `'symbol'` (default) | `'narrowSymbol'` | `'code'` | `'name'`
   */
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name'
  /** Minimum number of fraction digits. */
  minimumFractionDigits?: number
  /** Maximum number of fraction digits. */
  maximumFractionDigits?: number
  /** Minimum number of significant digits. */
  minimumSignificantDigits?: number
  /** Maximum number of significant digits. */
  maximumSignificantDigits?: number
}

/**
 * Locale-aware number formatting utility.
 *
 * Wraps `Intl.NumberFormat` and handles non-finite inputs gracefully,
 * returning `'—'` rather than throwing or showing `NaN`/`Infinity`.
 *
 * This is the single formatting primitive consumed by `<FormattedNumber>`.
 * Use this function directly when you only need the formatted string (e.g.
 * for `aria-label` attributes or non-React contexts).
 *
 * @example
 * formatNumber(1234.5)                                   // → "1,234.50"
 * formatNumber(1234.5, { locale: 'de-DE' })              // → "1.234,50"
 * formatNumber(1234.5, { locale: 'fr-FR' })              // → "1 234,50"
 * formatNumber(0.125,  { style: 'percent' })             // → "12.50%"
 * formatNumber(1234.5, { style: 'currency', currency: 'EUR', locale: 'de-DE' })
 *                                                        // → "1.234,50 €"
 * formatNumber(NaN)                                      // → "—"
 * formatNumber(Infinity)                                 // → "—"
 */
export function formatNumber(
  amount: number,
  {
    locale = 'en-US',
    style = 'decimal',
    currency,
    currencyDisplay = 'symbol',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    minimumSignificantDigits,
    maximumSignificantDigits,
  }: FormatNumberOptions = {}
): string {
  if (!Number.isFinite(amount)) return '—'

  const options: Intl.NumberFormatOptions = {
    style,
    currencyDisplay,
    // Only apply fraction digit constraints when significant digit constraints
    // are NOT set — the two groups are mutually exclusive in Intl.NumberFormat.
    ...(minimumSignificantDigits === undefined && maximumSignificantDigits === undefined
      ? { minimumFractionDigits, maximumFractionDigits }
      : {}),
    ...(minimumSignificantDigits !== undefined ? { minimumSignificantDigits } : {}),
    ...(maximumSignificantDigits !== undefined ? { maximumSignificantDigits } : {}),
  }

  if (style === 'currency') {
    options.currency = currency ?? 'USD'
  }

  return new Intl.NumberFormat(locale, options).format(amount)
}
