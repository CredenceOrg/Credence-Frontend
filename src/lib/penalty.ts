import { formatUsdc } from './format'
import type { ConfirmDialogPenaltyBreakdown } from '../components/ConfirmDialog'

export type BondStatus = 'active' | 'locked' | 'grace-period'

export interface MockBond {
  id: number
  amountUsdc: number
  status: BondStatus
}

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

export function computeWithdrawBreakdown(
  bond: MockBond
): ConfirmDialogPenaltyBreakdown & { penaltyUsdc: number } {
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
