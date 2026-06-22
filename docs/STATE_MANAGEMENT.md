# State Management

This document maps the client-side state that is owned by Credence's shared
providers. It is grounded in the current source and is meant to help contributors
decide whether new state belongs in context, a route component, or the URL.

Related source:

- `src/App.tsx`
- `src/context/SettingsContext.tsx`
- `src/context/WalletContext.tsx`
- `src/hooks/useWallet.ts`
- `src/components/ToastProvider.tsx`
- `src/lib/freighterClient.ts`

## Provider Tree

`src/App.tsx` composes the global providers in this order:

```text
BrowserRouter
└── SettingsProvider
    └── WalletProvider
        └── ToastProvider
            └── ErrorBoundary
                └── Suspense
                    └── Routes
```

The order is load-bearing:

- `SettingsProvider` is outermost because wallet network selection, toast
  behavior, and theme application all depend on settings.
- `WalletProvider` reads `network` from `SettingsProvider` before exposing
  wallet connection state.
- `ToastProvider` reads `toastsEnabled` and `autoDismiss` from
  `SettingsProvider`, so it must stay below that provider.

## Ownership Map

| Owner              | Hook            | Owns                                                                                                         | Does not own                                                                              |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `SettingsProvider` | `useSettings()` | Theme mode, selected Stellar network, address display mode, toast settings, save/cancel snapshot state.      | Wallet address, toast queue entries, route-local form state.                              |
| `WalletProvider`   | `useWallet()`   | Shared Freighter connection state derived from `useWalletState(network)`, plus the legacy `connected` alias. | Settings persistence, Freighter module implementation details, page-specific wallet copy. |
| `ToastProvider`    | `useToast()`    | In-memory toast queue, generated toast ids, auto-dismiss timers, queue trimming.                             | Whether toasts are enabled or how long they dismiss after; those are settings.            |

## Settings State

`SettingsProvider` exposes the following state from `src/context/SettingsContext.tsx`:

| Field               | Default  | Notes                                                      |
| ------------------- | -------- | ---------------------------------------------------------- |
| `themeMode`         | `system` | Accepted values are `light`, `dark`, and `system`.         |
| `network`           | `public` | Settings value later resolves wallet network behavior.     |
| `addressDisplay`    | `short`  | Controls how addresses are displayed in UI.                |
| `toastsEnabled`     | `true`   | Read by `ToastProvider` before enqueuing toasts.           |
| `autoDismiss`       | `5s`     | Read by `ToastProvider` when calculating toast timers.     |
| `hasUnsavedChanges` | `false`  | Derived by comparing current values to `originalSettings`. |

The public setters are:

- `setThemeMode`
- `setNetwork`
- `setAddressDisplay`
- `setToastsEnabled`
- `setAutoDismiss`
- `saveSettings`
- `cancelSettings`

### Persistence

Settings use a single `localStorage` key:

```text
credence:settings
```

The persisted payload currently contains:

```ts
{
  themeMode,
  network,
  addressDisplay,
  toastsEnabled,
  autoDismiss,
}
```

Startup loading is defensive: if the key is absent, unreadable, or contains
corrupt JSON, `loadSavedSettings()` returns `null` and each field falls back to
its default value.

The provider also writes the same payload back to `credence:settings` whenever
one of the five persisted values changes. `saveSettings()` writes the payload
again and updates the `originalSettings` snapshot used by
`hasUnsavedChanges`. `cancelSettings()` restores the current values from that
snapshot.

### Theme Application

`SettingsProvider` is the only owner of the document theme attribute. Its theme
effect writes to:

```text
document.documentElement[data-theme]
```

When `themeMode` is `system`, the effect reads
`window.matchMedia('(prefers-color-scheme: dark)')` and writes `dark` or `light`.
For explicit modes, it writes the selected value. The effect also listens for OS
color-scheme changes while `system` mode is active.

## Wallet State

Consumers import `useWallet()` from `src/context/WalletContext.tsx`. The provider
wraps `src/hooks/useWallet.ts` and passes in the current settings `network`.

| Field          | Meaning                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------- |
| `address`      | Connected Stellar public key, or an empty string while disconnected.                         |
| `isConnected`  | `true` when `address` is non-empty.                                                          |
| `connected`    | Legacy alias for `isConnected` exposed by `WalletProvider`.                                  |
| `isConnecting` | `true` during a connect request.                                                             |
| `error`        | Last wallet error, or `null`.                                                                |
| `network`      | `public` or `test`; any settings value other than `test` resolves to `public`.               |
| `connect`      | Requests Freighter access, validates network, stores address, and starts the wallet watcher. |
| `disconnect`   | Stops the watcher and clears local wallet state.                                             |

Wallet errors are stored rather than thrown to callers. The current error codes
are:

- `not_installed`
- `rejected`
- `network_mismatch`
- `unknown`

`src/lib/freighterClient.ts` owns the Freighter API boundary: lazy module
loading, install checks, access requests, current address lookup, network lookup,
network-name normalization, and wallet-change watcher creation.

## Toast State

`ToastProvider` exposes `useToast()` from `src/components/ToastProvider.tsx`.

| Field                         | Meaning                                         |
| ----------------------------- | ----------------------------------------------- |
| `addToast(severity, message)` | Adds a toast unless `toastsEnabled` is `false`. |
| `removeToast(id)`             | Removes one toast and clears its timer.         |
| `removeAllToasts()`           | Clears the queue and every pending timer.       |

The toast queue is in-memory only:

- At most three toasts remain visible; adding a fourth trims the oldest entry.
- Ids are generated from an incrementing ref.
- `danger` toasts default to no auto-dismiss.
- `info`, `success`, and `warning` have default timers, but `autoDismiss` from
  settings can override those timers or disable them with `off`.
- Non-danger toasts render in a polite live region; danger toasts render in an
  assertive live region.

## Where New State Should Live

Use this checklist before adding state:

| State kind                                                      | Put it in                         | Rationale                                                                              |
| --------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| Cross-route user preference that should survive reloads         | `SettingsProvider`                | It already owns `credence:settings`, defaults, save/cancel, and theme side effects.    |
| Wallet connection, Freighter errors, or wallet watcher behavior | `useWallet.ts` / `WalletProvider` | It is shared, network-dependent, and tied to Freighter lifecycle.                      |
| Global notification queue behavior                              | `ToastProvider`                   | Queue length, timer cleanup, and live-region split are provider concerns.              |
| One route's form draft, tab state, or modal state               | The route or component            | It should not rerender the whole app or persist globally.                              |
| State that should be shareable by URL/bookmark/history          | Search params or route params     | URL-owned state should survive refresh and be copyable.                                |
| Derived display state                                           | Compute from existing state       | Avoid duplicating values such as `isConnected`, toast timeout labels, or theme labels. |

When adding a new context field, update this document and the nearest test that
proves the state owner, persistence behavior, or hook contract.
