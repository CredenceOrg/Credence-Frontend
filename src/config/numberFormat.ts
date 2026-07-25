/**
 * @file numberFormat.ts
 * @description Central configuration for locale-aware number formatting.
 *
 * All constants consumed by `FormattedNumber` and `formatNumber` live here so
 * there is a single place to audit and update formatting behaviour.
 */

/**
 * Controls the style of the formatted output.
 *
 * - `'decimal'`   — plain number, e.g. `1,234.50` (en-US) / `1.234,50` (de-DE)
 * - `'currency'`  — number with a currency symbol, e.g. `$1,234.50` / `1.234,50 €`
 * - `'percent'`   — fraction multiplied by 100 with a `%` sign, e.g. `12.5%`
 */
export type NumberFormatStyle = 'decimal' | 'currency' | 'percent'

/**
 * Where a currency symbol is placed relative to the number.
 * Mirrors the `Intl.NumberFormat` `currencyDisplay` option.
 */
export type CurrencyDisplay = 'symbol' | 'narrowSymbol' | 'code' | 'name'

/**
 * Default locale used when no locale is provided via props or i18next context.
 *
 * `'en-US'` is the project-wide fallback; it matches the existing `formatMoney`
 * and `numberFormatter` constants already in `src/lib/format.ts`.
 */
export const DEFAULT_LOCALE = 'en-US'

/**
 * Default currency code applied when `style="currency"` is used without an
 * explicit `currency` prop.
 */
export const DEFAULT_CURRENCY = 'USD'

/**
 * Default currency display mode. `'symbol'` renders `$`, `€`, etc.
 * Override to `'code'` (e.g. `USD`) or `'name'` (e.g. `US dollars`) as needed.
 */
export const DEFAULT_CURRENCY_DISPLAY: CurrencyDisplay = 'symbol'

/**
 * Minimum number of fraction digits used for `'decimal'` style when no explicit
 * precision props are passed.  Keeps parity with the existing `numberFormatter`
 * in `format.ts` (2 decimal places).
 */
export const DEFAULT_MINIMUM_FRACTION_DIGITS = 2

/**
 * Maximum number of fraction digits used for `'decimal'` style when no explicit
 * precision props are passed.
 */
export const DEFAULT_MAXIMUM_FRACTION_DIGITS = 2

/**
 * Sentinel value returned (and rendered) when a non-finite number is passed to
 * `formatNumber`.  Keeps the display safe without throwing.
 */
export const INVALID_NUMBER_PLACEHOLDER = '—'
