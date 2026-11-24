/**
 * @file horizon.ts
 * @description Lightweight, SSR-safe wrapper around the Stellar Horizon REST API.
 *
 * Provides the subset of Horizon we need without pulling in the full
 * `@stellar/stellar-sdk`. Every export guards against a non-browser environment
 * so importing this module is safe in SSR/test contexts.
 *
 * @see {@link https://developers.stellar.org/docs/horizon-api/reference/accounts-single}
 */

import type { CredenceNetwork } from './networkLabels'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HORIZON_URLS: Record<CredenceNetwork, string> = {
  public: 'https://horizon.stellar.org',
  test: 'https://horizon-testnet.stellar.org',
}

/** Circle's USDC issuer on each Stellar network. */
const USDC_ISSUERS: Record<CredenceNetwork, string> = {
  public: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  test: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
}

const USDC_ASSET_CODE = 'USDC'

export function getUsdcIssuer(network: CredenceNetwork): string {
  return USDC_ISSUERS[network]
}

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

export interface HorizonAccountSequence {
  sequence: string
}

export interface HorizonResultCodes {
  transaction?: string
  operations?: string[]
}

interface HorizonTransactionResponse {
  hash?: string
  detail?: string
  extras?: {
    result_codes?: HorizonResultCodes
  }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class HorizonError extends Error {
  readonly status: number
  readonly resultCodes?: HorizonResultCodes

  constructor(status: number, message: string, resultCodes?: HorizonResultCodes) {
    super(message)
    this.name = 'HorizonError'
    this.status = status
    this.resultCodes = resultCodes
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function fetchHorizon(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new HorizonError(
      0,
      error instanceof Error ? `Horizon request failed: ${error.message}` : 'Horizon request failed.'
    )
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
      b.asset_type !== 'native' && b.asset_code === USDC_ASSET_CODE && b.asset_issuer === usdcIssuer
  )

  return match ? Number(match.balance) : 0
}

/**
 * Loads the current source-account sequence from Horizon for transaction building.
 *
 * @param address - Stellar public key (G…).
 * @param network - Active Stellar network.
 * @param signal - Optional `AbortSignal`.
 */
export async function loadAccount(
  address: string,
  network: CredenceNetwork,
  signal?: AbortSignal
): Promise<HorizonAccountSequence> {
  if (typeof window === 'undefined') {
    throw new HorizonError(0, 'Horizon account loading is only available in a browser.')
  }

  const response = await fetchHorizon(
    `${HORIZON_URLS[network]}/accounts/${encodeURIComponent(address)}`,
    { signal }
  )

  if (!response.ok) {
    throw new HorizonError(response.status, `Horizon account request failed (${response.status})`)
  }

  const account = (await response.json()) as HorizonAccountSequence
  if (typeof account.sequence !== 'string' || !/^\d+$/.test(account.sequence)) {
    throw new HorizonError(response.status, 'Horizon returned an invalid account sequence.')
  }

  return { sequence: account.sequence }
}

/**
 * Submits one signed transaction to Horizon.
 *
 * The helper deliberately does not retry: a transport failure can leave the
 * submission outcome uncertain for a financial transaction.
 *
 * @param xdr - Signed Stellar transaction envelope XDR.
 * @param network - Active Stellar network.
 * @param signal - Optional `AbortSignal`.
 * @returns The hash supplied by Horizon for the submitted transaction.
 */
export async function submitTransaction(
  xdr: string,
  network: CredenceNetwork,
  signal?: AbortSignal
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new HorizonError(0, 'Horizon transaction submission is only available in a browser.')
  }

  const response = await fetchHorizon(`${HORIZON_URLS[network]}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: xdr }),
    signal,
  })

  const payload = (await response.json().catch(() => ({}))) as HorizonTransactionResponse
  if (!response.ok) {
    throw new HorizonError(
      response.status,
      payload.detail || `Horizon transaction submission failed (${response.status})`,
      payload.extras?.result_codes
    )
  }

  if (typeof payload.hash !== 'string' || payload.hash.length === 0) {
    throw new HorizonError(response.status, 'Horizon response did not include a transaction hash.')
  }

  return payload.hash
}
