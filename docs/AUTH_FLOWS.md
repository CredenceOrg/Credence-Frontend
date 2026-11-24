# Authentication Flows

**Audience:** Frontend contributors  
**Last reviewed:** 2026-07-26

Credence does not use username/password authentication. A user's Stellar wallet (Freighter browser extension) **is** their identity. This document describes the three session-lifecycle flows: **login (connect)**, **logout (disconnect)**, and **session refresh (re-authentication)**.

All three flows live in two layers:

| Layer | File | Responsibility |
|---|---|---|
| Low-level Freighter API | `src/lib/freighterClient.ts` | Browser-only wrappers around `@stellar/freighter-api` |
| React state machine | `src/hooks/useWallet.ts` + `src/context/WalletContext.tsx` | Exposes `connect`, `disconnect`, `reauth`, and `isReauthRequired` to the component tree |

---

## Login (Connect Wallet)

A login is a wallet connection. No credentials leave the browser ÔÇö Freighter holds the private key and only returns a public address after the user approves.

```mermaid
sequenceDiagram
    actor User
    participant UI as ConnectWalletModal
    participant Hook as useWallet
    participant Free as Freighter Extension

    User->>UI: Click "Connect Wallet"
    UI->>Hook: connect()
    Hook->>Free: checkFreighterInstalled()
    Free-->>Hook: { isConnected: true }

    Hook->>Free: requestFreighterAccess()
    Note right of Free: Freighter popup<br/>asks for approval
    User->>Free: Approve
    Free-->>Hook: { address: "G..." }

    Hook->>Hook: setAddress("G...")
    Hook->>Free: fetchFreighterNetwork()
    Free-->>Hook: "public"

    alt Network matches settings
        Hook->>Hook: startWatcher()
        Hook-->>UI: { isConnected: true, address: "G..." }
        UI->>UI: Auto-close modal
    else Network mismatch
        Hook->>Hook: setError("network_mismatch")
        Hook-->>UI: { error: { code: "network_mismatch" } }
        UI-->>User: Show error message
    end
```

**Key code paths:**

- `src/hooks/useWallet.ts:76` ÔÇö `connect()` entry point
- `src/lib/freighterClient.ts:66` ÔÇö `requestFreighterAccess()` prompts the user
- `src/components/ConnectWalletModal.tsx:43` ÔÇö auto-closes on success

### Silent session restore

On every page load, `useWallet` tries to restore a prior session without prompting the user:

```mermaid
sequenceDiagram
    participant App as App Mount
    participant Hook as useWallet
    participant Free as Freighter Extension

    App->>Hook: useEffect (mount)
    Hook->>Free: checkFreighterInstalled()
    Free-->>Hook: true

    Hook->>Free: fetchFreighterAddress()
    Note right of Free: Reads already-authorised<br/>address ÔÇö no popup
    alt Previously authorised
        Free-->>Hook: "G..."
        Hook->>Hook: setAddress("G...")
        Hook->>Hook: startWatcher()
    else Not authorised
        Free-->>Hook: null
        Hook-->>App: Stay disconnected
    end
```

**Key code path:** `src/hooks/useWallet.ts:132`

---

## Logout (Disconnect)

A logout clears all local wallet state and stops the address watcher. It can be triggered manually by the user or automatically after inactivity.

```mermaid
sequenceDiagram
    actor User
    participant UI as App UI
    participant WC as WalletContext
    participant Hook as useWallet
    participant Nav as React Router

    alt Manual logout
        User->>UI: Click "Disconnect"
        UI->>WC: disconnect()
    else Auto-logout (inactivity)
        Note over WC: 15 min idle +<br/>60s warning expired
        WC->>WC: handleLogout()
    end

    WC->>Hook: disconnect()
    Hook->>Hook: stopWatcher()
    Hook->>Hook: setAddress("")
    Hook->>Hook: setNetwork(null)
    Hook->>Hook: setError(null)
    WC->>WC: setLastReauthTime(null)
    WC->>Nav: navigate("/signin")
    WC->>WC: addToast("warning", "Logged out due to inactivity.")
```

**Key code paths:**

- `src/hooks/useWallet.ts:124` ÔÇö `disconnect()` clears local state
- `src/context/WalletContext.tsx:69` ÔÇö `handleLogout()` orchestrates the full logout including navigation and toast

---

## Session Refresh (Re-authentication)

The app enforces a configurable re-authentication threshold. When a sensitive action (e.g. viewing a USDC balance) is attempted and the threshold has elapsed since the last re-auth, the user is prompted to reconnect their wallet before proceeding.

### Threshold check

