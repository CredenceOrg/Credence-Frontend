/**
 * @file format.ts
 * @description Shared formatting utilities for the Credence UI.
 *
 * All monetary display helpers live here so that Bond.tsx,
 * CreateBondFlow.tsx, and any future components share a single
 * implementation instead of forking ad-hoc copies.
 */

/**
 * Formats a numeric USDC amount for display.
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
