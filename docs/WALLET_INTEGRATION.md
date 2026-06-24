# Wallet Integration

Credence reads the connected Freighter account through `useWallet()` and compares its reported
network against the app setting stored in `SettingsContext`.

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
