/**
 * @file mutationGuard.ts
 * @description Bounded-input guards and constants for bond and trust-score
 * mutations.
 *
 * These are the **resource/rate limits** applied at the mutation boundary,
 * *before* any expensive or irreversible work (signed transaction submissions,
 * ledger writes, lookups) is attempted:
 *
 * - Bond amounts are bounded to a deterministic, finite range. Unbounded or
 *   adversarial input (Infinity, NaN, enormous values) is rejected up front
 *   instead of being forwarded to the wallet/network path.
 * - Trust-score addresses are bounded in length and required to be non-empty,
 *   so the encoded lookup path cannot be abused with unbounded input.
 *
 * The invariant enforced is: a mutation is only executed when its inputs are
 * within the documented bounds; otherwise an **actionable** validation error
 * is produced and no partial work or wallet interaction occurs.
 */

/** Allowed bond amount range (USDC), finite and inclusive. */
export const BOND_AMOUNT_MIN_USDC = 10
export const BOND_AMOUNT_MAX_USDC = 1_000_000

/** Defensive cap on the trust-score address input length. */
export const TRUST_SCORE_ADDRESS_MAX_LENGTH = 128

export type MutationInputResult<T> = { ok: true; value: T } | { ok: false; message: string }

/**
 * Validates a raw bond amount before the expensive mutation.
 *
 * Rejects non-finite numbers, values outside the documented bounds, and
 * anything that is not a number. Returning a typed result lets the caller
 * surface an actionable, user-facing message and always avoids calling the
 * downstream submit path for invalid input.
 */
export function validateBondAmount(value: unknown): MutationInputResult<number> {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (typeof value === 'number' && !Number.isFinite(value)) {
    return { ok: false, message: 'Bond amount must be a finite number.' }
  }
  if (!Number.isFinite(numeric)) {
    return { ok: false, message: 'Bond amount must be a valid number.' }
  }
  if (numeric < BOND_AMOUNT_MIN_USDC) {
    return {
      ok: false,
      message: `Bond amount must be at least ${BOND_AMOUNT_MIN_USDC} USDC.`,
    }
  }
  if (numeric > BOND_AMOUNT_MAX_USDC) {
    return {
      ok: false,
      message: `Bond amount must not exceed ${BOND_AMOUNT_MAX_USDC} USDC.`,
    }
  }

  return { ok: true, value: numeric }
}

/**
 * Validates a Stellar trust-score address before a lookup mutation.
 *
 * Rejects empty input, non-strings, and inputs exceeding the length bound so
 * the encoded lookup path is not fed unbounded input.
 */
export function validateTrustScoreAddress(value: unknown): MutationInputResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, message: 'Trust score address must be a string.' }
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return { ok: false, message: 'Trust score address must not be empty.' }
  }
  if (trimmed.length > TRUST_SCORE_ADDRESS_MAX_LENGTH) {
    return {
      ok: false,
      message: `Trust score address must not exceed ${TRUST_SCORE_ADDRESS_MAX_LENGTH} characters.`,
    }
  }

  return { ok: true, value: trimmed }
}
