/**
 * Minimal ambient type declarations for @stellar/freighter-api.
 * The package is loaded lazily at runtime via freighterClient.ts; these types
 * satisfy the TypeScript compiler without requiring the package to be installed.
 */
declare module '@stellar/freighter-api' {
  interface ConnectedResult {
    isConnected: boolean
    error?: Error | null
  }

  interface AllowedResult {
    isAllowed: boolean
    error?: Error | null
  }

  interface AccessResult {
    address: string
    error?: { message?: string } | null
  }

  interface AddressResult {
    address: string
    error?: Error | null
  }

  interface NetworkResult {
    network: string
    error?: Error | null
  }

  interface WalletChangeParams {
    address: string
    network: string
    error?: Error | null
  }

  interface SignTransactionResult {
    signedTxXdr: string
    signerAddress?: string
    error?: string | null
  }

  export function isConnected(): Promise<ConnectedResult>
  export function isAllowed(): Promise<AllowedResult>
  export function requestAccess(): Promise<AccessResult>
  export function getAddress(): Promise<AddressResult>
  export function getNetwork(): Promise<NetworkResult>

  export function signTransaction(
    xdr: string,
    opts?: { network?: string; networkPassphrase?: string; address?: string }
  ): Promise<SignTransactionResult>

  export class WatchWalletChanges {
    watch(callback: (params: WalletChangeParams) => void): void
    stop(): void
  }
}
