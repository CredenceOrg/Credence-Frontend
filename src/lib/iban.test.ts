import { describe, it, expect } from 'vitest'
import { validateIban, IbanErrorCode, validateIbanRequest, IbanValidationError } from './iban'

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

describe('IbanValidationError', () => {
  it('carries the typed error code and name', () => {
    const err = new IbanValidationError(IbanErrorCode.INVALID_LENGTH, 'too short')
    expect(err.code).toBe(IbanErrorCode.INVALID_LENGTH)
    expect(err.message).toBe('too short')
    expect(err.name).toBe('IbanValidationError')
  })
})

describe('validateIbanRequest', () => {
  it('returns the sanitized IBAN for valid input', () => {
    const result = validateIbanRequest('DE89 3704 0044 0532 0130 00')
    expect(result).toBe('DE89370400440532013000')
  })

  it('throws IbanValidationError for an invalid length', () => {
    expect(() => validateIbanRequest('DE89')).toThrow(IbanValidationError)
    try {
      validateIbanRequest('DE89')
    } catch (err) {
      expect(err).toBeInstanceOf(IbanValidationError)
      expect((err as IbanValidationError).code).toBe(IbanErrorCode.INVALID_LENGTH)
    }
  })

  it('throws IbanValidationError for an invalid country code', () => {
    expect(() => validateIbanRequest('1289370400440532013000')).toThrow(IbanValidationError)
    try {
      validateIbanRequest('1289370400440532013000')
    } catch (err) {
      expect((err as IbanValidationError).code).toBe(IbanErrorCode.INVALID_COUNTRY_CODE)
    }
  })

  it('throws IbanValidationError for invalid characters', () => {
    expect(() => validateIbanRequest('DE893704004405320130!@')).toThrow(IbanValidationError)
    try {
      validateIbanRequest('DE893704004405320130!@')
    } catch (err) {
      expect((err as IbanValidationError).code).toBe(IbanErrorCode.INVALID_FORMAT)
    }
  })

  it('throws IbanValidationError for an incorrect checksum', () => {
    expect(() => validateIbanRequest('DE99370400440532013000')).toThrow(IbanValidationError)
    try {
      validateIbanRequest('DE99370400440532013000')
    } catch (err) {
      expect((err as IbanValidationError).code).toBe(IbanErrorCode.INVALID_CHECKSUM)
    }
  })
})
