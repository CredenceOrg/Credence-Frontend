/**
 * @file stellar.ts
 * @description Shared Stellar address utilities for the Credence UI.
 *
 * This is the single source of truth for Stellar address validation
 * and formatting across all components.
 */

// Base32 alphabet used by Stellar StrKey (RFC 4648, uppercase, no padding)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** Decode a Base32 string into a Uint8Array. Returns null on invalid input. */
function base32Decode(input: string): Uint8Array | null {
  // Must be a multiple of 8 chars when padded; Stellar uses 56-char keys (35 bytes → 56 chars, no padding needed)
  const lookup: Record<string, number> = {}
  for (let i = 0; i < BASE32_ALPHABET.length; i++) lookup[BASE32_ALPHABET[i]] = i

  let bits = 0
  let value = 0
  const output: number[] = []

  for (const char of input) {
    if (!(char in lookup)) return null
    value = (value << 5) | lookup[char]
    bits += 5
    if (bits >= 8) {
      bits -= 8
      output.push((value >> bits) & 0xff)
    }
  }

  return new Uint8Array(output)
}

/** CRC-16/XMODEM over the given bytes (polynomial 0x1021, init 0x0000). */
function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0x0000
  for (const byte of bytes) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc
}

/**
 * Validates Stellar public key format and CRC-16 checksum.
 *
 * Valid addresses: 56 characters, starts with 'G', contain only
 * uppercase letters A-Z and digits 0-9, and pass the StrKey CRC-16 XMODEM checksum.
 *
 * @example
 * isValidStellarAddress('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H') // → true
 * isValidStellarAddress('invalid') // → false
 * isValidStellarAddress('') // → false
 * isValidStellarAddress(undefined) // → false
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function decodeBase32(input: string): Uint8Array | null {
  const cleaned = input.toUpperCase().replace(/=+$/, '')
  if (!/^[A-Z2-7]*$/.test(cleaned)) {
    return null
  }

  const length = cleaned.length
  const bytes = new Uint8Array(Math.floor((length * 5) / 8))
  let bits = 0
  let value = 0
  let index = 0

  for (let i = 0; i < length; i++) {
    const char = cleaned[i]
    const val = ALPHABET.indexOf(char)
    if (val === -1) return null

    value = (value << 5) | val
    bits += 5

    if (bits >= 8) {
      bytes[index++] = (value >>> (bits - 8)) & 255
      bits -= 8
      value &= (1 << bits) - 1
    }
  }

  return bytes
}

function calculateCRC16(data: Uint8Array): number {
  const polynomial = 0x1021
  let crc = 0x0000

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ polynomial : crc << 1
    }
  }
  return crc & 0xffff
}

function verifyChecksum(address: string): boolean {
  if (address.length !== 56 || address[0] !== 'G') {
    return false
  }
  const bytes = decodeBase32(address)
  if (!bytes || bytes.length !== 35) {
    return false
  }

  const payload = bytes.slice(0, 33)
  const checksumBytes = bytes.slice(33, 35)
  const calculatedChecksum = calculateCRC16(payload)

  const expectedChecksum = checksumBytes[0] | (checksumBytes[1] << 8)
  return calculatedChecksum === expectedChecksum
}

export function isValidStellarAddress(address: string | undefined | null): boolean {
  if (!address) return false
  // Stellar addresses are 56 characters and start with 'G', followed by 55 uppercase alphanumeric chars
  if (!/^G[A-Z0-9]{55}$/.test(address)) {
    return false
  }
  // Additionally verify the StrKey CRC-16 XMODEM checksum
  return verifyChecksum(address)
}

/**
 * Truncates address for display: shows first 12 and last 8 characters.
 *
 * Preserves short addresses unchanged. Returns empty string for empty input.
 * Handles undefined/null values gracefully. Trims whitespace.
 *
 * @example
 * truncateAddress('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H')
 * // → "GBRPYHIL2CI3...X2H"
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

/**
 * The set of display modes for a Stellar address.
 *
 * - `full`     — the complete 56-character key (e.g. for copy confirmations)
 * - `short`    — truncated form: first 12 + "..." + last 8 characters (default)
 * - `friendly` — very short label: first 6 + "…" + last 4 characters
 */
export type AddressDisplayMode = 'full' | 'short' | 'friendly'

/**
 * Formats a Stellar address for display according to the requested mode.
 *
 * Falls back to `short` for unknown / undefined modes. Returns an empty
 * string for empty / null / undefined input so callers don't need to guard.
 *
 * @example
 * const addr = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
 * formatAddressForDisplay(addr, 'full')     // → 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
 * formatAddressForDisplay(addr, 'short')    // → 'GBRPYHIL2CI3...X2H'     (first 12 + last 8)
 * formatAddressForDisplay(addr, 'friendly') // → 'GBRPYH…X2H' (first 6 + last 4, with '…')
 */
export function formatAddressForDisplay(
  address: string | undefined | null,
  mode: AddressDisplayMode | string | undefined
): string {
  if (!address) return ''
  const trimmed = address.trim()
  if (!trimmed) return ''

  switch (mode) {
    case 'full':
      return trimmed
    case 'friendly': {
      if (trimmed.length <= 10) return trimmed
      return `${trimmed.substring(0, 6)}\u2026${trimmed.substring(trimmed.length - 4)}`
    }
    case 'short':
    default:
      return truncateAddress(trimmed)
  }
}

export type AddressSanitizationError = {
  type: 'SUSPICIOUS_CHARACTERS'
  message: string
}

export type AddressSanitizationResult =
  | { ok: true; value: string }
  | { ok: false; error: AddressSanitizationError; fallbackValue: string }

/**
 * Sanitizes an input string intended to be a Stellar address.
 * Strips whitespace, common prefixes like 'stellar:', and detects suspicious characters.
 */
export function sanitizeAddressInput(input: string): AddressSanitizationResult {
  let sanitized = input.trim()

  if (sanitized.toLowerCase().startsWith('stellar:')) {
    sanitized = sanitized.slice(8)
  }

  // Detect non-ASCII printable characters (common in homograph/injection attacks)
  if (/[^\x20-\x7E]/.test(sanitized)) {
    return {
      ok: false,
      error: {
        type: 'SUSPICIOUS_CHARACTERS',
        message: 'Suspicious characters detected in address.',
      },
      fallbackValue: sanitized,
    }
  }

  return { ok: true, value: sanitized }
}
