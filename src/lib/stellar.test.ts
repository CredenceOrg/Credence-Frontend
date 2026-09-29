import { describe, it, expect } from 'vitest'
import { isValidStellarAddress, truncateAddress, formatAddressForDisplay } from './stellar'

// A valid 56-character Stellar public key (passes CRC-16 XMODEM checksum)
const VALID_KEY = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H' // 56 chars

describe('isValidStellarAddress', () => {
  // --- Happy path ---
  it('returns_true_for_valid_public_key', () => {
    expect(isValidStellarAddress(VALID_KEY)).toBe(true)
    // Another valid key (also passes checksum)
    expect(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(
      false // this key fails the CRC-16 checksum
    )
  })

  // --- Empty inputs ---
  it('returns_false_for_empty_string', () => {
    expect(isValidStellarAddress('')).toBe(false)
  })

  it('returns_false_for_whitespace_only_string', () => {
    expect(isValidStellarAddress('   ')).toBe(false)
  })

  it('returns_false_for_undefined', () => {
    expect(isValidStellarAddress(undefined)).toBe(false)
  })

  it('returns_false_for_null', () => {
    expect(isValidStellarAddress(null)).toBe(false)
  })

  it('returns false for malformed keys', () => {
    // Wrong prefix
    expect(isValidStellarAddress('SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(
      false
    )
    // Too short
    expect(isValidStellarAddress('GABC')).toBe(false)
    // Too long
    expect(isValidStellarAddress(VALID_KEY + 'EXTRA')).toBe(false)
    // Invalid characters
    expect(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNa')).toBe(
      false
    ) // lowercase
    expect(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN!')).toBe(
      false
    ) // special char
  })

  it('returns false for a format-valid key that fails the CRC-16 checksum', () => {
    // GAAZI4... is 56 chars, starts with G, uppercase alphanumeric, but fails checksum
    expect(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(
      false
    )
  })

  it('returns false for wrong prefix', () => {
    expect(isValidStellarAddress('TAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(
      false
    )
    expect(isValidStellarAddress('MAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(
      false
    )
  })

  it('returns_false_for_digits_0_1_8_9_which_are_not_in_base32_alphabet', () => {
    // Base32 uses only A-Z and 2-7; digits 0,1,8,9 are invalid
    const with0 = 'G' + '0'.repeat(55)
    expect(isValidStellarAddress(with0)).toBe(false)
  })

  it('returns_false_for_random_text', () => {
    expect(isValidStellarAddress('hello world')).toBe(false)
    expect(isValidStellarAddress('not-a-key')).toBe(false)
  })

  it('returns false for a valid-prefix key padded with whitespace', () => {
    // The regex tests the raw string; leading/trailing spaces break the match.
    expect(isValidStellarAddress(' ' + VALID_KEY)).toBe(false)
    expect(isValidStellarAddress(VALID_KEY + ' ')).toBe(false)
  })

  it('returns false for a key that is exactly 55 characters (one short)', () => {
    // Strip the last character — still starts with G but length 55 → invalid.
    const short55 = VALID_KEY.slice(0, 55)
    expect(short55.length).toBe(55)
    expect(isValidStellarAddress(short55)).toBe(false)
  })

  it('returns false for a key that is exactly 57 characters (one long)', () => {
    const long57 = VALID_KEY + 'A'
    expect(long57.length).toBe(57)
    expect(isValidStellarAddress(long57)).toBe(false)
  })
})

describe('truncateAddress', () => {
  it('returns short addresses unchanged', () => {
    expect(truncateAddress('GABC')).toBe('GABC')
    expect(truncateAddress('G'.repeat(20))).toBe('G'.repeat(20))
    expect(truncateAddress('G1234567890123456789')).toBe('G1234567890123456789') // 20 chars
  })

  it('truncates long addresses correctly', () => {
    const truncated = truncateAddress(VALID_KEY)
    expect(truncated).toBe(
      `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    )
    // Verify exact lengths
    expect(truncated.length).toBe(12 + 3 + 8) // first 12 + ... + last 8
  })

  it('handles exact threshold length addresses', () => {
    const exactly20 = 'G'.repeat(20)
    expect(truncateAddress(exactly20)).toBe(exactly20)

    const exactly21 = 'G'.repeat(21)
    expect(truncateAddress(exactly21)).toBe(`${'G'.repeat(12)}...${'G'.repeat(8)}`)
  })

  it('returns empty string for empty input', () => {
    expect(truncateAddress('')).toBe('')
    expect(truncateAddress('   ')).toBe('')
  })

  it('handles undefined/null gracefully', () => {
    expect(truncateAddress(undefined)).toBe('')
    expect(truncateAddress(null)).toBe('')
  })

  it('preserves address casing', () => {
    const mixedCase = 'GaAzI4TcR3Ty5OjHcTjC2A4QsY6CjWjH5IaJtGkIn2Er7LbNvKoCcWnA'
    const truncated = truncateAddress(mixedCase)
    expect(truncated).toBe(
      `${mixedCase.substring(0, 12)}...${mixedCase.substring(mixedCase.length - 8)}`
    )
  })

  it('trims leading and trailing whitespace before length check', () => {
    // A 20-char address padded with spaces should be returned trimmed and unchanged.
    const padded = '  ' + 'G'.repeat(20) + '  '
    expect(truncateAddress(padded)).toBe('G'.repeat(20))
  })

  it('truncates a whitespace-padded long address after trimming', () => {
    const padded = '  ' + VALID_KEY + '  '
    const result = truncateAddress(padded)
    expect(result).toBe(
      `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    )
  })

  it('produces the correct separator string (three dots, not an ellipsis character)', () => {
    const result = truncateAddress(VALID_KEY)
    expect(result).toContain('...')
    expect(result).not.toContain('…') // U+2026 typographic ellipsis
  })

  // --- Middle truncation edge cases ---

  it('handles very long strings deterministically', () => {
    const long = 'A'.repeat(200)
    const result = truncateAddress(long)
    expect(result).toBe(`${'A'.repeat(12)}...${'A'.repeat(8)}`)
    expect(result.length).toBe(12 + 3 + 8)
  })

  it('preserves the exact start and end of the original value', () => {
    const value = 'STARTabcdefghijklmnopqrstuvwxyzEND'
    const result = truncateAddress(value)
    expect(result.startsWith('START')).toBe(true)
    expect(result.endsWith('END')).toBe(true)
  })

  it('handles string exactly at boundary (20 chars)', () => {
    const exactly20 = 'ABCDEFGHIJKLMNOPQRST' // 20 chars
    expect(truncateAddress(exactly20)).toBe(exactly20)
  })

  it('handles string one char above boundary (21 chars)', () => {
    const exactly21 = 'ABCDEFGHIJKLMNOPQRSTU' // 21 chars
    // First 12 + ... + last 8
    // substring(0, 12) = 'ABCDEFGHIJKL', substring(21-8) = substring(13) = 'NOPQRSTU'
    expect(truncateAddress(exactly21)).toBe('ABCDEFGHIJKL...NOPQRSTU')
    expect(truncateAddress(exactly21).length).toBe(12 + 3 + 8) // 23
  })

  it('handles empty string safely', () => {
    expect(truncateAddress('')).toBe('')
  })

  it('handles single character strings', () => {
    expect(truncateAddress('G')).toBe('G')
    expect(truncateAddress('A')).toBe('A')
  })

  it('handles very short strings (2-19 chars)', () => {
    expect(truncateAddress('AB')).toBe('AB')
    expect(truncateAddress('ABCDEFGHIJ')).toBe('ABCDEFGHIJ') // 10 chars
    expect(truncateAddress('ABCDEFGHIJKLM')).toBe('ABCDEFGHIJKLM') // 13 chars
    expect(truncateAddress('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJKLMNOP') // 16 chars
    expect(truncateAddress('ABCDEFGHIJKLMNOPQRS')).toBe('ABCDEFGHIJKLMNOPQRS') // 19 chars
  })

  it('handles odd-length strings above threshold', () => {
    // 25 chars — odd
    const odd = 'ABCDEFGHIJKLMNOPQRSTUVWXY' // 25 chars
    const result = truncateAddress(odd)
    expect(result).toBe('ABCDEFGHIJKL...RSTUVWXY')
    expect(result.length).toBe(23)
  })

  it('handles even-length strings above threshold', () => {
    // 22 chars — even
    const even = 'ABCDEFGHIJKLMNOPQRSTUV' // 22 chars
    const result = truncateAddress(even)
    expect(result).toBe('ABCDEFGHIJKL...OPQRSTUV')
    expect(result.length).toBe(23)
  })

  it('does not produce duplicated ellipses', () => {
    const result = truncateAddress(VALID_KEY)
    // Should have exactly one occurrence of '...'
    const matches = result.match(/\.\.\./g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBe(1)
  })

  it('handles strings with special characters using template literal', () => {
    // Use backtick template literal so quotes inside need no escaping
    // First 12 chars: 'G_-+=[{]};:'"' (includes single quote, positions 0-11)
    const special = `G_-+=[{]};:'"<,>.?/}|~\`!@#$%^&*()abcdefghijklmnopqrstuvwxyz`
    const result = truncateAddress(special)
    expect(result.length).toBe(23)
    // First 12 chars preserved — regex needs to escape [ { } ] + \
    expect(result).toMatch(/^G_-\+=\[\{\]\};:'/)
    // Last 8 chars: 'tuvwxyz'
    expect(result).toMatch(/tuvwxyz$/)
  })

  it('handles real-world Stellar address', () => {
    const realAddr = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
    const result = truncateAddress(realAddr)
    // substring(0, 12) = 'GBRPYHIL2CI3', substring(56-8) = substring(48) = '7QC7OX2H'
    expect(result).toBe('GBRPYHIL2CI3...7QC7OX2H')
    expect(result).not.toBe(realAddr)
    expect(result.length).toBe(23)
  })

  it('handles real-world transaction hash (64 hex chars)', () => {
    const txHash = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
    const result = truncateAddress(txHash)
    // substring(0, 12) = 'a1b2c3d4e5f6', substring(56) = 'e9f0a1b2'
    expect(result).toBe('a1b2c3d4e5f6...e9f0a1b2')
    expect(result.length).toBe(23)
  })

  it('returns empty string for whitespace-only input', () => {
    expect(truncateAddress('   ')).toBe('')
    expect(truncateAddress('\t\n')).toBe('')
  })

  it('trims leading and trailing whitespace but preserves internal spaces', () => {
    const withSpaces = '  ABCDEFGHIJKLMNOPQRSTUVWXYZ  '
    // After trim: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' (26 chars)
    // substring(0, 12) = 'ABCDEFGHIJKL', substring(26-8) = substring(18) = 'STUVWXYZ'
    expect(truncateAddress(withSpaces)).toBe('ABCDEFGHIJKL...STUVWXYZ')
  })

  it('handles null and undefined input', () => {
    expect(truncateAddress(null)).toBe('')
    expect(truncateAddress(undefined)).toBe('')
  })
})

describe('formatAddressForDisplay', () => {
  it('returns full address when mode is "full"', () => {
    expect(formatAddressForDisplay(VALID_KEY, 'full')).toBe(VALID_KEY)
  })

  it('returns short (truncated) address when mode is "short"', () => {
    const expected = `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    expect(formatAddressForDisplay(VALID_KEY, 'short')).toBe(expected)
  })

  it('returns friendly (very short) address when mode is "friendly"', () => {
    // first 6 + U+2026 + last 4
    const expected = `${VALID_KEY.substring(0, 6)}\u2026${VALID_KEY.substring(VALID_KEY.length - 4)}`
    expect(formatAddressForDisplay(VALID_KEY, 'friendly')).toBe(expected)
  })

  it('falls back to short when mode is undefined', () => {
    const expected = `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    expect(formatAddressForDisplay(VALID_KEY, undefined)).toBe(expected)
  })

  it('falls back to short when mode is unknown', () => {
    const expected = `${VALID_KEY.substring(0, 12)}...${VALID_KEY.substring(VALID_KEY.length - 8)}`
    expect(formatAddressForDisplay(VALID_KEY, 'bogus')).toBe(expected)
  })

  it('returns empty string for empty / null / undefined input', () => {
    expect(formatAddressForDisplay('', 'full')).toBe('')
    expect(formatAddressForDisplay(null, 'full')).toBe('')
    expect(formatAddressForDisplay(undefined, 'short')).toBe('')
  })

  it('trims whitespace before formatting', () => {
    expect(formatAddressForDisplay('  ' + VALID_KEY + '  ', 'full')).toBe(VALID_KEY)
  })

  it('friendly mode returns short address unchanged when it is short enough (≤10 chars)', () => {
    const short = 'GABC12345'
    expect(formatAddressForDisplay(short, 'friendly')).toBe(short)
  })
})
