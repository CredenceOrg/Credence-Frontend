import { describe, it, expect } from 'vitest'
import { validateIban, IbanErrorCode } from './iban'

describe('validateIban', () => {
  it('returns valid for a correct IBAN', () => {
    // Valid German IBAN (example)
    const result = validateIban('DE89370400440532013000')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('handles spaces and dashes gracefully', () => {
    const result = validateIban('DE89 3704 0044 0532 0130 00')
    expect(result.valid).toBe(true)
  })

  it('rejects an IBAN that is too short', () => {
    const result = validateIban('DE89')
    expect(result.valid).toBe(false)
    expect(result.error).toBe(IbanErrorCode.INVALID_LENGTH)
  })

  it('rejects an IBAN with an invalid country code', () => {
    const result = validateIban('1289370400440532013000')
    expect(result.valid).toBe(false)
    expect(result.error).toBe(IbanErrorCode.INVALID_COUNTRY_CODE)
  })

  it('rejects an IBAN with invalid characters', () => {
    const result = validateIban('DE893704004405320130!@')
    expect(result.valid).toBe(false)
    expect(result.error).toBe(IbanErrorCode.INVALID_FORMAT)
  })

  it('rejects an IBAN with an incorrect checksum', () => {
    // Modified the first digit after the country code to invalidate the checksum
    const result = validateIban('DE99370400440532013000')
    expect(result.valid).toBe(false)
    expect(result.error).toBe(IbanErrorCode.INVALID_CHECKSUM)
  })
})
