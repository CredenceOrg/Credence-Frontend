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
});



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
