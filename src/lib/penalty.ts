/**
 * @file penalty.ts
 * @description Status-based early-withdrawal penalty math for existing (mock) bonds.
 *
 * Where {@link './bondPenalty'} computes a penalty from a *prospective* bond's lock
 * duration (used in the creation wizard), this module computes the penalty for an
 * *existing* bond from its lifecycle `status` (used on Bond.tsx's withdrawal flow).
 * Both funnel through {@link formatUsdc} so displayed numbers stay consistent.
 */

import { formatUsdc } from './format'

/** Lifecycle state of a bond, which determines its early-withdrawal penalty rate. */
export type BondStatus = 'active' | 'locked' | 'grace-period'

/** Minimal bond shape used by the mock data layer and penalty calculations. */
export interface MockBond {
  /** Stable identifier for the bond within the mock dataset. */
  id: number
  /** Principal amount in USDC. */
  amountUsdc: number
  /** Current lifecycle status driving the penalty rate. */
  status: BondStatus
}

/**
 * Returns the early-withdrawal penalty rate (as a decimal fraction) for a bond status.
 *
 * - `locked` → `0.2` (20 %)
 * - `grace-period` → `0.1` (10 %)
 * - `active` (and any unknown status) → `0` (no penalty)
 *
 * @param status - The bond's current lifecycle status.
 * @returns The penalty rate as a decimal, e.g. `0.2` for 20 %.
 */
export function getPenaltyRate(status: BondStatus): number {
  switch (status) {
    case 'locked':
      return 0.2
    case 'grace-period':
      return 0.1
    case 'active':
    default:
      return 0
  }
}

/**
 * Computes the early-withdrawal breakdown for an existing bond, ready to feed into the
 * withdrawal `ConfirmDialog` on Bond.tsx.
 *
 * @param bond - The bond being withdrawn, supplying its amount and status.
 * @returns A {@link ConfirmDialogPenaltyBreakdown} (formatted strings) augmented with the
 *   raw `penaltyUsdc` value for conditional logic.
 *
 * @example
 * computeWithdrawBreakdown({ id: 1, amountUsdc: 1000, status: 'locked' })
 * // → { bondAmount: '1,000 USDC', penaltyPercent: 20, penaltyAmount: '200 USDC',
 * //     resultingBalance: '800 USDC', penaltyUsdc: 200 }
 */
export function computeWithdrawBreakdown(
  bond: MockBond
): {
  bondAmount: string
  penaltyAmount: string
  penaltyPercent: number
  resultingBalance: string
  penaltyUsdc: number
} {
  const rate = getPenaltyRate(bond.status)
  const penaltyPercent = Math.round(rate * 100)
  const penaltyUsdc = bond.amountUsdc * rate
  const resultingUsdc = bond.amountUsdc - penaltyUsdc

  return {
    bondAmount: formatUsdc(bond.amountUsdc),
    penaltyAmount: formatUsdc(penaltyUsdc),
    penaltyPercent,
    resultingBalance: formatUsdc(resultingUsdc),
    penaltyUsdc,
  }
}
