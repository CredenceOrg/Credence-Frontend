# Offline Strategy

The Credence frontend uses a Service Worker implemented via `vite-plugin-pwa` to cache the application shell and read-only endpoints using a cache-first strategy. Write operations that fail due to network errors are automatically queued in IndexedDB and retried upon reconnection.

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

When API requests (e.g., `POST`, `PATCH`, `PUT`) fail due to a network error, the Service Worker automatically captures the payload and queues it in IndexedDB (`credence-offline-db`). Upon the `online` event, the Service Worker attempts to replay these queued operations in order.

---

## What happens on cache miss

### Queries (`useQuery`)

Queries fetch from the network first. If offline, the Service Worker serves the response from the `api-cache` if available. If neither is available, the request fails, and `useQuery` handles it as an error state.

### API client (`apiFetch`)

Network errors are still surfaced as `ApiError` with status `0`. The application continues to handle these as before to provide immediate user feedback if necessary, even while the Service Worker attempts background retries.

---

## Summary table

| Scenario                                               | Behaviour                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Page load while offline**                            | App loads from Service Worker cache. `useQuery` falls back to cached data or handles the error. Settings, etc. served from `localStorage`. |
| **Widget refresh while offline**                       | `useWidgetCache` fetches; if network fails, Service Worker serves cached response. |
| **Auto-save / Write while offline**                    | `apiFetch` fails; Service Worker captures request, queues in IndexedDB, and returns `202 Queued`. |
| **Reconnect**                                          | Service Worker detects `online` event and automatically replays queued writes from IndexedDB. |
