/**
 * Bond mutation boundary.
 *
 * The real product implementation will submit signed Stellar transactions and
 * return the authoritative hash. For now, the demo pages use deterministic
 * local hashes so we can:
 * - persist and recover mutation state across reloads
 * - test retry/duplicate protection deterministically with fake timers
 */

export async function submitCreateBond(_params: { amountUsdc: number }): Promise<{ hash: string }> {
  // Simulated async wallet/network path.
  await new Promise((resolve) => setTimeout(resolve, 50))
  return { hash: `local-bond-create-${Date.now()}` }
}

export async function submitWithdrawBond(_params: {
  bondId: number
  amountUsdc: number
}): Promise<{ hash: string }> {
  await new Promise((resolve) => setTimeout(resolve, 50))
  return { hash: `local-bond-withdraw-${Date.now()}` }
}
