# State Management

Credence Frontend uses three core context providers to manage shared client state. This guide explains what each context owns, how persistence works, the provider nesting order, and when to add new state.

## Overview

| Context      | File                               | Hook            | Persists                  | Scope                                                     |
| ------------ | ---------------------------------- | --------------- | ------------------------- | --------------------------------------------------------- |
| **Settings** | `src/context/SettingsContext.tsx`  | `useSettings()` | Yes (`credence:settings`) | Theme, network, address display, toast preferences        |
| **Wallet**   | `src/context/WalletContext.tsx`    | `useWallet()`   | Session only              | Stellar wallet connection state and Freighter integration |
| **Toast**    | `src/components/ToastProvider.tsx` | `useToast()`    | No                        | Notification queue and dismiss timers                     |

---

## 1. SettingsContext — User Preferences & Persistence

**File:** [`src/context/SettingsContext.tsx`](../src/context/SettingsContext.tsx)

### State Shape

```typescript
interface SettingsState {
  // Theme mode: 'light', 'dark', or 'system' (respects OS preference)
  themeMode: 'light' | 'dark' | 'system'

  // Network: 'public' or 'test' (Stellar network)
  network: string

  // Address display: 'short' or other variants
  addressDisplay: string

  // Global toggle: enable/disable all toasts
  toastsEnabled: boolean

  // Auto-dismiss duration: '5s', 'off', or other duration strings
  autoDismiss: string

  // Flag: true if any field differs from saved state
  hasUnsavedChanges: boolean

  // Setters (update in-memory state without persisting yet)
  setThemeMode(m: 'light' | 'dark' | 'system'): void
  setNetwork(n: string): void
  setAddressDisplay(s: string): void
  setToastsEnabled(b: boolean): void
  setAutoDismiss(s: string): void

  // Persistence actions
  saveSettings(): void // Persist all fields to localStorage
  cancelSettings(): void // Discard changes, revert to last saved state
}
```

### Public Hook

```typescript
const { themeMode, network, addressDisplay, toastsEnabled, autoDismiss, hasUnsavedChanges } =
  useSettings()
```

### Persistence Mechanism

**Storage key:** `credence:settings` in `localStorage`

**Stored payload:**

```json
{
  "themeMode": "light",
  "network": "public",
  "addressDisplay": "short",
  "toastsEnabled": true,
  "autoDismiss": "5s"
}
```

**Load behavior:**

- On mount, reads `credence:settings` from `localStorage`
- If key does not exist or JSON parsing fails, falls back to defaults (no error thrown)
- Defaults: `themeMode: 'system'`, `network: 'public'`, `addressDisplay: 'short'`, `toastsEnabled: true`, `autoDismiss: '5s'`

**Save behavior:**

