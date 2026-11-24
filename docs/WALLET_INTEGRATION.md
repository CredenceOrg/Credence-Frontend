# Wallet Integration

Credence reads the connected Stellar account through the `useWallet()` hook, which sits on top of a provider-agnostic `WalletAdapter` interface (`src/lib/wallet/adapter.ts`). Built-in adapters are provided for **Freighter** (`src/lib/wallet/freighterAdapter.ts`) and **xBull** (`src/lib/wallet/xbullAdapter.ts`). Users can choose their wallet in `ConnectWalletDialog`, and the last chosen adapter is persisted in `localStorage` for automatic reconnect across reloads.

## `WalletAdapter` Interface

Every wallet provider implements `WalletAdapter`:

```typescript
export interface WalletAdapter {
  readonly id: string
  readonly name: string
  readonly installUrl: string
  isInstalled: () => Promise<boolean>
  connect: () => Promise<WalletConnectResult>
  getAddress: () => Promise<string | null>
  getNetwork: () => Promise<CredenceNetwork | null>
  signTransaction: (xdr: string, opts?: SignTransactionOptions) => Promise<WalletSignResult>
  disconnect: () => Promise<void> | void
  watchChanges?: (onChange: (event: WalletChangeEvent) => void) => Promise<WalletWatcherHandle | null>
}
```

Audit events emitted via `src/lib/walletAudit.ts` include `adapterId` so session transitions can be traced per wallet provider.

## `useWallet` Hook API

The `useWallet()` hook is the centralized source of truth for the wallet connection.

```typescript
export interface UseWalletState {
  /** Connected Stellar public key, or empty when disconnected. */
  address: string
  /** True when a wallet address is available. */
  isConnected: boolean
  /** True while a connect request is in flight. */
  isConnecting: boolean
  /** Last connection error, if any (not_installed, rejected, network_mismatch, unknown). */
  error: WalletError | null
  /** Request wallet access (using the selected or specified adapter) and store the returned public key. */
  connect: (adapterId?: string) => Promise<void>
  /** Clear the local wallet session. */
  disconnect: () => void
  /** Network reported by the wallet, or null when unavailable. */
  network: CredenceNetwork | null
  /** Active/selected wallet adapter id (e.g. 'freighter', 'xbull'). */
  adapterId?: string
  /** Registered wallet adapters available for selection. */
  availableAdapters?: readonly WalletAdapter[]
  /** Select the preferred wallet adapter for subsequent connect attempts. */
  selectAdapter?: (adapterId: string) => void
  /** Sign a Stellar transaction XDR using the active wallet adapter. */
  signTransaction?: (xdr: string, opts?: SignTransactionOptions) => Promise<WalletSignResult>
}
```

## Connection State Machine

The wallet connection follows a strict state transition flow to ensure consistency.

```text
[Disconnected]
      |
      | connect() called
      V
 [Connecting] ----------------> [Connected]
      |                             |
      | failure                     | disconnect() or external logout
      V                             V
   [Error] ----------------> [Disconnected]
(not_installed, rejected,
 network_mismatch, unknown)
```

## UX Contract

### 1. Connection Gating

Action surfaces (e.g., "Create Bond", "Attest") MUST check `isConnected`. If `false`, the UI must surface the `ConnectWalletDialog`.

### 2. Not Installed

If `error.code === 'not_installed'`, display a call-to-action urging the user to install the Freighter extension.

### 3. Network Mismatch

The app compares the wallet-reported network with the application's `network` setting.

- Use `src/hooks/useNetworkMismatch.ts` to detect disparities.
- Components must block primary actions if a mismatch exists and display a warning banner prompting the user to switch networks.

## Consuming the Hook

```tsx
import { useWallet } from '../context/WalletContext'

function ActionButton() {
  const { isConnected, connect, address } = useWallet()

  if (!isConnected) {
    return <button onClick={connect}>Connect Wallet</button>
  }

  return <div>Connected: {address}</div>
}
```

## Network mismatch guard

- App network labels must stay aligned with Settings copy: `Public (Mainnet)` and
  `Test (Testnet)`.
- `src/hooks/useNetworkMismatch.ts` performs the comparison only. It returns a typed
  `{ mismatch, expected, actual }` object so pages can render a warning banner without adding
  extra business logic.
- `Bond` and `TrustScore` block their primary actions while the app and wallet disagree on
  network, and expose a banner action that switches the app network to the wallet network.
- Freighter network changes are re-read from the wallet state and refreshed on window focus so
  the guard updates when the user switches accounts or networks outside the app.

## Safety rule

Do not submit bond or trust-score actions against a network mismatch. This is treated as a
blocking UI state until the app and wallet agree.

## Bond transaction flow

Bond creation and withdrawal build Soroban contract invocations, simulate them
against the selected network's RPC endpoint, and assemble unsigned transaction
XDR before opening Freighter. Freighter signs using the matching Stellar network
passphrase; the signed envelope is submitted once through that network's Horizon
endpoint. Creation includes the USDC allowance and bond call atomically, with a
short-lived allowance. Horizon's returned transaction hash is the only success
result.

Configure these Vite environment variables for each deployed environment:

- `VITE_BOND_CONTRACT_ID_PUBLIC` and `VITE_BOND_CONTRACT_ID_TEST`
- `VITE_SOROBAN_RPC_URL_PUBLIC` and `VITE_SOROBAN_RPC_URL_TEST`

The bond contract address must be the deployed Credence bond contract for that
network. Do not use a test contract ID on mainnet. Transactions are never
automatically retried. A cancelled Freighter prompt is reported as a cancelled
mutation; Horizon result codes are returned as typed failures. A withdrawal
uses the contract's current available balance and validates `expectedAmount`
when supplied; the API bond ID is used for client-side mutation deduplication
and is not a Soroban contract argument.
