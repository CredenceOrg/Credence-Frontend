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
 * Validates a Stellar public key (Ed25519 / account ID) using full StrKey
 * checksum verification.
 *
 * Checks:
 * 1. Non-empty, 56-character, starts with 'G', valid Base32 charset.
 * 2. Version byte = 0x30 (public key / mainnet account).
 * 3. CRC-16/XMODEM checksum over [version, ...key_bytes] matches the
 *    two trailing bytes in the decoded payload.
 *
 * @example
 * isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7') // → true
 * isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA') // → false (bad checksum)
 * isValidStellarAddress('SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA') // → false (secret key)
 * isValidStellarAddress('') // → false
 * isValidStellarAddress(undefined) // → false
 */
export function isValidStellarAddress(address: string | undefined | null): boolean {
  if (!address) return false
  // Quick structural check: 56 chars, starts with G, valid Base32 charset
  if (!/^G[A-Z2-7]{55}$/.test(address)) return false

  const decoded = base32Decode(address)
  // A 56-char Base32 string decodes to 35 bytes: 1 version + 32 key + 2 checksum
  if (!decoded || decoded.length !== 35) return false

  // Version byte for Ed25519 public key (account ID) must be 0x30
  if (decoded[0] !== 0x30) return false

  const payload = decoded.slice(0, 33) // version + 32 key bytes
  const checksumBytes = decoded.slice(33) // last 2 bytes
  const storedChecksum = (checksumBytes[1] << 8) | checksumBytes[0] // little-endian
  const computedChecksum = crc16xmodem(payload)

  return storedChecksum === computedChecksum
}

/**
 * Truncates address for display: shows first 12 and last 8 characters.
 * 
 * Preserves short addresses unchanged. Returns empty string for empty input.
 * Handles undefined/null values gracefully. Trims whitespace.
 * 
 * @example
 * truncateAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7')
 * // → "GAAZI4TCR3TY...CCWN7"
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
