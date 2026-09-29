/**
 * @file amount.ts
 * @description Exact decimal amount parsing, validation, and canonical
 * serialization for the Credence API boundary.
 *
 * Money must never travel through IEEE-754 floating-point arithmetic on its
 * way to the wire. In JavaScript, `0.1 + 0.2` is `0.30000000000000004`,
 * numbers at or above `1e21` serialize as exponent notation, integers above
 * `Number.MAX_SAFE_INTEGER` silently round, and `JSON.stringify` turns
 * `NaN` / `Infinity` into `null`. Any one of those would corrupt a USDC bond
 * amount before the backend ever sees it — and none of them fail loudly.
 *
 * This module provides the deterministic rules that `apiFetch` enforces on
 * declared amount fields (see `amountFields` on `ApiFetchOptions` in
 * {@link ./client.ts}):
 *
 * 1. **Exactness** — values are parsed with string-digit + `BigInt`
 *    arithmetic only. Numbers are interpreted as their shortest round-trip
 *    decimal string (`String(n)`); exponent forms are expanded exactly.
 * 2. **Grammar** — plain unsigned decimals only: `/^\d+(\.\d+)?$/` after
 *    trimming surrounding whitespace. No signs, exponents, grouping
 *    separators, or non-ASCII digits.
 * 3. **Scale** — at most `rules.scale` fractional digits (default 2, the
 *    USDC convention used by `openapi.yaml`). Values with excess precision
 *    are **rejected**, never rounded or truncated.
 * 4. **Sign** — amounts are unsigned by design; negative values are
 *    rejected (debits/credits are separate operations, not signed values).
 * 5. **Magnitude** — the scaled integer (`value × 10^scale`) must fit in a
 *    signed 64-bit integer (the Soroban / Stellar on-chain amount
 *    representation) and within the optional `rules.min` / `rules.max`
 *    bounds.
 * 6. **Canonical output** — the serialized form is a plain decimal string
 *    with exactly `rules.scale` fractional digits, no exponent, and no
 *    leading zeros (`'1000'` → `'1000.00'`), matching the `Bond.amount`
 *    `"decimal string (avoids float precision issues)"` contract in
 *    `openapi.yaml`.
 *
 * Check order is deterministic so failures are reproducible: rules
 * (`INVALID_RULES`) → type (`INVALID_TYPE`) → emptiness (`EMPTY`) → format /
 * finiteness / sign (`INVALID_FORMAT`, `NOT_FINITE`, `NEGATIVE`) → scale
 * (`INVALID_SCALE`) → bounds (`BELOW_MIN`, `OVERFLOW`).
 *
 * @see docs/AMOUNT_PRECISION.md for the full design, compatibility, and
 * rollback notes.
 */

/**
 * Maximum value of a signed 64-bit integer.
 *
 * Soroban contracts and Stellar's XDR represent asset amounts as signed
 * 64-bit integers (stroops for native-precision assets), so `value ×
 * 10^scale` must fit in this bound for an amount to be representable
 * on-chain.
 */
export const MAX_INT64 = 9223372036854775807n

/**
 * Decimal places of the canonical USDC wire format used by this app
 * (`openapi.yaml` example: `"1000.00"`). Matches the 2-decimal USDC
 * convention used across the UI (`src/lib/format.ts`).
 */
export const USDC_SCALE = 2

/** Highest scale accepted by {@link resolveAmountRules}. */
export const MAX_SCALE = 18

/** Machine-readable reason an amount was rejected. */
export type AmountErrorCode =
  /** The rules object itself is misconfigured (bad scale, unparsable bound, min > max). */
  | 'INVALID_RULES'
  /** The value is not a string, number, or bigint (null, boolean, object, ...). */
  | 'INVALID_TYPE'
  /** The value is an empty or whitespace-only string. */
  | 'EMPTY'
  /** The value is not a plain unsigned decimal (letters, signs, exponents, separators, ...). */
  | 'INVALID_FORMAT'
  /** The value is a non-finite number (NaN, +Infinity, -Infinity). */
  | 'NOT_FINITE'
  /** The value is negative. */
  | 'NEGATIVE'
  /** The value has more fractional digits than the configured scale allows. */
  | 'INVALID_SCALE'
  /** The value is below the configured minimum. */
  | 'BELOW_MIN'
  /** The value exceeds the configured maximum (or the int64 scaled-integer bound). */
  | 'OVERFLOW'

/**
 * Thrown by {@link parseAmount} (and surfaced by `apiFetch` as
 * `ApiAmountError`) when a value violates one of the exact-decimal rules.
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
  /**
   * Maximum number of fractional digits. Integer between 0 and 18.
   * @default {@link USDC_SCALE} (2)
   */
  scale?: number
  /**
   * Inclusive lower bound, given as a plain unsigned decimal
   * (string, number, or bigint). Must itself satisfy the scale rule.
   * @default '0'
   */
  min?: string | number | bigint
  /**
   * Inclusive upper bound, given as a plain unsigned decimal
   * (string, number, or bigint). Must itself satisfy the scale rule.
   * @default the largest value whose scaled integer fits in a signed 64-bit
   * integer (`92233720368547758.07` at scale 2)
   */
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

