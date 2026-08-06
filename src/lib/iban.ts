export enum IbanErrorCode {
  INVALID_LENGTH = 'INVALID_LENGTH',
  INVALID_COUNTRY_CODE = 'INVALID_COUNTRY_CODE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_CHECKSUM = 'INVALID_CHECKSUM',
}

export interface IbanValidationResult {
  valid: boolean
  error?: IbanErrorCode
}

/**
 * Validates an International Bank Account Number (IBAN).
 *
 * @param iban - The IBAN string to validate.
 * @returns A structured validation result with an error code if invalid.
 */
export function validateIban(iban: string): IbanValidationResult {
  const sanitized = iban.replace(/[\s-]+/g, '').toUpperCase()

  // Basic length check (shortest is Norway 15, longest is 34)
  if (sanitized.length < 15 || sanitized.length > 34) {
    return { valid: false, error: IbanErrorCode.INVALID_LENGTH }
  }

  const countryCode = sanitized.substring(0, 2)
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return { valid: false, error: IbanErrorCode.INVALID_COUNTRY_CODE }
  }

  // Check if it contains only alphanumeric characters
  if (!/^[A-Z0-9]+$/.test(sanitized)) {
    return { valid: false, error: IbanErrorCode.INVALID_FORMAT }
  }

  // Modulo 97 checksum validation
  const rearranged = sanitized.substring(4) + sanitized.substring(0, 4)
  const numeric = rearranged
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      // Convert letters to numbers (A=10, B=11, ..., Z=35)
      return code >= 65 && code <= 90 ? (code - 55).toString() : char
    })
    .join('')

  // Compute modulo 97 on the large numeric string
  let remainder = numeric
  let block: string
  while (remainder.length > 2) {
    block = remainder.substring(0, 9)
    remainder = (parseInt(block, 10) % 97).toString() + remainder.substring(block.length)
  }

  if (parseInt(remainder, 10) % 97 !== 1) {
    return { valid: false, error: IbanErrorCode.INVALID_CHECKSUM }
  }

  return { valid: true }
}

/**
 * Structured error thrown by {@link validateIbanRequest} when the IBAN fails
 * validation at the API boundary. Carries a typed {@link code} that callers
 * can narrow on instead of parsing a stringly-typed message.
 */
export class IbanValidationError extends Error {
  readonly code: IbanErrorCode

  constructor(code: IbanErrorCode, message: string) {
    super(message)
    this.name = 'IbanValidationError'
    this.code = code
  }
}

/**
 * Boundary-safe IBAN validation.
 *
 * Sanitizes the input (strips separators, uppercases), runs the full
 * validation chain, and returns the sanitized IBAN when valid. When the
 * IBAN is invalid, throws a structured {@link IbanValidationError} with a
 * typed {@link IbanErrorCode} so callers can handle each failure mode
 * explicitly.
 *
 * Use this at the API boundary / form-submission point — never deep inside
 * the call graph — to reject bad input early with a structured error.
 *
 * @param iban - Raw IBAN string (may contain spaces, dashes, mixed case).
 * @returns The sanitized, uppercase, separator-free IBAN.
 * @throws {IbanValidationError} If the IBAN fails any validation check.
 */
export function validateIbanRequest(iban: string): string {
  const result = validateIban(iban)
  if (!result.valid && result.error) {
    throw new IbanValidationError(
      result.error,
      `Invalid IBAN: ${result.error}`,
    )
  }
  // Return the sanitized value so callers don't have to re-sanitize
  return iban.replace(/[\s-]+/g, '').toUpperCase()
}
