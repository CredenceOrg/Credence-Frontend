/**
 * @file amount.ts
 * @description Exact decimal amount parsing, validation, and canonical
 * serialization for the Credence API boundary.
 *
 * Money must never travel through IEEE-754 floating-point arithmetic on its
 * way to the wire. See docs/AMOUNT_PRECISION.md for the full design.
 *
 * @see docs/AMOUNT_PRECISION.md
 */

/**
 * Maximum value of a signed 64-bit integer.
 */
export const MAX_INT64 = 9223372036854775807n

/**
 * Decimal places of the canonical USDC wire format used by this app.
 */
export const USDC_SCALE = 2

/** Highest scale accepted by {@link resolveAmountRules}. */
export const MAX_SCALE = 18

/** Machine-readable reason an amount was rejected. */
export type AmountErrorCode =
  | 'INVALID_RULES'
  | 'INVALID_TYPE'
  | 'EMPTY'
  | 'INVALID_FORMAT'
  | 'NOT_FINITE'
  | 'NEGATIVE'
  | 'INVALID_SCALE'
  | 'BELOW_MIN'
  | 'OVERFLOW'

/**
 * Thrown when a value violates one of the exact-decimal rules.
 */
export class AmountError extends Error {
  /** Machine-readable rejection reason. */
  readonly code: AmountErrorCode

  constructor(code: AmountErrorCode, message: string) {
    super(message)
    this.name = 'AmountError'
    this.code = code
  }
}

/** Caller-tunable validation rules for a decimal amount. */
export interface AmountRules {
  /** Maximum number of fractional digits. @default USDC_SCALE */
  scale?: number
  /** Inclusive lower bound. @default '0' */
  min?: string | number | bigint
  /** Inclusive upper bound. @default int64 bound */
  max?: string | number | bigint
}

/** {@link AmountRules} fully validated and resolved to `BigInt` bounds. */
export interface ResolvedAmountRules {
  readonly scale: number
  readonly minScaled: bigint
  readonly maxScaled: bigint
}

const DEFAULT_RULES: ResolvedAmountRules = {
  scale: USDC_SCALE,
  minScaled: 0n,
  maxScaled: MAX_INT64,
}

/** Matches the plain unsigned decimal grammar accepted at this boundary. */
const PLAIN_DECIMAL = /^\d+(\.\d+)?$/

/** Matches the same grammar with an explicit minus sign. */
const NEGATIVE_DECIMAL = /^-\d+(\.\d+)?$/

/** Matches the same grammar with an explicit plus sign. */
const PLUS_DECIMAL = /^\+\d+(\.\d+)?$/

/** Matches the two non-exponent shapes `String(number)` can produce. */
const EXPONENTIAL_NUMBER = /^(\d+)(?:\.(\d+))?e([+-]?\d+)$/i

/** Truncates long raw values in error messages to keep them log-safe. */
function previewText(value: unknown, max = 40): string {
  if (typeof value === 'string') {
    return JSON.stringify(value.length > max ? `${value.slice(0, max)}...` : value)
  }
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'number') return String(value)
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'object') return 'an object'
  return `a value of type ${typeof value}`
}

/**
 * Converts an accepted input type into a plain unsigned decimal string.
 */
function toDecimalString(value: string | number | bigint): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      throw new AmountError('EMPTY', `Amount is an empty or whitespace-only string.`)
    }
    if (PLAIN_DECIMAL.test(trimmed)) return trimmed
    if (NEGATIVE_DECIMAL.test(trimmed)) {
      throw new AmountError(
        'NEGATIVE',
        `Amount must not be negative (got ${previewText(trimmed)}).`
      )
    }
    if (PLUS_DECIMAL.test(trimmed)) {
      throw new AmountError(
        'INVALID_FORMAT',
        `Amount must be a plain unsigned decimal without a leading '+' (got ${previewText(trimmed)}).`
      )
    }
    throw new AmountError(
      'INVALID_FORMAT',
      `Amount must be a plain unsigned decimal string like '1000.00' (got ${previewText(trimmed)}).`
    )
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new AmountError(
        'NOT_FINITE',
        `Amount must be a finite number (got ${previewText(value)}).`
      )
    }
    if (value < 0) {
      throw new AmountError('NEGATIVE', `Amount must not be negative (got ${previewText(value)}).`)
    }
    const str = String(value)
    if (PLAIN_DECIMAL.test(str)) return str
    const exponential = EXPONENTIAL_NUMBER.exec(str)
    if (exponential) {
      return expandExponential(exponential[1], exponential[2] ?? '', Number(exponential[3]))
    }
    throw new AmountError(
      'INVALID_FORMAT',
      `Amount number did not render as a decimal string (got ${previewText(value)}).`
    )
  }

  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw new AmountError('NEGATIVE', `Amount must not be negative (got ${previewText(value)}).`)
    }
    return value.toString()
  }

  throw new AmountError(
    'INVALID_TYPE',
    `Amount must be a decimal string, number, or bigint (got ${previewText(value)}).`
  )
}