```mermaid
sequenceDiagram
    participant Comp as Component (e.g. useUsdcBalance)
    participant WC as WalletContext
    participant Set as SettingsContext

    Comp->>WC: isReauthRequired()
    WC->>Set: reauthThresholdMinutes (default: from settings)

    alt Not connected or no reauth time
        WC-->>Comp: true
    else Elapsed ÔëÑ threshold
        WC-->>Comp: true
    else Elapsed < threshold
        WC-->>Comp: false
    end
```

**Key code path:** `src/context/WalletContext.tsx:87`

### Re-authentication prompt

When `isReauthRequired()` returns `true`, a `ReauthPrompt` dialog is displayed. The user must click "Reconnect Wallet" to trigger the Freighter access prompt again.

```mermaid
sequenceDiagram
    actor User
    participant Prompt as ReauthPrompt
    participant WC as WalletContext
    participant Free as Freighter Extension

    Prompt->>WC: reauth()
    WC->>Free: wallet.connect()
    Free->>User: Freighter popup ÔÇö approve access
    User->>Free: Approve
    Free-->>WC: { address: "G..." }
    WC->>WC: setLastReauthTime(Date.now())
    WC-->>Prompt: Resolved
    Prompt->>Prompt: Close dialog
```

**Key code paths:**

- `src/context/WalletContext.tsx:81` ÔÇö `reauth()` reconnects and resets timer
- `src/components/ReauthPrompt.tsx:51` ÔÇö dialog confirm handler

### Where re-auth is enforced

- **Balance fetches** (`src/hooks/useUsdcBalance.ts:80`) ÔÇö throws `SessionReauthRequiredError` when threshold elapsed
- **Bond creation** (`src/components/CreateBondFlow.tsx:81`) ÔÇö shows `ReauthPrompt` before proceeding

---

## Session Timeout (Inactivity Logout)

Independently of the re-auth threshold, the app enforces a hard idle timeout. After **15 minutes** of no user activity (mouse, keyboard, touch, scroll), a **60-second warning** is shown. If the user does not interact with the warning within that window, they are logged out.

```mermaid
sequenceDiagram
    participant User
    participant Idle as useIdleTimeout
    participant WC as WalletContext
    participant Modal as SessionTimeoutModal
    participant Nav as React Router

    Note over Idle: 14 min of inactivity
    Idle->>WC: onIdle (first timer)
    WC->>WC: setShowWarning(true)
    WC->>Modal: open={true}, timeLeft=60

    alt User interacts (mousemove, keypress, etc.)
        User->>Idle: Activity event
        Idle->>WC: onActivity
        WC->>WC: setShowWarning(false)
        WC->>Modal: open={false}
        Note over Idle: Timer resets
    else No interaction
        Note over Modal: 60s countdown expires
        Idle->>WC: onIdle (second timer)
        WC->>WC: handleLogout()
        WC->>Nav: navigate("/signin")
        WC->>WC: addToast("warning", "Logged out due to inactivity.")
    end
```

**Key code paths:**

- `src/context/WalletContext.tsx:96` ÔÇö first idle timer (14 min)
- `src/context/WalletContext.tsx:111` ÔÇö second idle timer (60s warning window)
- `src/components/SessionTimeoutModal.tsx` ÔÇö countdown UI

---

## Cross-tab wallet session synchronization

Wallet session boundaries are shared across open tabs through `src/lib/crossTab.ts`.
The app prefers `BroadcastChannel` and falls back to the browser `storage` event
when BroadcastChannel is unavailable.

The originating tab publishes one of three versioned messages:

- `disconnect` when the user disconnects the wallet
- `idle-lock` when the inactivity warning expires
- `network-change` when the selected network changes

Every receiving tab ignores messages carrying its own tab id. A remote message
runs the local teardown path: pending re-authentication is cancelled, the API
identity epoch advances, the wallet disconnects, app-local storage is cleared,
an audit event is recorded with the originating correlation id, and the user is
sent to `/signin`. Receivers do not republish remote messages, preventing
cross-tab echo loops.

If BroadcastChannel is unavailable, the same message envelope is written to a
dedicated local-storage key. Other tabs receive it through the `storage` event;
the originating tab does not receive its own storage event.

## Related documents

- [Wallet Integration](./WALLET_INTEGRATION.md) ÔÇö `useWallet` hook API, connection state machine, UX contract
- [Cookie-Secret Rotation Runbook](./COOKIE_SECRETS.md) ÔÇö Backend session/CSRF cookie secret lifecycle
- [Security Headers](./SECURITY_HEADERS.md) ÔÇö Production HTTP header configuration
