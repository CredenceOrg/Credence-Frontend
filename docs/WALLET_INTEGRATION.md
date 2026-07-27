# Wallet Integration

Credence reads the connected Freighter account through the `useWallet()` hook, which acts as the primary interface for Freighter interactions. This layer handles wallet state management, connection logic, and network alignment.

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
  /** Request Freighter access and store the returned public key. */
  connect: () => Promise<void>
  /** Clear the local wallet session. */
  disconnect: () => void
  /** Freighter network reported by the wallet, or null when unavailable. */
  network: CredenceNetwork | null
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

Action surfaces (e.g., "Create Bond", "Attest") MUST check `isConnected`. If `false`, the UI must surface the `ConnectWalletModal`.

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
