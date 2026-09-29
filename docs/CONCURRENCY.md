# Concurrency & Race-Safety Contract

This document defines the serialization, conflict, retry, and failure behavior that
every race-safe data-fetching hook in the Credence frontend must obey.

## Scope

The contract applies to all hooks that perform async data fetching and expose a
`refetch()` trigger:

| Hook              | Source                                                            |
| ----------------- | ----------------------------------------------------------------- |
| `useActivity`     | [`src/hooks/useActivity.ts`](../src/hooks/useActivity.ts)         |
| `useTrustScore`   | [`src/hooks/useTrustScore.ts`](../src/hooks/useTrustScore.ts)     |
| `useTransactions` | [`src/hooks/useTransactions.ts`](../src/hooks/useTransactions.ts) |
| `useAsync`        | [`src/hooks/useAsync.ts`](../src/hooks/useAsync.ts)               |

## Serialization (last-writer-wins)

Every fetch carries a monotonic `fetchId` counter. When a new fetch starts, its id
is incremented. On resolution (success or failure), the hook checks whether the id
still matches:

```
fetchId = ++counter
result = await fetch(...)
if (fetchId !== currentCounter) discard   // stale — do not apply
apply(result)
```

This guarantees that **only the latest request's result is applied to state**,
regardless of the order in which responses arrive. No mutex or queue is needed.

## Abort on supersede

A new `refetch()` call creates a fresh `AbortController` and aborts the previous
one:

```
prevController?.abort()
controller = new AbortController()
await fetch(..., { signal: controller.signal })
```

The previous request's promise rejects with `AbortError`. The hook filters out
`AbortError` — it is never surfaced as user-visible error state.

## Stale discard

When a superseded response arrives (either success or failure), it is silently
discarded:

- **Stale success:** `setData()` is skipped because `fetchId !== currentCounter`.
- **Stale error:** `setError()` is skipped for the same reason.
- **Stale AbortError:** always discarded, regardless of `fetchId`.

This prevents any overwritten state from a request the user no longer cares about.

## Clean failure

When a request fails (network error, 5xx, 4xx, etc.) and the fetch id is still
current:

1. **Data is cleared** to the default empty value (`[]` for lists, `null` for
   singletons, `undefined` for `useAsync`).
2. **Error is set** with the `ApiError` (or a wrapped unexpected error).
3. **Partial state is never leaked** — `setData` and `setError` are only called
   when the component is still mounted and the fetch id matches.

This ensures rejected, failed, or invalid operations leave **no unauthorized or
partial state**.

## Retry contract

After an error, calling `refetch()`:

1. **Clears the error** (`setError(null)`)
2. **Aborts** any in-flight request
3. **Starts a fresh fetch** with a new `fetchId`

On success, data is populated and error remains `null`. On failure, data is cleared
again and the new error is surfaced.

```tsx
// Usage pattern
const { data, error, refetch } = useTrustScore(address)

// After an error:
{
  error && <button onClick={refetch}>Try again</button>
}
// → clears error → starts new request → applies result or clears again
```

## Repeated requests

Calling `refetch()` multiple times in rapid succession:

1. Each call aborts the previous request.
2. Each call increments the fetch id.
3. Only the **last** request's result is applied.

This is safe — no duplicate state, no partial leaks, no accumulated errors.

## Unmount safety

Every hook sets `mountedRef = false` on unmount. All state updates check
`mountedRef.current` before applying:

```
return () => {
  mountedRef.current = false
  controller?.abort()
}
```

This prevents:

- "Can't perform a React state update on an unmounted component" warnings.
- Stale data appearing after navigation.
- Memory leaks from lingering promises.

## Acceptance criteria coverage

| Criterion                            | How it is satisfied                                                           |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Serialization / conflict behavior    | `fetchIdRef` monotonic counter; last-writer-wins                              |
| Retry contract explicit              | Documented above; `refetch()` clears error + starts fresh                     |
| No partial/unauthorized state        | Data cleared on failure; `mountedRef` guards all updates                      |
| Stale / repeated / failed operations | Aborted, discarded, or cleared — never applied                                |
| Regression coverage                  | `useActivity.test.ts` (17 tests), `serialization-contract.test.ts` (11 tests) |

## Test coverage

The following test files exercise the contract at the hook integration boundary:

- **`src/hooks/useActivity.test.ts`** — 17 tests covering:
  - Idle state, empty address, success, error transitions
  - Abort on supersede, abort on unmount
  - Stale response discard, three-concurrent-request ordering
  - AbortError suppression, unexpected error wrapping
  - Clean failure state, retry after error
  - Correct API endpoint, whitespace address rejection

- **`src/hooks/serialization-contract.test.ts`** — 11 tests covering:
  - `useTrustScore`: abort on supersede, clean failure, retry clears error, AbortError
  - `useTransactions`: latest-response-wins, clean failure
  - `useActivity`: three-concurrent ordering, failure clears previous success
  - `useAsync`: stale data discard, retry clears error

## Operational limitations

- **No deduplication across components:** Two separate hook instances (e.g. in
  different components) each maintain their own `fetchId` and `AbortController`.
  They do not share requests. If you need request sharing (e.g. SWR / React Query
  caching), add a shared cache layer on top.
- **No automatic retry:** The contract defines a manual retry via `refetch()`. There
  is no exponential backoff or automatic retry loop. Add one at the call site if
  needed.
- **No optimistic updates:** The hooks are read-only. Mutations should use a separate
  pattern (e.g. `apiFetch` + `refetch()`).

## Migration / rollback

- **No migration required.** The new `useActivity` hook is additive. Existing consumers
  of `SAMPLE_ACTIVITY` can optionally switch to `useActivity` at their own pace.
- **Rollback:** Remove the `useActivity` import and revert to `SAMPLE_ACTIVITY` or
  local state.
