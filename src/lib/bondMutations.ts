/**
 * Bond mutation boundary.
 *
 * The real product implementation will submit signed Stellar transactions and
 * return the authoritative hash. For now, the demo pages use deterministic
 * local hashes so we can:
 * - persist and recover mutation state across reloads
 * - test retry/duplicate protection deterministically with fake timers
 */
import { parseAmount } from '../api/amount'

export type BondAmountInput = string | number | bigint

export async function submitCreateBond(params: {
  amountUsdc: BondAmountInput
}): Promise<{ hash: string }> {
  // Validate before the wallet/network boundary. Keep the canonical value in
  // the request shape so a future wallet adapter cannot accidentally receive a
  // rounded JavaScript number.
  parseAmount(params.amountUsdc, { min: 10, max: 1_000_000 })
  // Simulated async wallet/network path.
  await new Promise((resolve) => setTimeout(resolve, 50))
  return { hash: `local-bond-create-${Date.now()}` }
}

export async function submitWithdrawBond(params: {
  bondId: number
  amountUsdc: BondAmountInput
}): Promise<{ hash: string }> {
  parseAmount(params.amountUsdc, { min: 10, max: 1_000_000 })
  await new Promise((resolve) => setTimeout(resolve, 50))
  return { hash: `local-bond-withdraw-${Date.now()}` }
}
