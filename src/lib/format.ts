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
 * Uses `formatNumber` so thousands and decimal separators match
 * the conventions of the target locale, with safe fallback to en-US.
 *
 * @example
 * formatMoney(1234.5, 'en-US')  // → "1,234.5"
 * formatMoney(1234.5, 'es-ES')  // → "1,234.5" or "1234,5"
 */
export function formatMoney(amount: number, locale: string = 'en-US'): string {
  return formatNumber(amount, locale, { maximumFractionDigits: 2 })
}

/**
 * Default fallback locale used when an invalid or unsupported locale is requested.
 */
export const DEFAULT_LOCALE = 'en-US'

/**
 * Validates whether a locale string is supported by the Intl runtime.
 *
 * @example
 * isValidLocale('en-US') // → true
 * isValidLocale('invalid-locale') // → false
 */
export function isValidLocale(locale: string): boolean {
  if (!locale || typeof locale !== 'string') return false
  try {
    return Intl.NumberFormat.supportedLocalesOf(locale).length > 0
  } catch {
    return false
  }
}

/**
 * Returns the provided locale if valid, or DEFAULT_LOCALE as a fallback.
 */
export function getValidLocale(locale?: string): string {
  if (locale && isValidLocale(locale)) {
    return locale
  }
  return DEFAULT_LOCALE
}

/**
 * Formats a number according to CLDR rules for the given locale.
 *
 * Supports negative values, zero, large numbers, and custom options.
 * Falls back safely to en-US if the locale is unknown or invalid.
 */
export function formatNumber(
  value: number,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string {
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return 'NaN'
    if (value === Infinity) return '∞'
    if (value === -Infinity) return '-∞'
  }
  const safeLocale = getValidLocale(locale)
  try {
    return new Intl.NumberFormat(safeLocale, options).format(value)
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value)
  }
}

/**
 * Formats a monetary amount with currency code and symbol placement per CLDR rules.
 *
 * Handles negative currency values, custom precision, and invalid currency codes gracefully.
 */
export function formatCurrency(
  value: number,
  currency: string = 'USD',
  locale?: string,
  options?: Intl.NumberFormatOptions
): string {
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return 'NaN'
    if (value === Infinity) return '∞'
    if (value === -Infinity) return '-∞'
  }
  const safeLocale = getValidLocale(locale)
  try {
    return new Intl.NumberFormat(safeLocale, {
      style: 'currency',
      currency,
      ...options,
    }).format(value)
  } catch {
    const fallbackOpts: Intl.NumberFormatOptions = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }
    const formattedNum = formatNumber(value, safeLocale, fallbackOpts)
    return `${formattedNum} ${currency}`
  }
}

/**
 * Formats a Date object or timestamp into a locale-aware date string.
 *
 * Supports 'short', 'medium', and 'long' date styles.
 * Uses a default UTC timezone for deterministic test output across environments.
 */
export function formatDate(
  dateInput: Date | string | number,
  formatStyle: 'short' | 'medium' | 'long' = 'medium',
  locale?: string,
  timeZone: string = 'UTC'
): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return 'Invalid Date'

  const safeLocale = getValidLocale(locale)
  const optionsMap: Record<'short' | 'medium' | 'long', Intl.DateTimeFormatOptions> = {
    short: { year: 'numeric', month: 'numeric', day: 'numeric', timeZone },
    medium: { year: 'numeric', month: 'short', day: 'numeric', timeZone },
    long: { year: 'numeric', month: 'long', day: 'numeric', timeZone },
  }

  try {
    return new Intl.DateTimeFormat(safeLocale, optionsMap[formatStyle] || optionsMap.medium).format(
      d
    )
  } catch {
    return new Intl.DateTimeFormat(
      DEFAULT_LOCALE,
      optionsMap[formatStyle] || optionsMap.medium
    ).format(d)
  }
}

/**
 * Formats a Date object or timestamp into a 12-hour or 24-hour time string.
 *
 * Uses a default UTC timezone for deterministic output.
 */
export function formatTime(
  dateInput: Date | string | number,
  style: '12h' | '24h' = '12h',
  locale?: string,
  timeZone: string = 'UTC'
): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return 'Invalid Time'

  const safeLocale = getValidLocale(locale)
  const hour12 = style === '12h'
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12,
    timeZone,
  }

  try {
    return new Intl.DateTimeFormat(safeLocale, options).format(d)
  } catch {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(d)
  }
}

/**
 * Formats a fractional or whole number as a percentage matching CLDR rules.
 */
export function formatPercent(
  value: number,
  locale?: string,
  options?: Intl.NumberFormatOptions
): string {
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return 'NaN'
    if (value === Infinity) return '∞'
    if (value === -Infinity) return '-∞'
  }
  const safeLocale = getValidLocale(locale)
  try {
    return new Intl.NumberFormat(safeLocale, {
      style: 'percent',
      ...options,
    }).format(value)
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'percent',
      ...options,
    }).format(value)
  }
}

/**
 * Formats a relative time offset matching CLDR relative time conventions.
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale?: string,
  options?: Intl.RelativeTimeFormatOptions
): string {
  if (!Number.isFinite(value)) return ''
  const safeLocale = getValidLocale(locale)
  try {
    return new Intl.RelativeTimeFormat(safeLocale, options).format(value, unit)
  } catch {
    try {
      return new Intl.RelativeTimeFormat(DEFAULT_LOCALE, options).format(value, unit)
    } catch {
      return `${value} ${unit}`
    }
  }
}