/** Matches the same grammar with an explicit minus sign (rejected with `NEGATIVE`). */
const NEGATIVE_DECIMAL = /^-\d+(\.\d+)?$/

/** Matches the same grammar with an explicit plus sign (rejected as a format error). */
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
 * Converts an accepted input type into a plain unsigned decimal string,
 * rejecting everything else. Never performs floating-point arithmetic:
 * numbers are converted via their shortest round-trip string and exponent
 * forms are expanded with exact digit shifting.
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
    // IEEE-754 negative zero compares equal to zero and `String(-0)` is '0',
    // so -0 canonicalizes to '0.00'. Strings keep their explicit '-' → the
    // two input types are documented to differ here.
    if (value < 0) {
      throw new AmountError('NEGATIVE', `Amount must not be negative (got ${previewText(value)}).`)
    }
    const str = String(value)
    if (PLAIN_DECIMAL.test(str)) return str
    const exponential = EXPONENTIAL_NUMBER.exec(str)
    if (exponential) {
      return expandExponential(exponential[1], exponential[2] ?? '', Number(exponential[3]))
    }
    // Unreachable for finite numbers, but kept as a hard guarantee instead
    // of letting an unknown shape fall through to the digits pipeline.
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
 * Finite doubles have exponents within ±308, so the shifts are bounded.
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
 * misconfiguration, so a typo in a rule can never silently widen the
 * accepted range.
 */
export function resolveAmountRules(rules?: AmountRules | ResolvedAmountRules): ResolvedAmountRules {
  if (rules === undefined) return DEFAULT_RULES
  if (isResolvedRules(rules)) return rules

  const scale = rules.scale ?? USDC_SCALE
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_SCALE) {
    throw new AmountError(
      'INVALID_RULES',
      `scale must be an integer between 0 and ${MAX_SCALE} (got ${previewText(scale)}).`
    )
  }
  const minScaled = rules.min === undefined ? 0n : parseRuleBound(rules.min, scale, 'min')
  const maxScaled = rules.max === undefined ? MAX_INT64 : parseRuleBound(rules.max, scale, 'max')
  if (minScaled > maxScaled) {
    throw new AmountError(
      'INVALID_RULES',
      `min (${formatScaled(minScaled, scale)}) must not exceed max ` +
        `(${formatScaled(maxScaled, scale)}).`
    )
  }
  return { scale, minScaled, maxScaled }
}

/**
 * Parses, validates, and canonicalizes a decimal amount.
 *
 * @param value Plain unsigned decimal string, finite non-negative number,
 *              or non-negative bigint. Numbers are interpreted as their
 *              shortest round-trip decimal string, so float drift such as
 *              `0.1 + 0.2` is caught as an `INVALID_SCALE` rejection.
 * @param rules Optional {@link AmountRules} (or a pre-resolved rules object
 *              from {@link resolveAmountRules}).
 * @returns The canonical decimal string with exactly `rules.scale`
 *          fractional digits (`1000.5` → `'1000.50'`).
 * @throws {AmountError} with a machine-readable `code` for every invalid
 *         input. Never rounds, truncates, or coerces.
 */
export function parseAmount(
  value: string | number | bigint,
  rules?: AmountRules | ResolvedAmountRules
): string {
  const resolved = resolveAmountRules(rules)
  const decimal = toDecimalString(value)
  const scaled = toScaledInteger(decimal, resolved.scale)
  if (scaled < resolved.minScaled) {
    throw new AmountError(
      'BELOW_MIN',
      `Amount ${formatScaled(scaled, resolved.scale)} is below the minimum ` +
        `${formatScaled(resolved.minScaled, resolved.scale)}.`
    )
  }
  if (scaled > resolved.maxScaled) {
    throw new AmountError(
      'OVERFLOW',
      `Amount ${formatScaled(scaled, resolved.scale)} exceeds the maximum ` +
        `${formatScaled(resolved.maxScaled, resolved.scale)}.`
    )
  }
  return formatScaled(scaled, resolved.scale)
}

/** Discriminated result of {@link tryParseAmount}. */
export type TryParseAmountResult = { ok: true; value: string } | { ok: false; error: AmountError }

/**
 * Non-throwing variant of {@link parseAmount} for UI-layer pre-validation
 * (e.g. live form feedback) where exceptions would be awkward.
 */
export function tryParseAmount(
  value: string | number | bigint,
  rules?: AmountRules | ResolvedAmountRules
): TryParseAmountResult {
  try {
    return { ok: true, value: parseAmount(value, rules) }
  } catch (error) {
    if (error instanceof AmountError) return { ok: false, error }
    throw error
  }
}

/**
 * Compares two amounts under the given rules.
 *
 * @returns `-1` when `a < b`, `0` when equal, `1` when `a > b` — computed
 * on the exact scaled integers, never through floating point.
 * @throws {AmountError} when either side fails validation.
 */
export function compareAmounts(
  a: string | number | bigint,
  b: string | number | bigint,
  rules?: AmountRules | ResolvedAmountRules
): -1 | 0 | 1 {
  const resolved = resolveAmountRules(rules)
  const aScaled = toScaledInteger(toDecimalString(a), resolved.scale)
  const bScaled = toScaledInteger(toDecimalString(b), resolved.scale)
  if (aScaled < bScaled) return -1
  if (aScaled > bScaled) return 1
  return 0
}
