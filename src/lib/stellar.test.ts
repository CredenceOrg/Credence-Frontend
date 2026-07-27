import { describe, it, expect } from 'vitest'
import { isValidStellarAddress, truncateAddress } from './stellar'

// A valid 56-character Stellar public key (Ed25519 account ID, correct checksum)
const VALID_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7' // 56 chars, correct CRC-16 checksum

// Same key bytes but with the last Base32 character mutated — checksum is wrong
const BAD_CHECKSUM_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'

// A Stellar secret key (version byte 0x90 / 'S' prefix) — wrong network type
const SECRET_KEY = 'SCZANGBA5RLMQ4DQTNU37XHNG3TZKXNZYHFNFZSL3IQKZJNMQKZXNQR'

describe('isValidStellarAddress', () => {
  // --- Happy path ---
  it('returns_true_for_valid_public_key', () => {
    expect(isValidStellarAddress(VALID_KEY)).toBe(true)
  })

  it('returns_true_for_second_known_valid_key', () => {
    expect(isValidStellarAddress('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H')).toBe(true)
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

  // --- Invalid checksum ---
  it('returns_false_when_last_character_is_mutated_causing_bad_checksum', () => {
    // BAD_CHECKSUM_KEY has the same key bytes as VALID_KEY but the final Base32
    // character is different, so the decoded checksum bytes no longer match.
    expect(isValidStellarAddress(BAD_CHECKSUM_KEY)).toBe(false)
  })

  it('returns_false_for_all_G_address_with_invalid_checksum', () => {
    // 56 G's passes the structural regex but has a wrong checksum
    expect(isValidStellarAddress('G'.repeat(56))).toBe(false)
  })

  it('returns_false_for_structurally_valid_looking_key_with_wrong_checksum', () => {
    // Replace the last 4 chars (checksum region) with 'AAAA' — almost certainly wrong
    const corrupted = VALID_KEY.slice(0, 52) + 'AAAA'
    expect(isValidStellarAddress(corrupted)).toBe(false)
  })

  // --- Wrong network / key type ---
  it('returns_false_for_stellar_secret_key_S_prefix', () => {
    // Secret keys start with 'S' (version byte 0x90) — wrong type for an account address
    expect(isValidStellarAddress(SECRET_KEY)).toBe(false)
  })

  it('returns_false_for_T_prefix_which_is_not_a_valid_account_address', () => {
    const tKey = 'T' + VALID_KEY.slice(1)
    expect(isValidStellarAddress(tKey)).toBe(false)
  })

  it('returns_false_for_M_prefix_muxed_account_address', () => {
    // Muxed accounts start with 'M' — not a plain Ed25519 public key
    const mKey = 'M' + VALID_KEY.slice(1)
    expect(isValidStellarAddress(mKey)).toBe(false)
  })

  // --- Structural failures ---
  it('returns_false_for_key_that_is_too_short', () => {
    expect(isValidStellarAddress('GABC')).toBe(false)
    expect(isValidStellarAddress(VALID_KEY.slice(0, 55))).toBe(false)
  })

  it('returns_false_for_key_that_is_too_long', () => {
    expect(isValidStellarAddress(VALID_KEY + 'A')).toBe(false)
  })

  it('returns_false_for_lowercase_characters', () => {
    expect(isValidStellarAddress(VALID_KEY.toLowerCase())).toBe(false)
  })

  it('returns_false_for_key_containing_special_characters', () => {
    expect(isValidStellarAddress(VALID_KEY.slice(0, 55) + '!')).toBe(false)
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
    expect(truncated).toBe(`${mixedCase.substring(0, 12)}...${mixedCase.substring(mixedCase.length - 8)}`)
  })
})