/**
 * Expands a positive decimal in exponential notation into plain decimal
 * form using exact string-digit shifting (e.g. '1.5e-3' → '0.0015').
 */
function expandExponential(whole: string, fraction: string, exponent: number): string {
  const digits = whole + fraction
  const point = whole.length + exponent
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`
  if (point >= digits.length) return `${digits}${'0'.repeat(point - digits.length)}`
  return `${digits.slice(0, point)}.${digits.slice(point)}`
}

/**
 * Converts a validated plain decimal string into its scaled `BigInt`
 * integer (`value × 10^scale`), rejecting excess fractional precision.
 */
function toScaledInteger(decimal: string, scale: number): bigint {
  const dotIndex = decimal.indexOf('.')
  const whole = dotIndex === -1 ? decimal : decimal.slice(0, dotIndex)
  const fraction = dotIndex === -1 ? '' : decimal.slice(dotIndex + 1)
  if (fraction.length > scale) {
    throw new AmountError(
      'INVALID_SCALE',
      `Amount ${previewText(decimal)} has ${fraction.length} fractional digit(s); at most ${scale} ` +
        `are allowed. Excess precision is rejected, never rounded.`
    )
  }
  return BigInt(whole + fraction.padEnd(scale, '0'))
}

/** Converts a scaled `BigInt` integer back into canonical decimal form. */
function formatScaled(scaled: bigint, scale: number): string {
  if (scale === 0) return scaled.toString()
  const digits = scaled.toString().padStart(scale + 1, '0')
  const cut = digits.length - scale
  return `${digits.slice(0, cut)}.${digits.slice(cut)}`
}

function isResolvedRules(rules: AmountRules | ResolvedAmountRules): rules is ResolvedAmountRules {
  return (
    typeof (rules as ResolvedAmountRules).minScaled === 'bigint' &&
    typeof (rules as ResolvedAmountRules).maxScaled === 'bigint'
  )
}

function parseRuleBound(
  bound: string | number | bigint,
  scale: number,
  name: 'min' | 'max'
): bigint {
  try {
    return toScaledInteger(toDecimalString(bound), scale)
  } catch (error) {
    if (error instanceof AmountError) {
      throw new AmountError(
        'INVALID_RULES',
        `Invalid ${name} rule (got ${previewText(bound)}): ${error.message}`
      )
    }
    throw error
  }
}

/**
 * Validates an {@link AmountRules} object and resolves it to `BigInt`
 * bounds. Throws {@link AmountError} with code `INVALID_RULES` for any
 * misconfiguration.
 */
export function resolveAmountRules(rules?: AmountRules | ResolvedAmountRules): ResolvedAmountRules {
  if (rules === undefined) return DEFAULT_RULES
  if (isResolvedRules(rules)) return rules

  const scale = rules.scale ?? USDC_SCALE
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_SCALE) {
    throw new AmountError(
      'INVALID_RULES',
      `scale must be an integer between 0 and ${MAX_SCALE} (got ${previewText(scale)})`
    )
  }

  const minScaled = rules.min === undefined ? 0n : parseRuleBound(rules.min, scale, 'min')
  const maxScaled =
    rules.max === undefined ? MAX_INT64 : parseRuleBound(rules.max, scale, 'max')

  if (minScaled > maxScaled) {
    throw new AmountError('INVALID_RULES', `min must not exceed max.`)
  }

  return { scale, minScaled, maxScaled }
}

/**
 * Parses and canonicalizes a decimal amount to a plain decimal string with
 * exactly `rules.scale` fractional digits.
 */
export function parseAmount(
  value: unknown,
  rules?: AmountRules | ResolvedAmountRules
): string {
  const resolved = resolveAmountRules(rules)
  const decimal = toDecimalString(value as string | number | bigint)
  const scaled = toScaledInteger(decimal, resolved.scale)

  if (scaled > MAX_INT64) {
    throw new AmountError(
      'OVERFLOW',
      `Amount exceeds the int64 scaled-integer bound (got ${previewText(decimal)}).`
    )
  }
  if (scaled < resolved.minScaled) {
    throw new AmountError(
      'BELOW_MIN',
      `Amount is below the minimum (got ${previewText(decimal)}).`
    )
  }
  if (scaled > resolved.maxScaled) {
    throw new AmountError(
      'OVERFLOW',
      `Amount exceeds the maximum (got ${previewText(decimal)}).`
    )
  }

  return formatScaled(scaled, resolved.scale)
}
