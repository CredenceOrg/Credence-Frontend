/**
 * @file bondPenalty.ts
 * @description Shared early-withdrawal penalty computation for the Credence bond system.
 *
 * The penalty rates defined here mirror the policy enforced on-chain.
 * **Do not alter these rates** — surface them, don't redefine them.
 * See `docs/risk-disclaimer.md` for the full policy documentation.
 *
 * Both Bond.tsx (withdrawal confirmation) and CreateBondFlow.tsx (review
 * step) import from this module so that users see consistent numbers at
 * every stage of the bond lifecycle.
 */

import { formatUsdc } from './format'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Duration tiers supported by the bond wizard.
 * The keys map to the selectable lock durations (in days).
 */
export type BondDurationDays = 30 | 90 | 180

/**
 * The penalty rate applied during early withdrawal, expressed as a
 * decimal fraction (e.g. 0.2 = 20 %).
 *
 * Rates are defined per lock duration:
 * - 30-day lock  → 20 % penalty
 * - 90-day lock  → 15 % penalty
 * - 180-day lock → 10 % penalty
 *
 * @see docs/risk-disclaimer.md
 */
const PENALTY_RATE_BY_DURATION: Record<BondDurationDays, number> = {
  30: 0.2,
  90: 0.15,
  180: 0.1,
}

/**
 * Default penalty rate used when the duration cannot be resolved to a
 * known tier (e.g. a future custom duration).  Falls back to the most
 * conservative (highest) rate so estimates remain safe.
 */
const DEFAULT_PENALTY_RATE = 0.2

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the early-withdrawal slash rate (as a decimal) for a given lock
 * duration.  Unknown durations return {@link DEFAULT_PENALTY_RATE}.
 *
 * @param durationDays - Lock duration in days.
 */
export function getPenaltyRateForDuration(durationDays: number): number {
  return (
    PENALTY_RATE_BY_DURATION[durationDays as BondDurationDays] ?? DEFAULT_PENALTY_RATE
  )
}

/**
 * Structured result returned by {@link computeBondSlashBreakdown}.
 */
export interface BondSlashBreakdown {
  /** Formatted principal amount, e.g. "1,000 USDC" */
  bondAmount: string
  /** Slash penalty percentage as an integer, e.g. 20 */
  penaltyPercent: number
  /** Formatted penalty amount deducted, e.g. "200 USDC" */
  penaltyAmount: string
  /** Formatted balance the user receives after the slash, e.g. "800 USDC" */
  resultingBalance: string
  /** Raw penalty value in USDC (useful for conditional logic) */
  penaltyUsdc: number
  /** Raw resulting balance in USDC */
  resultingUsdc: number
}

/**
 * Computes the early-withdrawal slash breakdown for a prospective bond.
 *
 * Used in the CreateBondFlow review step to give users a concrete,
 * numbers-first preview of what early exit would cost — consistent with
 * the numbers shown in the withdrawal ConfirmDialog on Bond.tsx.
 *
 * @param amountUsdc   - Principal bond amount in USDC.
 * @param durationDays - Lock duration in days (30 | 90 | 180).
 *
 * @example
 * computeBondSlashBreakdown(1000, 30)
 * // → { penaltyPercent: 20, penaltyAmount: "200 USDC", resultingBalance: "800 USDC", … }
 */
export function computeBondSlashBreakdown(
  amountUsdc: number,
  durationDays: number
): BondSlashBreakdown {
  const rate = getPenaltyRateForDuration(durationDays)
  const penaltyPercent = Math.round(rate * 100)
  const penaltyUsdc = amountUsdc * rate
  const resultingUsdc = amountUsdc - penaltyUsdc

  return {
    bondAmount: formatUsdc(amountUsdc),
    penaltyPercent,
    penaltyAmount: formatUsdc(penaltyUsdc),
    resultingBalance: formatUsdc(resultingUsdc),
    penaltyUsdc,
    resultingUsdc,
  }
}
