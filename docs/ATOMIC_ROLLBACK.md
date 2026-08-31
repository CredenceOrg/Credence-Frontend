# Wallet & Session Atomic Rollback

This document describes the atomic rollback and compensation mechanisms added to the wallet connection and session management flows (issue #1056).

## Invariant

After any wallet operation — connect, disconnect, reconnect, or session expiry — the application state must be **internally consistent**:

1. **No partial state:** If a connect fails partway through, `address`, `error`, `isConnected`, and `network` reflect a clean terminal state (either disconnected or the previous valid session).
2. **No stale commits:** Operations superseded by a newer operation (e.g., a second connect arriving before the first finishes) must not commit their results.
3. **No unauthorized access:** A rejected or failed connection must not leave wallet state in a connected-looking state.
4. **No orphaned side-effects:** Background watchers are started only after all synchronous state is committed, and are always cleaned up on disconnect or failure.

## Mechanisms

### Generation Guard (`connectGenRef`)

Every call to `connect()` increments a React ref counter (`connectGenRef.current++`). After each async boundary (Freighter RPC calls), the function checks whether its generation matches the current ref value. If not, a newer connect (or disconnect) has started, and the stale operation bails out without committing.

This prevents:
- Two concurrent connects both committing address/network (the "race" problem).
- A disconnect finishing after a connect has already started but before it commits (the "disconnect-during-connect" problem).

### Clean Start on Connect

`connect()` resets `address` and `error` to empty strings at the start of the synchronous chain, before any async work. This ensures the UI immediately reflects that a new connection attempt is in progress, and prevents stale error messages from lingering.

### Watcher Cleanup on Disconnect

When disconnecting, the `freighterConnectionWatcher` unsubscribe function is captured and called during the async chain — before address/error are cleared. This prevents:
- A stale watcher event (from the old connection) being delivered after disconnect.
- The watcher continuing to fire events after the user has disconnected.

### Reauth Generation Guard

When a session reauth timer fires, it checks a `reauthGenRef` against the current generation before committing. If a disconnect or new connect has bumped the generation, the reauth is silently discarded.

### Compensatory State on Failure

Each error path in `connect()` explicitly sets the three state variables (`address`, `error`, `isConnected`) to appropriate terminal values:

| Failure point | `address` | `error` | `isConnected` |
|---|---|---|---|
| Freighter not installed | `''` | `'not_installed'` | `false` |
| User rejected | `''` | `'rejected'` | `false` |
| Network mismatch | `''` | `'network_mismatch'` | `false` |
| Unknown error | `''` | `'unknown'` | `false` |
| Watcher failed to start | `''` (rolled back) | `''` | `false` |

### Logout Ordering

`WalletContext.logout()` now clears the session **before** clearing wallet state. This ensures the session token is revoked (preventing use of stale auth) before the UI reflects the disconnected state.

## Failure Behavior

| Scenario | Before #1056 | After #1056 |
|---|---|---|
| Two concurrent connects | Both could commit; last writer wins unpredictably | Only the latest commits; earlier one bails out via generation guard |
| Disconnect during connect | Disconnect clears state, then connect overwrites with stale address | Connect detects stale generation and discards its result |
| Connect fails mid-chain | Partial state may remain (address set but error not) | All error paths set complete terminal state |
| Reauth after disconnect | Reauth commits state even though user disconnected | Reauth detects generation mismatch and discards |
| Watcher event after disconnect | Stale event could set address after disconnect | Watcher is unsubscribed before state is cleared |
| Rapid repeated connects | Race conditions between async chains | Generation guard ensures only the latest attempt's result is committed |
| Session expiry during connect | Expiry clears session, connect overwrites with stale wallet state | Generation guard prevents stale commits after expiry |

## Compatibility

- **Public API unchanged:** `useWallet()` still returns `{ address, error, isConnected, network, connect, disconnect }`. No consumer changes required.
- **WalletContext API unchanged:** `{ wallet, connectWallet, disconnectWallet, isReconnecting, logout }`. The `logout` function now also handles session revocation internally, but the external signature is identical.
- **Existing error types preserved:** `'not_installed'`, `'rejected'`, `'network_mismatch'`, `'unknown'` remain the same string literal types.
- **No database migration:** All changes are client-side state management. No Convex schema changes.

## Rollback / Migration Considerations

This is a client-side-only change. There are:
- No database migrations required.
- No contract/ABI changes.
- No queue or event system modifications.
- No API endpoint changes.

The change is fully backward-compatible. Deploying this change does not require any coordination with backend services.

## Limitations

1. **React batching:** The generation guard relies on React's microtask-based batching. In extremely rapid sequences (multiple connects within a single synchronous frame), React may batch multiple `connect()` calls, and only the last one's effects will run. This is the desired behavior.

2. **Concurrent disconnect+connect:** If `disconnect()` and `connect()` are called in the same synchronous frame, the generation guard ensures connect's state will win (since it bumps the generation last). The disconnect's watcher cleanup still runs correctly.

3. **No server-side session invalidation:** The client-side atomic rollback ensures UI consistency, but does not coordinate with server-side session state. If the server maintains its own session, that is handled by the separate session revocation call in `logout()`.

4. **Stale Freighter responses:** If Freighter returns a response after a very long delay (e.g., user took 30 seconds to approve), the generation guard will correctly discard it.

## Security Assumptions

1. **Freighter is trusted:** The Freighter wallet extension is assumed to be honest. If Freighter itself is compromised, all bets are off regardless of client-side guards.

2. **No secret key exposure:** All wallet operations are performed via the Freighter API, which handles key management internally. The application never sees or stores private keys.

3. **Session tokens are short-lived:** The session revocation in `logout()` is a best-effort defense. Short-lived tokens limit the window of exploitation if revocation fails.

4. **Client-side only:** These guards protect against client-side state inconsistencies. They do not protect against server-side attacks (CSRF, token theft, etc.).

---

# Bond & Trust-Score Mutation Atomic Rollback

This section documents the atomic rollback and compensation mechanisms added to bond creation, bond withdrawal, and trust-score lookup mutations (issue #1065).

## Invariant

After any bond or trust-score mutation — regardless of network, wallet, or process failure — the observable state must be **internally consistent**:

1. **No partial state:** A mutation that does not reach a successful terminal state must leave `status: 'error'` (or `'cancelled'`), never `'submitting'` or `'pending'`, in persistent storage.
2. **No double-submission:** A network- or wallet-committed transaction must never be re-submitted, even if the process dies between the network call returning and the success write completing.
3. **No stale commits:** Concurrent or repeated submissions for the same parameters are collapsed to a single execution.
4. **No unauthorised partial state:** A rejected, invalid, or rate-limited mutation must not leave a partially-updated balance, trust score, or transaction record.
5. **Clear failure result:** Every failure exposes a typed, user-surfaceable `MutationError` with `retryable`, `type`, and optional `retryAfterMs` fields.

## Mechanisms

### Two-Phase Commit for Bond Writes (`MutationRecoveryEngine`)

Bond create and withdraw executions use a two-phase write strategy in `executeOperationAttempt`:

1. **Phase 1 — Commit the hash.** As soon as the wallet/network call returns a `txHash`, the attempt record is immediately written with `status: 'committed'` and the hash is persisted in `localStorage`. This write is small and synchronous relative to the overall operation.

2. **Phase 2 — Promote to success.** Only after Phase 1 completes is the operation record updated to `status: 'success'` with `finalTxHash`.

If the process is killed between Phase 1 and Phase 2, `recoverSubmittingOperation` detects an attempt whose `status` is `'committed'` and promotes it directly to `success` **without re-submitting**. This prevents double-submission under any crash scenario.

### Fresh Attempt-Count Read (Retry Guard)

After writing a failed attempt record, the engine reads the operation back from storage before deciding whether to retry. Previously, the retry eligibility check used the stale `operation.attempts.length` value captured in the closure before the attempt was appended, which could allow one extra retry past `maxAttempts`. The fix reads the fresh count from the authoritative storage state.

### In-Flight Deduplication Guard (`useApiMutation`)

`useApiMutation` now maintains a synchronous `inFlightRef` boolean. Because JavaScript is single-threaded before the first `await`, the check-and-set is race-free:

- The first call that reads `false` atomically sets it to `true` and proceeds.
- Any subsequent call that reads `true` before the first call settles receives the same in-flight `Promise` without dispatching a second network request.
- The guard is cleared in the `finally` block after all side-effects (`onSettled`) have completed.

This ensures optimistic UI updates, toast notifications, and balance refreshes are triggered exactly once per user action regardless of double-click or re-render races.

### Optimistic Rollback (`useApiMutation`)

`onMutate` can call `setData(updater)` to apply an optimistic state change. The previous data snapshot is captured in `previousDataRef` before any async work. If `mutationFn` throws, `rollback()` restores `data` to the snapshot before `onError` and `onSettled` are called, so the UI never displays an orphaned optimistic value.

### Injectable Executors (Testability)

The live network calls at the mutation boundary — `submitCreateBond`, `submitWithdrawBond`, and the trust-score `apiFetch` — are now accessed through injectable interfaces:

```ts
setBondExecutors({ createBond, withdrawBond })  // swap in test doubles
setTrustScoreExecutor(executor)                  // swap in test doubles
```

Both functions return the previous executor so tests can restore the live implementation with `try/finally`. The production path is unchanged — the module-level defaults point at the real implementations.

### Storage Deduplication (`createMutationOperation`)

Before creating a new `MutationOperation`, the storage layer checks for an existing operation with the same deterministic `requestHash` that has not yet reached `status: 'success'`. If one exists it is returned directly (`isNewOperation: false`), preventing duplicate entries for the same logical request.

### Validation Boundary (`mutationGuard.ts`)

Input validation via `validateBondAmount` and `validateTrustScoreAddress` runs synchronously before any expensive work (wallet interaction, rate-limit consumption, network request). Invalid input produces a `validation` error with `retryable: false` and no side-effects.

## Failure Behavior

| Scenario | Before #1065 | After #1065 |
|---|---|---|
| Process killed after network call, before success write | Operation stuck in `'submitting'`; re-submitted on next load | `'committed'` attempt detected; promoted to `success` without re-submission |
| Transient network failure (N retries) | Stale `attempts.length` could allow N+1 retries | Fresh count read from storage; exactly N retries |
| Wallet rejection | Generic error, no `retryable` flag | `wallet_rejected` error, `retryable: false` |
| Two concurrent `mutateAsync()` calls | Both execute; optimistic state applied twice | Second call receives the in-flight promise; `mutationFn` called once |
| Optimistic update + network failure | Optimistic state remains visible | Rolled back to pre-optimistic snapshot before `onError` |
| Invalid amount / empty address | Reaches the network; may leave partial state | Rejected at validation boundary; no network call, no storage side-effect |
| Repeated submission with same params | Creates duplicate operations in storage | Deduplicated by `requestHash`; single operation record |
| Trust-score `ApiError` 5xx | Re-classified as `'generic'` (status code lost) | Preserved as `'backend'` with original `code` |

## Compatibility

- **`useApiMutation` public API unchanged:** `{ data, error, isPending, isError, isSuccess, status, mutate, mutateAsync, reset }`. The new `deduplicateInFlight` option defaults to `true`; existing callers that do not pass it are unaffected.
- **`MutationRecoveryEngine` public API unchanged:** `recoverOperation`, `cancelRecovery`, `cancelAllRecoveries`, `getRecoveryStatus`, `recoverPendingOperations`.
- **`setBondExecutors` / `setTrustScoreExecutor`** are new exports used only in tests; no production caller is required to call them.
- **Storage schema unchanged:** The `'committed'` status is written as a transient intermediate value on the `MutationAttempt.status` field. The `MutationStatus` union type (`'idle' | 'pending' | 'submitting' | 'success' | 'error' | 'cancelled'`) on `MutationOperation.status` is unchanged; `'committed'` only ever appears on an individual `MutationAttempt`.
- **No breaking changes to localStorage keys** or schema version. Existing v2 storage from before this change continues to read correctly.

## Rollback / Migration Considerations

- **Client-side only:** All changes are within the frontend. No backend, contract, queue, or schema changes are required.
- **No storage migration needed:** Existing operations are read and handled correctly by the updated recovery logic.
- **Downgrade safety:** If a deployment is rolled back, the old code will read any `'committed'` attempt as an unrecognised status and treat the operation as `'submitting'`— which was the previous worst-case recovery path (wait for timeout, then retry). No data is lost; the user may see an unnecessary retry on a very short rollback window.

## Operational Limitations

1. **localStorage availability:** All persistent state relies on `localStorage`. In private-browsing mode or when storage is full, writes fail gracefully (logged as warnings) and in-memory state remains authoritative for the session. Recovery across page reloads is unavailable in those environments.

2. **Single-device only:** The mutation storage is per-browser. A user who submits a bond on device A and then opens the app on device B will not see the pending operation on device B until the backend confirms and the balance refreshes.

3. **Clock skew:** Stale-operation cleanup and recovery timeout checks use `Date.now()`. Significant clock skew between the stored timestamp and the current time could cause premature cleanup or extended wait periods, but not incorrect commits.

## Security Assumptions

1. **No secrets in storage:** `requestMetadata` stored in `localStorage` contains only non-sensitive request parameters (amounts, bond IDs, addresses). Private keys, session tokens, and signatures are never stored.

2. **Idempotency keys are local:** The `requestHash` deduplication key is computed client-side from request parameters. It prevents accidental double-submission within a single browser session but is not a cryptographic guarantee against server-side duplicates. Server-side idempotency keys should be used for financial operations.

3. **Injectable executors are test-only:** `setBondExecutors` and `setTrustScoreExecutor` are not guarded by an environment check. Callers in production code must not call them. The functions are intentionally not re-exported from `src/api/index.ts`.
