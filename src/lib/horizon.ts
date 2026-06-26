/**
 * @file horizon.ts
 * @description Lightweight, SSR-safe wrapper around the Stellar Horizon REST API.
 *
 * Provides only the subset of Horizon we need — account balance lookups — without
 * pulling in the full `@stellar/stellar-sdk`. Every export guards against a
 * non-browser environment so importing this module is safe in SSR/test contexts.
 *
 * @see {@link https://developers.stellar.org/docs/horizon-api/reference/accounts-single}
 */

import type { CredenceNetwork } from './networkLabels'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HORIZON_URLS: Record<CredenceNetwork, string> = {
  public: 'https://horizon.stellar.org',
  test: 'https://horizon-testnet.stellar.org',
}

/** Circle's USDC issuer on each Stellar network. */
const USDC_ISSUERS: Record<CredenceNetwork, string> = {
  public: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  test: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
}

const USDC_ASSET_CODE = 'USDC'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a single balance entry in the Horizon accounts response. */
interface HorizonBalance {
  asset_type: string
  asset_code?: string
  asset_issuer?: string
  balance: string
}

/** Shape of the Horizon accounts response (subset we consume). */
interface HorizonAccount {
  balances: HorizonBalance[]
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HorizonError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HorizonError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetches the USDC balance for a Stellar account from Horizon.
 *
 * Returns `0` when the account has no USDC trustline (asset not found).
 * Throws `HorizonError` on network/HTTP failures.
 *
 * @param address - Stellar public key (G…).
 * @param network - Active Stellar network (`'public'` or `'test'`).
 * @param signal  - Optional `AbortSignal` for cancellation.
 * @returns The USDC balance as a number.
 */
export async function fetchUsdcBalance(
  address: string,
  network: CredenceNetwork,
  signal?: AbortSignal
): Promise<number> {
  if (typeof window === 'undefined') return 0

  const horizonUrl = HORIZON_URLS[network]
  const url = `${horizonUrl}/accounts/${encodeURIComponent(address)}`

  const response = await fetch(url, { signal })

  if (!response.ok) {
    // 404 means the account doesn't exist on this network — treat as zero balance.
    if (response.status === 404) return 0
    throw new HorizonError(response.status, `Horizon request failed (${response.status})`)
  }

  const account: HorizonAccount = await response.json()

  const usdcIssuer = USDC_ISSUERS[network]
  const match = account.balances.find(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code === USDC_ASSET_CODE &&
      b.asset_issuer === usdcIssuer
  )

  return match ? Number(match.balance) : 0
}
