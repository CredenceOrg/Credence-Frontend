import type { CredenceNetwork } from '../networkLabels'

export type WalletAdapterErrorCode = 'not_installed' | 'rejected' | 'unknown'

export type WalletConnectResult =
  | { ok: true; address: string }
  | { ok: false; code: WalletAdapterErrorCode; message: string }

export type WalletSignResult =
  | { ok: true; signedTxXdr: string }
  | { ok: false; code: WalletAdapterErrorCode; message: string }

export interface SignTransactionOptions {
  networkPassphrase?: string
  address?: string
}

export interface WalletChangeEvent {
  address: string
  network: CredenceNetwork | null
}

export interface WalletWatcherHandle {
  stop: () => void
}

/**
 * Provider-agnostic Stellar wallet adapter contract.
 *
 * Implementations must be SSR-safe (guarding `typeof window === 'undefined'`)
 * and return discriminated results rather than throwing on expected user/provider failures.
 */
export interface WalletAdapter {
  /** Stable identifier persisted in storage and emitted in audit events (e.g. 'freighter', 'xbull'). */
  readonly id: string
  /** Human-readable provider name for UI surfaces. */
  readonly name: string
  /** URL where users can install the wallet extension or app. */
  readonly installUrl: string
  /** Returns true when the wallet provider is detected in the current environment. */
  isInstalled: () => Promise<boolean>
  /** Prompts the user to connect and returns the authorized Stellar public key. */
  connect: () => Promise<WalletConnectResult>
  /** Reads the currently authorized Stellar public key without prompting, or null if unavailable. */
  getAddress: () => Promise<string | null>
  /** Reads the wallet's currently selected Stellar network, or null if unavailable. */
  getNetwork: () => Promise<CredenceNetwork | null>
  /** Prompts the user to sign a Stellar transaction envelope XDR. */
  signTransaction: (xdr: string, opts?: SignTransactionOptions) => Promise<WalletSignResult>
  /** Clears any adapter-local session state or closes provider connections. */
  disconnect: () => Promise<void> | void
  /** Optional subscription to external account/network changes. */
  watchChanges?: (
    onChange: (event: WalletChangeEvent) => void
  ) => Promise<WalletWatcherHandle | null>
}

export function normalizeWalletNetwork(raw: string): CredenceNetwork | null {
  const normalized = raw.trim().toUpperCase()
  if (normalized.includes('TEST')) return 'test'
  if (normalized.includes('PUBLIC') || normalized.includes('MAIN')) return 'public'
  return null
}
