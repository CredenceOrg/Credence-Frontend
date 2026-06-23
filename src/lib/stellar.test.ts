import { describe, it, expect } from 'vitest'
import { isValidStellarAddress, truncateAddress } from './stellar'

// A valid 56-character Stellar public key
const VALID_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA' // 56 chars

describe('isValidStellarAddress', () => {
  it('returns true for valid Stellar public keys', () => {
    expect(isValidStellarAddress(VALID_KEY)).toBe(true)
    // Another valid key
    expect(isValidStellarAddress('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H')).toBe(true)
  })

  it('returns false for empty strings', () => {
    expect(isValidStellarAddress('')).toBe(false)
    expect(isValidStellarAddress('   ')).toBe(false)
  })

  it('returns false for undefined/null', () => {
    expect(isValidStellarAddress(undefined)).toBe(false)
    expect(isValidStellarAddress(null)).toBe(false)
  })

  it('returns false for malformed keys', () => {
    // Wrong prefix
    expect(isValidStellarAddress('SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(false)
    // Too short
    expect(isValidStellarAddress('GABC')).toBe(false)
    // Too long
    expect(isValidStellarAddress(VALID_KEY + 'EXTRA')).toBe(false)
    // Invalid characters
    expect(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNa')).toBe(false) // lowercase
    expect(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN!')).toBe(false) // special char
  })

  it('returns false for wrong prefix', () => {
    expect(isValidStellarAddress('TAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(false)
    expect(isValidStellarAddress('MAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(false)
  })

  it('returns false for short keys', () => {
    expect(isValidStellarAddress('G')).toBe(false)
    expect(isValidStellarAddress('GA')).toBe(false)
    expect(isValidStellarAddress('GAAZI4TCR3TY')).toBe(false)
  })

  it('returns false for random text', () => {
    expect(isValidStellarAddress('hello world')).toBe(false)
    expect(isValidStellarAddress('1234567890')).toBe(false)
    expect(isValidStellarAddress('G123')).toBe(false)
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