- Call `saveSettings()` to persist current state to `localStorage`
- Automatically persists on every field change (see [Sync Effect](#sync-effect))
- Silently ignores write errors (quota exceeded, private browsing, etc.)

### Theme Application

The `themeMode` value is applied to the document root as `data-theme`:

- When `themeMode === 'system'`: reads OS preference via `matchMedia('(prefers-color-scheme: dark)')` and sets `data-theme` to `'light'` or `'dark'`
- When `themeMode === 'light'` or `'dark'`: sets `data-theme` directly
- On OS preference change (only when `themeMode === 'system'`), re-evaluates and updates the DOM

**Selector example:**

```css
[data-theme='light'] .button {
  background: white;
}
[data-theme='dark'] .button {
  background: #333;
}
```

### Legacy Migration

A one-time migration removes the orphaned `'theme'` localStorage key (from the legacy ThemeToggle component) to prevent conflicts.

### Sync Effect

```typescript
useEffect(() => {
  const payload = { themeMode, network, addressDisplay, toastsEnabled, autoDismiss }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}, [themeMode, network, addressDisplay, toastsEnabled, autoDismiss])
```

This effect runs whenever _any_ setting changes, ensuring the saved state stays in sync with in-memory state.

---

## 2. WalletContext — Stellar Wallet Connection

**File:** [`src/context/WalletContext.tsx`](../src/context/WalletContext.tsx)
**Hook implementation:** [`src/hooks/useWallet.ts`](../src/hooks/useWallet.ts)

### State Shape

```typescript
interface WalletContextValue {
  // Connected Stellar public key (56-char address starting with 'G'), or empty string
  address: string

  // True when a wallet address is available
  isConnected: boolean

  // Legacy alias for isConnected (kept for backward compatibility)
  connected: boolean

  // True while a connect request is in flight
  isConnecting: boolean

  // Last connection error, if any; null otherwise
  error: WalletError | null

  // Request Freighter access and store the returned public key
  connect(): Promise<void>

  // Clear the local wallet session (does not disconnect Freighter)
  disconnect(): void

  // Active Credence network from settings ('public' or 'test')
  network: CredenceNetwork
}

interface WalletError {
  code: 'not_installed' | 'rejected' | 'network_mismatch' | 'unknown'
  message: string
}
```

### Public Hook

```typescript
const { address, isConnected, connected, isConnecting, error, connect, disconnect, network } =
  useWallet()
```

### Wallet Integration

The wallet context wraps the `useWallet()` hook from `src/hooks/useWallet.ts`, which manages Freighter browser extension integration:

- **On mount:** restores the previous session if available (reads from Freighter's storage)
- **`connect()`:** requests Freighter access, verifies network matches Credence settings, starts a watcher for address changes
- **`disconnect()`:** clears local session (does not uninstall or disconnect Freighter)
- **Network mismatch:** if Freighter is on Mainnet but Credence is set to Testnet (or vice versa), sets an error and prevents connection
- **Error handling:** catches missing extension, user rejection, network mismatch, and unknown errors

### Network Synchronization

The `network` field is read from `useSettings()` at provider initialization. When the user changes `network` in Settings, the wallet verifies that Freighter is on the same network:

```typescript
const { network } = useSettings() // From SettingsContext
const wallet = useWallet(network) // Passed to hook
```

If there is a mismatch, `error.code === 'network_mismatch'` and the user must either:

- Switch Freighter to the correct network, or
- Change the Credence network setting to match Freighter

---

## 3. ToastProvider — Notification Queue

**File:** [`src/components/ToastProvider.tsx`](../src/components/ToastProvider.tsx)

### State Shape

```typescript
type ToastSeverity = 'info' | 'success' | 'warning' | 'danger'

interface ToastData {
  id: string // Unique identifier
  severity: ToastSeverity // Message type
  message: string // User-facing text
}

interface ToastContextValue {
  // Add a toast to the queue
  addToast(severity: ToastSeverity, message: string): void

  // Remove a toast by ID
  removeToast(id: string): void

  // Clear all toasts
  removeAllToasts(): void
}
```

### Public Hook

```typescript
const { addToast, removeToast, removeAllToasts } = useToast()

// Usage
addToast('success', 'Bond created')
addToast('warning', 'Network slow')
addToast('danger', 'Connection failed')
```

### Toast Behavior

**Queueing:**

- Maximum 3 toasts displayed at once
- When a 4th is added, the oldest is removed (FIFO)

**Auto-dismiss:**

- Default timeouts per severity:
  - `info`: 5 seconds
  - `success`: 5 seconds
  - `warning`: 8 seconds
  - `danger`: 0 seconds (manual dismiss only)
- Can be overridden by the `autoDismiss` setting from `useSettings()`

**Auto-dismiss override:**

- `autoDismiss === 'off'`: all toasts stay until manually dismissed
- `autoDismiss === '10s'`: all toasts (except `danger`) dismiss after 10 seconds
- Parsed as a duration string with format `'Xs'` (e.g., `'3s'`, `'15s'`)

**Accessibility:**

- Polite toasts (`info`, `success`, `warning`) are announced in a `aria-live="polite"` region when the screen reader is idle
- Danger toasts are announced in a `aria-live="assertive"` region and interrupt immediately

**Settings Dependency:**

- Reads `toastsEnabled` and `autoDismiss` from `useSettings()`
- If `toastsEnabled === false`, `addToast()` is a no-op (no toast is queued)
- Uses a ref to avoid recreating `addToast` on every setting change

---

## Provider Nesting Order

The provider tree is composed in `src/App.tsx`. **The nesting order is load-bearing.**

```typescript
<BrowserRouter>
  <SettingsProvider>
    <WalletProvider>
      <ToastProvider>
        <ErrorBoundary>
          <Suspense>
            <Routes>…</Routes>
          </Suspense>
        </ErrorBoundary>
      </ToastProvider>
    </WalletProvider>
  </SettingsProvider>
</BrowserRouter>
```

**Why this order matters:**

1. **SettingsProvider must be outermost** — both WalletProvider and ToastProvider depend on it:
   - `ToastProvider` calls `useSettings()` to read `toastsEnabled` and `autoDismiss`
   - `WalletProvider` calls `useSettings()` to read the current `network`

2. **WalletProvider before ToastProvider** — wallet connection logic should initialize before toast subscriptions

3. **ToastProvider wraps ErrorBoundary and routes** — ensures toasts can be displayed from any page or component

---

## When to Add New State

### Decision Matrix

Use this checklist to decide where new state should live:

| Case                                             | Solution                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| **Needs to persist across sessions?**            | Add to `SettingsContext`                                          |
| **User preference (theme, language, locale)?**   | Add to `SettingsContext`                                          |
| **Transient, session-only (user is typing)?**    | Local state (`useState`) in the component                         |
| **Needs to be shown as a notification?**         | Use `useToast()` to dispatch                                      |
| **Wallet-related (balance, transaction state)?** | Local state or a new hook; coordinate with `useWallet()`          |
| **Shared across 2+ pages?**                      | Consider a new context, but check if `SettingsContext` fits first |
| **Should be part of the URL?**                   | Use URL params (`useSearchParams()`) or route state               |

### Examples

**✅ Good candidates for SettingsContext:**

- Theme preference
- Default network (Mainnet vs. Testnet)
- Address display format (short vs. full)
- Notification preferences (mute toasts, auto-dismiss duration)

**✅ Good candidates for local state:**

- Form input while user is typing
- Modal open/closed state (unless shared across pages)
- Hover/focus state on a button

**✅ Use useToast() for:**

- Transient success/failure confirmations
- Irreversible action feedback (use `useActionToast()` for `sign`, `send`, `approve`, and `delete` actions)
- Non-critical background events

**🚀 Standardized Action Toasts:**

For irreversible actions, we standardise messages using the `useActionToast()` hook instead of `useToast()`. This hook takes an action type (`'sign'`, `'send'`, `'approve'`, `'delete'`) and a promise, and handles the success/failure toasts for you:

```tsx
import { useActionToast } from '../hooks/useActionToast'

function ActionComponent() {
  const { withToast } = useActionToast()

  const handleDelete = async () => {
    // Automatically shows a success toast if resolved, or a danger toast if rejected (and rethrows)
    await withToast('delete', apiFetch('/resource/123', { method: 'DELETE' }))
  }
}
```

**❌ Don't add to SettingsContext:**

- Data that changes frequently (not a user preference)
- Large objects (API responses, search results)
- State that is only needed on one page

---

## Example: Reading State in a Component

```typescript
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useToast } from '../components/ToastProvider'

function Bond() {
  // Read user preferences
  const { network, toastsEnabled } = useSettings()

  // Read wallet connection state
  const { address, isConnected, connect, error } = useWallet()

  // Read notification API
  const { addToast } = useToast()

  async function handleBond() {
    if (!isConnected) {
      addToast('warning', 'Connect wallet first')
      return
    }

    try {
      // Bond logic…
      addToast('success', 'Bond created')
    } catch (err) {
      addToast('danger', 'Failed to create bond')
    }
  }

  return (
    <>
      <p>Network: {network}</p>
      <p>Wallet: {address ? 'Connected' : 'Disconnected'}</p>
      {error && <p>Error: {error.message}</p>}
      <button onClick={handleBond}>Bond</button>
    </>
  )
}
```

---

## Testing

### Mocking SettingsContext

```typescript
import { render } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({
    themeMode: 'light',
    network: 'test',
    addressDisplay: 'short',
    toastsEnabled: true,
    autoDismiss: '5s',
    hasUnsavedChanges: false,
  }),
}))

// Test code here
```

### Mocking useWallet

```typescript
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
    isConnected: true,
    connected: true,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    network: 'public',
  }),
}))
```

### Mocking useToast

```typescript
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    addToast: vi.fn(),
    removeToast: vi.fn(),
    removeAllToasts: vi.fn(),
  }),
}))
```

---

## References

- [Architecture Overview](./ARCHITECTURE.md) — System design and routing structure
- [Design Tokens](./DESIGN_TOKENS.md) — CSS variable reference for theme colors
- [Contributing Guide](../CONTRIBUTING.md) — Branch and PR workflow
