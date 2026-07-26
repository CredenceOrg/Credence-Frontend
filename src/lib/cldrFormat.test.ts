import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatCurrency,
  formatDate,
  formatTime,
  formatPercent,
  formatRelativeTime,
  isValidLocale,
  getValidLocale,
  DEFAULT_LOCALE,
} from './format'

describe('CLDR Locale Formatting Regression Test Suite', () => {
  // ---------------------------------------------------------------------------
  // 1. Number Formatting
  // ---------------------------------------------------------------------------
  describe('Number Formatting', () => {
    it('formats_number_according_to_cldr_locale_rules', () => {
      // en-US: comma thousand separator, dot decimal separator
      expect(formatNumber(1234567.89, 'en-US')).toBe('1,234,567.89')

      // de-DE: dot thousand separator, comma decimal separator
      expect(formatNumber(1234567.89, 'de-DE')).toBe('1.234.567,89')

      // fr-FR: narrow space thousand separator (\u202f), comma decimal separator
      const frFormatted = formatNumber(1234567.89, 'fr-FR')
      expect(frFormatted).toMatch(/1[\s\u202f]234[\s\u202f]567,89/)
    })

    it('formats_zero_and_negative_numbers_correctly_across_locales', () => {
      expect(formatNumber(0, 'en-US')).toBe('0')
      expect(formatNumber(-1234.5, 'en-US')).toBe('-1,234.5')
      expect(formatNumber(-1234.5, 'de-DE')).toBe('-1.234,5')
    })

    it('formats_very_large_numbers_with_multiple_grouping_separators', () => {
      expect(formatNumber(1000000000.5, 'en-US')).toBe('1,000,000,000.5')
      expect(formatNumber(1000000000.5, 'de-DE')).toBe('1.000.000.000,5')
    })

    it('handles_non_finite_number_inputs_gracefully', () => {
      expect(formatNumber(NaN, 'en-US')).toBe('NaN')
      expect(formatNumber(Infinity, 'en-US')).toBe('∞')
      expect(formatNumber(-Infinity, 'en-US')).toBe('-∞')
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Currency Formatting
  // ---------------------------------------------------------------------------
  describe('Currency Formatting', () => {
    it('formats_currency_using_cldr_rules', () => {
      // en-US with USD ($ before number)
      expect(formatCurrency(1234.5, 'USD', 'en-US')).toBe('$1,234.50')

      // de-DE with EUR (symbol after number with space)
      const deEur = formatCurrency(1234.5, 'EUR', 'de-DE')
      expect(deEur).toMatch(/1\.234,50[\s\u00a0]€/)

      // ja-JP with JPY (¥ or ￥ symbol before number, 0 fraction digits)
      expect(formatCurrency(1234, 'JPY', 'ja-JP')).toMatch(/[¥￥]1,234/)
    })

    it('formats_negative_currency_values_per_cldr_spec', () => {
      expect(formatCurrency(-1234.5, 'USD', 'en-US')).toBe('-$1,234.50')
      const deNegEur = formatCurrency(-1234.5, 'EUR', 'de-DE')
      expect(deNegEur).toMatch(/-1\.234,50[\s\u00a0]€/)
    })

    it('respects_custom_decimal_precision_override_in_currency', () => {
      expect(
        formatCurrency(1234.5678, 'USD', 'en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
      ).toBe('$1,234.568')
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Date Formatting
  // ---------------------------------------------------------------------------
  describe('Date Formatting', () => {
    // Fixed deterministic reference date: 2026-07-26 09:30:00 UTC
    const frozenDate = new Date('2026-07-26T09:30:00Z')

    it('formats_dates_consistently_for_supported_locales', () => {
      // Short format in en-US (M/D/YY or M/D/YYYY)
      const shortEn = formatDate(frozenDate, 'short', 'en-US', 'UTC')
      expect(shortEn).toBe('7/26/2026')

      // Medium format in en-US (MMM D, YYYY)
      const mediumEn = formatDate(frozenDate, 'medium', 'en-US', 'UTC')
      expect(mediumEn).toBe('Jul 26, 2026')

      // Long format in en-US (MMMM D, YYYY)
      const longEn = formatDate(frozenDate, 'long', 'en-US', 'UTC')
      expect(longEn).toBe('July 26, 2026')

      // Short format in en-GB (DD/MM/YYYY)
      const shortGb = formatDate(frozenDate, 'short', 'en-GB', 'UTC')
      expect(shortGb).toBe('26/07/2026')
    })

    it('remains_deterministic_regardless_of_host_timezone', () => {
      // Explicitly checking UTC timezone formatting
      const dateUtc = formatDate(frozenDate, 'medium', 'en-US', 'UTC')
      expect(dateUtc).toBe('Jul 26, 2026')
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Time Formatting
  // ---------------------------------------------------------------------------
  describe('Time Formatting', () => {
    const frozenTime = new Date('2026-07-26T14:05:09Z')

    it('formats_time_matching_cldr_12h_and_24h_conventions', () => {
      // 12-hour format (2:05:09 PM)
      const time12h = formatTime(frozenTime, '12h', 'en-US', 'UTC')
      expect(time12h).toMatch(/2:05:09[\s\u202f]?PM/)

      // 24-hour format (14:05:09)
      const time24h = formatTime(frozenTime, '24h', 'en-GB', 'UTC')
      expect(time24h).toBe('14:05:09')
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Percent Formatting
  // ---------------------------------------------------------------------------
  describe('Percent Formatting', () => {
    it('formats_percentages_according_to_cldr_locale_rules', () => {
      expect(formatPercent(0.75, 'en-US')).toBe('75%')
      expect(formatPercent(0, 'en-US')).toBe('0%')
      expect(formatPercent(0.1234, 'en-US', { maximumFractionDigits: 2 })).toBe('12.34%')
    })

    it('formats_negative_and_fractional_percentages_across_locales', () => {
      expect(formatPercent(-0.5, 'en-US')).toBe('-50%')
      const dePercent = formatPercent(0.75, 'de-DE')
      expect(dePercent).toMatch(/75[\s\u00a0]?%/)
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Relative Time Formatting
  // ---------------------------------------------------------------------------
  describe('Relative Time Formatting', () => {
    it('formats_relative_time_matching_cldr_conventions', () => {
      expect(formatRelativeTime(-1, 'day', 'en-US')).toBe('1 day ago')
      expect(formatRelativeTime(1, 'day', 'en-US')).toBe('in 1 day')
      expect(formatRelativeTime(-2, 'hour', 'en-US')).toBe('2 hours ago')
    })
  })

  // ---------------------------------------------------------------------------
  // 7. Locale Fallback
  // ---------------------------------------------------------------------------
  describe('Locale Fallback', () => {
    it('falls_back_to_default_locale_when_locale_is_unknown', () => {
      const invalidLocale = 'invalid-xyz-123'

      expect(isValidLocale(invalidLocale)).toBe(false)
      expect(getValidLocale(invalidLocale)).toBe(DEFAULT_LOCALE)

      // Must not throw, should fall back to en-US formatting
      expect(formatNumber(1234.5, invalidLocale)).toBe('1,234.5')
      expect(formatCurrency(100, 'USD', invalidLocale)).toBe('$100.00')
      expect(formatDate(new Date('2026-07-26T00:00:00Z'), 'medium', invalidLocale, 'UTC')).toBe(
        'Jul 26, 2026'
      )
    })

    it('handles_missing_or_null_locale_parameters_safely', () => {
      expect(formatNumber(1000, undefined)).toBe('1,000')
      expect(formatCurrency(50, 'USD', undefined)).toBe('$50.00')
    })
  })

  // ---------------------------------------------------------------------------
  // 8. Invalid Inputs & Failure Modes
  // ---------------------------------------------------------------------------
  describe('Invalid Inputs', () => {
    it('handles_invalid_inputs_gracefully_without_crashing', () => {
      // Invalid date input
      expect(formatDate('not-a-valid-date')).toBe('Invalid Date')
      expect(formatTime('not-a-valid-date')).toBe('Invalid Time')

      // Unsupported/malformed currency code fallback
      const result = formatCurrency(100, 'INVALID_CURRENCY_CODE', 'en-US')
      expect(result).toBe('100.00 INVALID_CURRENCY_CODE')
    })
  })

  // ---------------------------------------------------------------------------
  // 9. Property-based Invariants (Parametric table-driven)
  // ---------------------------------------------------------------------------
  describe('Property-based formatting invariants', () => {
    const testCases = [
      { num: 0, expectedEn: '0' },
      { num: 1.23, expectedEn: '1.23' },
      { num: 1000, expectedEn: '1,000' },
      { num: -50.5, expectedEn: '-50.5' },
      { num: 9999999.99, expectedEn: '9,999,999.99' },
    ]

    it.each(testCases)(
      'formatNumber($num, "en-US") produces deterministic output matching $expectedEn',
      ({ num, expectedEn }) => {
        expect(formatNumber(num, 'en-US')).toBe(expectedEn)
      }
    )

    const locales = ['en-US', 'de-DE', 'fr-FR', 'ja-JP', 'ar-EG']
    it.each(locales)('formatNumber never throws for locale %s', (locale) => {
      expect(() => formatNumber(12345.67, locale)).not.toThrow()
    })
  })
})
