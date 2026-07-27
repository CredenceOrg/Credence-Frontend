# Offline Strategy

The Credence frontend is a standard single-page application — it has **no service
worker**, no precaching, and no `manifest.json`. Instead of intercepting network
requests at the browser level, the app handles offline scenarios at the React
layer: queries are suppressed, data is served from `localStorage`, and failures
surface actionable retry affordances.

This document is written for **contributors** who need to understand what
survives a network outage, what gets queued for later, and what the user
experiences when a cache miss occurs.

---

## What's cached

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

All reads go through `src/hooks/useLocalStorage.ts`, which is SSR-safe and
gracefully handles corrupt JSON:

```tsx
import { useLocalStorage } from '../hooks/useLocalStorage'

function SettingsPanel() {
  const [theme, setTheme] = useLocalStorage('credence:settings', defaultSettings)
  // ...
}
```

### In-memory widget cache

`src/widgetCache/WidgetCache.tsx` keeps a `Map<string, WidgetEntry>` of
dashboard widget data. Entries survive page navigation but **not page reload**
— the cache is intentionally ephemeral.

```tsx
const bondsWidget = useWidgetCache<BondRow[]>('bond:active-bonds', fetchActiveBonds)
```

See [docs/widget-cache.md](./widget-cache.md) for the full API.

---

## What's queued

### Pending transactions queue

When a user initiates a transaction (e.g. creating a bond), the transaction is
pushed to `localStorage` under `credence:pendingTransactions` immediately so
it appears in the UI without waiting for server confirmation.

```ts
// src/hooks/useTransactions.ts
function addPendingTransaction(tx: Transaction): void {
  const pending = getPendingTransactions()
  setPendingTransactions([tx, ...pending])
}
```

On the next successful server fetch, pending transactions are reconciled —
any that match confirmed server entries are removed from the queue.

The queue is **not** backed by a Background Sync API — it is a display-only
queue that survives a page reload but does not retry submissions on reconnect.

### Auto-save failures

The Settings page's `useDebouncedAutoSave` hook (`src/hooks/useDebouncedAutoSave.ts`)
ratchets through states: `idle → pending → saving → saved / error`. When the
`PATCH /settings` request fails due to a network error, the hook surfaces the
error state with a `lastSavedAt` timestamp and the caller can render a Retry
button:

```tsx
const autoSave = useDebouncedAutoSave({
  value: draft,
  save: (next, signal) => apiFetch<void>('/settings', { method: 'PATCH', body: next, signal }),
})

return <AutoSaveIndicator status={autoSave.status} onRetry={autoSave.saveNow} />
```

The local draft is **always** committed to `localStorage` via the manual Save
button (see `src/pages/Settings.tsx`), so the user's edits are never lost even
when the auto-save cannot reach the server.

**Future work** (from `docs/auto-save.md`): replay queued payloads on the
`online` event when `apiFetch` errors with a network error.

---

## What happens on cache miss

### Queries (`useQuery`)

`src/hooks/useQuery.ts` silently skips _both_ the initial fetch and every
`refetch()` when `navigator.onLine` is `false`. No error is thrown — the hook
simply returns `{ data: undefined, isLoading: false }`.

```ts
// src/hooks/useQuery.ts:46-50
const refetch = useCallback(async () => {
  if (typeof window !== 'undefined' && !window.navigator.onLine) {
    return
  }
  // ...
}, [])
```

Widgets using `useWidgetCache` keep showing the **last successfully fetched
data** even when a refresh fails — the cache never blanks out on error:

```ts
// From useWidgetCache return type:
{
  data: T | undefined     // preserved on refresh failure
  isLoading: boolean
  error: Error | undefined // set when the fetch errors, data stays
  refresh: () => void
}
```

### API client (`apiFetch`)

Network errors thrown by `fetch()` are wrapped into `ApiError` with
status `0` and the message `'Network request failed'`. Callers can
discriminate by status:

```ts
try {
  const data = await apiFetch('/some/endpoint')
} catch (err) {
  if (err instanceof ApiError && err.status === 0) {
    // Network offline or CORS issue
  }
}
```

### Offline banner

The Dashboard listens for `online` / `offline` events and shows an
inline `Banner` when the user goes offline:

```ts
// src/pages/Dashboard.tsx
{!online && (
  <Banner severity="warning">
    You are currently offline. Pull-to-refresh is disabled.
  </Banner>
)}
```

Pull-to-refresh is suppressed when offline to avoid queuing gestures
that would silently fail.

---

## Install prompt

The app listens for `beforeinstallprompt` and shows a dismissible
`Banner` once per browser session (`sessionStorage` key
`credence:install-prompt-handled`). The prompt's `event.prompt()` is
**never called**, so the browser's native install dialog is not
triggered — the banner is informational only.

```ts
// src/components/Layout.tsx:68-83
useEffect(() => {
  const handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault()
    markInstallPromptHandled()
    setShowInstallPrompt(true)
  }
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
}, [installPromptDismissed])
```

---

## Summary table

| Scenario                                               | Behaviour                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Page load while offline**                            | `useQuery` returns idle — no fetch attempted. Settings, pinned widgets, pending transactions, recent lookups served from `localStorage`. Dashboard shows offline banner. |
| **Widget refresh while offline**                       | `useWidgetCache` skips the fetch. Previous data is preserved.                                                                                                            |
| **Auto-save while offline**                            | `apiFetch` throws `ApiError(0)`. Hook surfaces `error` state with Retry button. Local draft is preserved via manual Save.                                                |
| **Transaction submission while offline**               | Not supported — the user must be online to submit to the backend. Pending transactions queue shows previously submitted items only.                                      |
| **Cache miss (no localStorage entry, no widget data)** | Component renders its empty/loading state. Default settings are used if `localStorage` key is missing or corrupt.                                                        |
| **Reconnect**                                          | The app does not automatically replay queued operations. User must retry manually (Refresh button, Retry on auto-save, etc.).                                            |
