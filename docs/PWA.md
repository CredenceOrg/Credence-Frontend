# Offline Strategy

The Credence frontend uses a Service Worker implemented via `vite-plugin-pwa` to cache the application shell and read-only endpoints. Write requests pass through untouched. When a write fails because the network is unavailable, the API client surfaces a `network_error`; writes are never queued or replayed implicitly.

---

## What's cached

### Service Worker Cache
- **App Shell**: HTML, CSS, JavaScript, and static assets are precached by the service worker.
- **Read-only Endpoints**: API `GET` requests are cached using a `NetworkFirst` strategy to provide fresh data when online and cached data when offline.

### localStorage

| Key                               | Module                            | What's stored                                            | Persists across                 |
| --------------------------------- | --------------------------------- | -------------------------------------------------------- | ------------------------------- |
| `credence:settings`               | `src/context/SettingsContext.tsx` | Theme, network preference, display options, toast config | Tabs, windows, browser restarts |
| `credence:pendingTransactions`    | `src/hooks/useTransactions.ts`    | User-initiated transactions not yet confirmed on chain   | Page reloads                    |
| `credence:onboarding:step`        | `src/pages/Dashboard.tsx`         | Current onboarding tour step                             | Page reloads                    |
| `credence:onboarding:onboardedAt` | `src/pages/Dashboard.tsx`         | Completion timestamp                                     | Page reloads                    |
| `credence:changelog:last-seen-id` | `src/hooks/useProductUpdates.ts`  | Last-seen changelog entry ID                             | Page reloads                    |
| `credence:pinnedWidgets`          | `src/hooks/usePinnedWidgets.ts`   | Pinned dashboard widgets configuration                   | Page reloads                    |
| `credence:recent-lookups`         | `src/pages/TrustScore.tsx`        | Recent trust-score address lookups                       | Page reloads                    |

---

## What's queued

### Pending transactions queue

When a user initiates a transaction (e.g. creating a bond), the transaction is
pushed to `localStorage` under `credence:pendingTransactions` immediately so
it appears in the UI without waiting for server confirmation.

On the next successful server fetch, pending transactions are reconciled —
any that match confirmed server entries are removed from the queue.

### Write operations

API writes (`POST`, `PATCH`, `PUT`, and other non-`GET` requests) are never queued. The service worker does not intercept them, so network failures reach the API client and are surfaced as `ApiError` with code `network_error` and status `0`.

This is intentional for financial operations: returning a synthetic `202` could make the UI report a write as successful even though the server never received it. Replaying later without the original idempotency and identity headers could duplicate a mutation or apply it under a different signed-in account. The service worker deletes the legacy `credence-offline-db` on activation so stale writes from earlier versions are never replayed.

---

## What happens on cache miss

### Queries (`useQuery`)

Queries fetch from the network first. If offline, the Service Worker serves the response from the `api-cache` if available. If neither is available, the request fails, and `useQuery` handles it as an error state.

### API client (`apiFetch`)

Network errors are surfaced as `ApiError` with code `network_error` and status `0`, allowing the application to provide immediate feedback. No background retries are attempted for writes.

---

## Summary table

| Scenario                                               | Behaviour                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Page load while offline**                            | App loads from Service Worker cache. `useQuery` falls back to cached data or handles the error. Settings, etc. served from `localStorage`. |
| **Widget refresh while offline**                       | `useWidgetCache` fetches; if network fails, Service Worker serves cached response. |
| **Auto-save / Write while offline**                    | The request passes through; `apiFetch` surfaces a `network_error` and the write is not queued. |
| **Reconnect**                                          | Failed writes remain failed; the user or application must initiate a new request. |
