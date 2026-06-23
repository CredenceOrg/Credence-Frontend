/**
 * @file stellar.ts
 * @description Shared Stellar address utilities for the Credence UI.
 *
 * This is the single source of truth for Stellar address validation
 * and formatting across all components.
 */

/**
 * Validates Stellar public key format.
 * 
 * Valid addresses: 56 characters, starts with 'G', contains only
 * uppercase letters A-Z and digits 0-9.
 * 
 * @example
 * isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA') // → true
 * isValidStellarAddress('invalid') // → false
 * isValidStellarAddress('') // → false
 * isValidStellarAddress(undefined) // → false
 */
export function isValidStellarAddress(address: string | undefined | null): boolean {
  if (!address) return false
  // Stellar addresses are 56 characters and start with 'G'
  return /^G[A-Z0-9]{55}$/.test(address)
}

/**
 * Truncates address for display: shows first 12 and last 8 characters.
 * 
 * Preserves short addresses unchanged. Returns empty string for empty input.
 * Handles undefined/null values gracefully. Trims whitespace.
 * 
 * @example
 * truncateAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')
 * // → "GAAZI4TCR3TY...CCWNA"
 * truncateAddress('GABC') // → "GABC"
 * truncateAddress('') // → ""
 * truncateAddress('   ') // → ""
 */
export function truncateAddress(address: string | undefined | null): string {
  if (!address) return ''
  const trimmed = address.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 20) return trimmed
  return `${trimmed.substring(0, 12)}...${trimmed.substring(trimmed.length - 8)}`
}
