# Hooks & Utilities Reference

A catalog of the reusable primitives in the Credence frontend: React hooks in
[`src/hooks/`](../src/hooks/) and framework-free helpers in [`src/lib/`](../src/lib/).

Reach for these before writing a new one — they encapsulate non-obvious behavior
(focus management, SSR guards, request cancellation, on-chain-aligned penalty math)
that is easy to get subtly wrong. Each entry lists the signature, parameters/return,
behavior notes, and a minimal usage example linking to source.

> **SSR & cleanup conventions used below**
>
> - **SSR-safe** means the primitive does no `window`/`document`/`navigator`/`localStorage`
>   work during render — DOM access is deferred to an effect or guarded by a
>   `typeof window === 'undefined'` check — so it is safe to import and call in
>   server-rendered or test environments.
> - **Cleanup** notes call out listeners, subscriptions, in-flight requests, or
>   timers that the primitive tears down on unmount/deactivate. Where a function
>   hands you a teardown handle, you own calling it.

## Contents

- [Hooks (`src/hooks/`)](#hooks-srchooks)
  - [`useFocusTrap`](#usefocustrap)
  - [`useDocumentTitle`](#usedocumenttitle)
  - [`useMediaQuery`](#usemediaquery)
  - [`useQuery`](#usequery)
  - [`useReducedMotion`](#usereducedmotion)
  - [`useScrollToTop`](#usescrolltotop)
  - [`useTrustScore`](#usetrustscore)
  - [`useUsdcBalance`](#useusdcbalance)
  - [`useWallet`](#usewallet)
- [Utilities (`src/lib/`)](#utilities-srclib)
  - [`format`](#format--usdc-formatting)
  - [`stellar`](#stellar--address-validation)
  - [`tier`](#tier--trust-tiers)
  - [`bondPenalty`](#bondpenalty--duration-based-penalties)
  - [`penalty`](#penalty--status-based-penalties)
  - [`freighterClient`](#freighterclient--wallet-sdk-wrapper)

---

## Hooks (`src/hooks/`)

### `useFocusTrap`

Source: [`src/hooks/useFocusTrap.ts`](../src/hooks/useFocusTrap.ts) · Companion spec: [focus-patterns.md](focus-patterns.md)

```ts
function useFocusTrap(options: UseFocusTrapOptions): void

interface UseFocusTrapOptions {
  containerRef: RefObject<HTMLElement | null>
  isActive: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
  onEscape?: () => void
  returnFocusOnDeactivate?: boolean // default: true
}
```

Constrains keyboard focus to a container while active and restores it on deactivate — the
primitive behind modals, dialogs, and full-screen overlays.

**Parameters**

| Option                    | Required | Description                                                                                      |
| ------------------------- | :------: | ------------------------------------------------------------------------------------------------ |
| `containerRef`            |    ✓     | Element whose focusable descendants are trapped. No-op until `current` is set.                   |
| `isActive`                |    ✓     | Engage (`true`) / disengage (`false`) the trap; drives initial-focus and return-focus lifecycle. |
| `initialFocusRef`         |          | Element to focus on activation. Falls back to the first focusable element in the container.      |
| `returnFocusRef`          |          | Element to focus on deactivation. Falls back to whatever was focused before activation.          |
| `onEscape`                |          | Called on `Escape` (after `preventDefault`). You close the overlay (e.g. flip `isActive`).       |
| `returnFocusOnDeactivate` |          | When `false`, do not restore focus on deactivate. Default `true`.                                |

**Behavior notes**

- **Fresh querying:** focusable elements are recomputed on _every_ `Tab` press, not cached
  at activation — so controls that mount/unmount or toggle `disabled`/visibility while the
  trap is open are handled correctly.
- **`requestAnimationFrame` focus:** both the initial focus and the return focus are applied
  on the next animation frame, letting the overlay paint (or unmount) first so the target is
  actually focusable.
- **Wrapping:** `Tab` on the last element wraps to the first; `Shift+Tab` on the first (or
  when focus escaped the container) wraps to the last.
- **Visibility filter:** only visible elements (`offsetParent`/`getClientRects`) are
  considered; hidden inputs and `tabindex="-1"` are excluded.
- **Edge cases:** a container with no focusable elements traps nothing; a return target that
  was removed from the DOM is safely skipped.
- **SSR-safe / cleanup:** all DOM work runs inside `useEffect`; the `keydown` listener is
  always removed on deactivate/unmount.

```tsx
import { useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

function ConfirmDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    containerRef: dialogRef,
    isActive: open,
    initialFocusRef: confirmRef, // focus the primary action on open
    onEscape: onClose, // Escape requests a close
  })

  if (!open) return null
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true">
      <button onClick={onClose}>Cancel</button>
      <button ref={confirmRef} onClick={onClose}>
        Confirm
      </button>
    </div>
  )
}
```

---

### `useDocumentTitle`

Source: [`src/hooks/useDocumentTitle.ts`](../src/hooks/useDocumentTitle.ts)

```ts
function useDocumentTitle(title: string, options?: UseDocumentTitleOptions): void

interface UseDocumentTitleOptions {
  brandSuffix?: boolean // default: true — append ` · Credence`
  restoreOnUnmount?: boolean // default: true — restore prior title on unmount
}

// Also exported: formatDocumentTitle(title, brandSuffix?), BRAND, BRAND_SEPARATOR, BRAND_SUFFIX
```

Sets `document.title` to a descriptive, branded title for the component's lifetime. Keeping
the title in sync with the route is an accessibility win — screen readers announce it on
navigation, and tabs/history/bookmarks become distinguishable.

**Behavior notes**

- Never double-applies the ` · Credence` suffix; an empty title resolves to just `Credence`.
- `formatDocumentTitle` is exported for testing/pre-computing titles without the effect.
- **SSR-safe / cleanup:** guarded by `typeof document === 'undefined'`; runs in an effect and
  restores the previous title on unmount (unless `restoreOnUnmount: false`).

```tsx
import { useDocumentTitle } from '../hooks/useDocumentTitle'

function Bond() {
  useDocumentTitle('Bond') // document.title === 'Bond · Credence'
  return <main>…</main>
}
```

---

### `useMediaQuery`

Source: [`src/hooks/useMediaQuery.ts`](../src/hooks/useMediaQuery.ts)

```ts
function useMediaQuery(query: string): boolean
function useIsMobile(): boolean  // shorthand: (max-width: 767px)
```

Subscribes to a CSS media query and returns whether it currently matches. The exported
breakpoint helper `useIsMobile` wraps the 768 px mobile threshold used throughout the app.

**Parameters**

| Parameter | Required | Description                                         |
| --------- | :------: | --------------------------------------------------- |
| `query`   |    ✓     | A valid CSS media query string, e.g. `'(max-width: 767px)'`. |

**Behavior notes**

- Returns `false` during SSR or when `window.matchMedia` is unavailable — no crash.
- Uses a lazy `useState` initializer to read the initial match synchronously on first render,
  eliminating any flash of wrong state.
- Subscribes via `addEventListener('change', …)` with optional chaining, mirroring the
  pattern in `SettingsContext`.
- **SSR-safe / cleanup:** all DOM work is guarded; the `change` listener is removed on unmount
  or when the query string changes.

```tsx
import { useMediaQuery, useIsMobile } from '../hooks/useMediaQuery'

// Generic usage
const isWide = useMediaQuery('(min-width: 1024px)')

// Breakpoint helper
function ActivityCard() {
  const isMobile = useIsMobile()
  return <h2>{isMobile ? 'Recent Activity' : 'Recent Activity Timeline'}</h2>
}
```

---

### `useQuery`

Source: [`src/hooks/useQuery.ts`](../src/hooks/useQuery.ts)

```ts
function useQuery<T>(
  queryFn: () => Promise<T>,
  options?: UseQueryOptions,
): UseQueryResult<T>

interface UseQueryOptions {
  enabled?: boolean // default: true
}

interface UseQueryResult<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}
```

A custom hook that wraps an asynchronous query function to fetch and manage data state.

**Parameters**

| Option    | Required | Description                                                  |
| --------- | :------: | ------------------------------------------------------------ |
| `queryFn` |    ✓     | An asynchronous function returning a Promise.               |
| `enabled` |          | Set to `false` to prevent the initial request. Default `true`. |

**Behavior notes**

- **Offline-safe:** both the initial query execution and subsequent `refetch` are disabled when offline (using `window.navigator.onLine`).
- **Safe state updates:** uses component lifecycle checks to safely ignore state updates if the component unmounts before the asynchronous query finishes.
- **Race-condition protection:** uses run IDs to guarantee that only the latest triggered fetch updates the component state.
- **SSR-safe / cleanup:** all DOM/navigator checks are guarded for server-rendered environments; active promises do not trigger state updates on unmount.

```tsx
import { useQuery } from '../hooks/useQuery'
import { apiFetch } from '../api/client'

function MyComponent() {
  const { data, isLoading, refetch } = useQuery(() => apiFetch('/data'))

  return (
    <div>
      <button onClick={refetch} disabled={isLoading}>Refresh</button>
      {isLoading ? <p>Loading...</p> : <p>Data: {JSON.stringify(data)}</p>}
    </div>
  )
}
```

---

### `useReducedMotion`

Source: [`src/hooks/useReducedMotion.ts`](../src/hooks/useReducedMotion.ts) · See also: [motion-guidelines.md](motion-guidelines.md)

```ts
function useReducedMotion(): boolean
```

Returns `true` when the user has `prefers-reduced-motion: reduce` set, and stays in sync as
the OS preference changes. Gate or shorten animations on this value.

**Behavior notes**

- Subscribes to the `matchMedia` change event, with an `addListener`/`removeListener`
  fallback for legacy browsers; re-syncs once on mount in case the preference changed before
  subscribing.
- **SSR-safe / cleanup:** returns `false` when `window`/`matchMedia` is unavailable; removes
  its media-query listener on unmount.

```tsx
import { useReducedMotion } from '../hooks/useReducedMotion'

function Banner() {
  const reduceMotion = useReducedMotion()
  return <div className={reduceMotion ? 'no-anim' : 'slide-in'}>…</div>
}
```

---

### `useScrollToTop`

Source: [`src/hooks/useScrollToTop.ts`](../src/hooks/useScrollToTop.ts)

```ts
function useScrollToTop(): boolean
```

Returns `true` when the page has been scrolled more than `BACK_TO_TOP_SCROLL_THRESHOLD` (800 px) from the top, and `false` otherwise. Used by [`BackToTop`](../src/components/BackToTop.tsx) to decide when to render the affordance.

**Exported constant:** `BACK_TO_TOP_SCROLL_THRESHOLD = 800` — the pixel threshold at which the button becomes visible.

**Cleanup:** removes the passive `scroll` listener on unmount.

```tsx
import { useScrollToTop } from '../hooks/useScrollToTop'

function MyComponent() {
  const showButton = useScrollToTop()
  return showButton ? <button>↑</button> : null
}
```

---

### `useTrustScore`

Source: [`src/hooks/useTrustScore.ts`](../src/hooks/useTrustScore.ts)

```ts
function useTrustScore(address: string): UseTrustScoreResult

interface UseTrustScoreResult {
  data: TrustScore | null
  isLoading: boolean
  error: ApiError | null
  refetch: () => void
}
```

Loads trust-score data for a Stellar public key from the Credence API
(`GET /trust-score/:address`).

**Behavior notes**

- **Manual / lazy:** does _not_ fetch on mount or on `address` change — call `refetch()`
  (e.g. after the user submits a lookup). Invalid/empty addresses (per
  [`isValidStellarAddress`](#stellar--address-validation)) are silently ignored.
- **Race-safe:** in-flight requests are aborted when `refetch` is called again or the hook
  unmounts; stale responses and `AbortError`s are discarded so only the latest result wins.
- **SSR-safe / cleanup:** no DOM/`window` access; the active `AbortController` is aborted on
  unmount.

```tsx
import { useState } from 'react'
import { useTrustScore } from '../hooks/useTrustScore'

function Lookup() {
  const [address, setAddress] = useState('')
  const { data, isLoading, error, refetch } = useTrustScore(address)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        refetch()
      }}
    >
      <input value={address} onChange={(e) => setAddress(e.target.value)} />
      <button disabled={isLoading}>Look up</button>
      {error && <p role="alert">{error.message}</p>}
      {data && <p>Score: {data.score}</p>}
    </form>
  )
}
```

---

### `useWallet`

Source: [`src/hooks/useWallet.ts`](../src/hooks/useWallet.ts) · Built on [`freighterClient`](#freighterclient--wallet-sdk-wrapper)

```ts
function useWallet(settingsNetwork: string): UseWalletState

interface UseWalletState {
  address: string
  isConnected: boolean
  isConnecting: boolean
  error: WalletError | null
  connect: () => Promise<void>
  disconnect: () => void
  network: CredenceNetwork
}
```

Manages Freighter wallet connection state for the dApp. Pass the network selected in
`SettingsContext` (`'public'` or `'test'`; anything else is treated as `'public'`).

**Behavior notes**

- Wraps every Freighter call in browser guards and surfaces failures as a typed
  `WalletError` (`not_installed` | `rejected` | `network_mismatch` | `unknown`) instead of
  throwing.
- Attempts a **silent session restore** on mount (if access was previously granted) and
  watches for account changes via a Freighter watcher; a network mismatch between Freighter
  and Settings is reported as an error.
- **SSR-safe / cleanup:** `connect` and the restore effect early-return when `window` is
  undefined; the wallet-change watcher is stopped on `disconnect` and on unmount.

```tsx
import { useWallet } from '../hooks/useWallet'

function ConnectButton({ network }: { network: string }) {
  const { isConnected, isConnecting, address, connect, disconnect, error } = useWallet(network)

  if (isConnected) return <button onClick={disconnect}>{address.slice(0, 6)}… ✕</button>
  return (
    <>
      <button onClick={connect} disabled={isConnecting}>
        {isConnecting ? 'Connecting…' : 'Connect wallet'}
      </button>
      {error && <p role="alert">{error.message}</p>}
    </>
  )
}
```

---

### `useUsdcBalance`

Source: [`src/hooks/useUsdcBalance.ts`](../src/hooks/useUsdcBalance.ts) · Built on [`horizon`](#horizon--horizon-api-client)

```ts
function useUsdcBalance(): UseUsdcBalanceResult

type UseUsdcBalanceStatus = 'idle' | 'loading' | 'ready' | 'error'

interface UseUsdcBalanceResult {
  balance: number
  status: UseUsdcBalanceStatus
  error: Error | null
  refetch: () => void
}
```

Fetches the connected account's USDC balance from the Stellar Horizon API. Reads the
wallet address from `useWallet()` and the active network from `useSettings()`.

**Behavior notes**

- **Auto-fetches** on mount when a wallet is connected, and re-fetches whenever the
  connected address or active network changes.
- Returns `{ balance: 0, status: 'idle' }` when no wallet is connected — does not
  attempt a Horizon request.
- **Race-safe:** in-flight requests are aborted when `refetch` is called again, when
  address/network changes, or on unmount. Stale responses and `AbortError`s are discarded.
- Returns `0` balance when the account has no USDC trustline (asset not found on Horizon).
- **SSR-safe / cleanup:** no DOM access during render; the active `AbortController` is
  aborted on unmount.

```tsx
import { useUsdcBalance } from '../hooks/useUsdcBalance'
import { formatUsdc } from '@/lib/format'

function BalanceDisplay() {
  const { balance, status, error, refetch } = useUsdcBalance()

  if (status === 'idle') return <p>Connect wallet to see balance</p>
  if (status === 'loading') return <p>Loading balance…</p>
  if (status === 'error') {
    return (
      <p role="alert">
        Could not load balance. <button onClick={refetch}>Retry</button>
      </p>
    )
  }
  return <p>Available: {formatUsdc(balance)}</p>
}
```

---

## Utilities (`src/lib/`)

Framework-free helpers — pure functions and a wallet SDK wrapper. No React required.

### `format` — USDC formatting

Source: [`src/lib/format.ts`](../src/lib/format.ts) · Single source of truth for USDC display.

```ts
formatUsdc(amount: number): string        // 1234.5      → "1,234.5 USDC"
normalizeUSDC(rawValue: string): string   // "1,234.5"   → "1234.50"  (clamps <0 to "0.00"; invalid → "")
formatUSDC(rawValue: string): string      // "1234.5"    → "1,234.50" (invalid → unchanged)
formatUSDCDisplay(rawValue: string): string // alias of formatUSDC, for UI contexts
sanitizeUSDCInput(nextValue: string): string // "$1,000.50" → "1000.50" (≤2 decimals, strips junk)
```

**Behavior notes:** all helpers use the `en-US` locale for locale-independent separators;
empty input yields `""`; `normalizeUSDC` clamps negatives to `0` and rejects non-numeric
input, while `formatUSDC`/`formatUSDCDisplay` return the original text unchanged so the user
can correct it. SSR-safe (pure functions, no globals).

```ts
import { formatUsdc, sanitizeUSDCInput } from '@/lib/format'

formatUsdc(1000) // "1,000 USDC"
sanitizeUSDCInput('12.345') // "12.34"
```

### `stellar` — address validation

Source: [`src/lib/stellar.ts`](../src/lib/stellar.ts) · Single source of truth for address handling.

```ts
isValidStellarAddress(address: string | undefined | null): boolean
truncateAddress(address: string | undefined | null): string
```

**Behavior notes:** validation requires exactly 56 uppercase-alphanumeric characters starting
with `G`. `truncateAddress` shows `first 12 … last 8` for long addresses, leaves anything
≤ 20 chars untouched, trims whitespace, and returns `""` for nullish/empty input. SSR-safe.

```ts
import { isValidStellarAddress, truncateAddress } from '@/lib/stellar'

isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA') // true
truncateAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA') // "GAAZI4TCR3TY...CCWNA"
```

### `tier` — trust tiers

Source: [`src/lib/tier.ts`](../src/lib/tier.ts) · Aligned to [tier-thresholds.md](tier-thresholds.md).

```ts
type TrustTier = 'bronze' | 'silver' | 'gold' | 'platinum'
const TIER_THRESHOLDS // inclusive ranges; platinum.max === null (no cap)
tierForScore(score: number): TrustTier
```

**Behavior notes:** `tierForScore` maps a 0–1000 score to its tier, clamping negatives to
`bronze` and anything at/above 750 to `platinum`. `TIER_THRESHOLDS` is the single source of
truth for the numeric ranges. SSR-safe.

```ts
import { tierForScore } from '@/lib/tier'

tierForScore(300) // "silver"
tierForScore(900) // "platinum"
```

### `bondPenalty` — duration-based penalties

Source: [`src/lib/bondPenalty.ts`](../src/lib/bondPenalty.ts) · Rates mirror on-chain policy.

```ts
type BondDurationDays = 30 | 90 | 180
getPenaltyRateForDuration(durationDays: number): number // 30→0.2, 90→0.15, 180→0.1; unknown→0.2
computeBondSlashBreakdown(amountUsdc: number, durationDays: number): BondSlashBreakdown
```

**Behavior notes:** used in the **CreateBondFlow** review step to preview the cost of early
exit for a _prospective_ bond. Unknown durations fall back to the most conservative (highest)
rate. The breakdown returns both formatted strings and raw USDC numbers. SSR-safe.

```ts
import { computeBondSlashBreakdown } from '@/lib/bondPenalty'

computeBondSlashBreakdown(1000, 30)
// → { penaltyPercent: 20, penaltyAmount: '200 USDC', resultingBalance: '800 USDC', … }
```

### `penalty` — status-based penalties

Source: [`src/lib/penalty.ts`](../src/lib/penalty.ts)

```ts
type BondStatus = 'active' | 'locked' | 'grace-period'
interface MockBond { id: number; amountUsdc: number; status: BondStatus }
getPenaltyRate(status: BondStatus): number // locked→0.2, grace-period→0.1, active/other→0
computeWithdrawBreakdown(bond: MockBond): ConfirmDialogPenaltyBreakdown & { penaltyUsdc: number }
```

**Behavior notes:** the status-based counterpart to `bondPenalty` — computes the penalty for
an _existing_ bond from its lifecycle status, ready to feed the withdrawal `ConfirmDialog` on
Bond.tsx. SSR-safe.

```ts
import { computeWithdrawBreakdown } from '@/lib/penalty'

computeWithdrawBreakdown({ id: 1, amountUsdc: 1000, status: 'locked' })
// → { bondAmount: '1,000 USDC', penaltyPercent: 20, penaltyAmount: '200 USDC', resultingBalance: '800 USDC', penaltyUsdc: 200 }
```

### `freighterClient` — wallet SDK wrapper

Source: [`src/lib/freighterClient.ts`](../src/lib/freighterClient.ts) · Prefer [`useWallet`](#usewallet) in components.

```ts
const FREIGHTER_INSTALL_URL: string
type CredenceNetwork = 'public' | 'test'
mapFreighterNetwork(freighterNetwork: string): CredenceNetwork | null
checkFreighterInstalled(): Promise<boolean>
requestFreighterAccess(): Promise<{ ok: true; address: string } | { ok: false; code; message }>
fetchFreighterAddress(): Promise<string | null>   // silent, no prompt
fetchFreighterNetwork(): Promise<CredenceNetwork | null>
createWalletWatcher(onChange): Promise<{ stop: () => void } | null>
resetFreighterModuleCache(): void                  // tests only
```

**Behavior notes:** an SSR-safe, lazy-loading wrapper around `@stellar/freighter-api`.
Importing the module has no side effects; the SDK is imported on first use and cached.
Functions return `null`/failure results outside a browser instead of throwing.

- **Cleanup:** `createWalletWatcher` returns a `{ stop }` handle — **call `stop()`** to remove
  the subscription (e.g. on unmount). `useWallet` does this for you.

```ts
import { createWalletWatcher } from '@/lib/freighterClient'

const watcher = await createWalletWatcher(({ address }) => console.log('now:', address))
// later…
watcher?.stop()
```

### `horizon` — Horizon API client

Source: [`src/lib/horizon.ts`](../src/lib/horizon.ts) · Used by [`useUsdcBalance`](#useusdcbalance).

```ts
class HorizonError extends Error {
  readonly status: number
}

fetchUsdcBalance(
  address: string,
  network: CredenceNetwork,
  signal?: AbortSignal
): Promise<number>
```

**Behavior notes:** a lightweight, SSR-safe wrapper around the Stellar Horizon REST API.
Fetches the USDC balance for a given public key from the correct Horizon server
(`horizon.stellar.org` for public, `horizon-testnet.stellar.org` for test). Returns `0`
when the account has no USDC trustline or the account doesn't exist (404). Throws
`HorizonError` with the HTTP status on other failures. Accepts an optional `AbortSignal`
for cancellation.

```ts
import { fetchUsdcBalance, HorizonError } from '@/lib/horizon'

try {
  const balance = await fetchUsdcBalance('G…', 'public')
  console.log(`USDC balance: ${balance}`)
} catch (err) {
  if (err instanceof HorizonError) {
    console.error(`Horizon error ${err.status}: ${err.message}`)
  }
}
```

---

## Adding a new primitive

When you add a hook to `src/hooks/` or a utility to `src/lib/`:

1. Write complete TSDoc on the export(s) — every parameter, the return, non-obvious
   behavior, and SSR-safety/cleanup expectations where the primitive touches
   `window`/`document`/`navigator`/`localStorage` or sets up subscriptions.
2. Add an entry here following the same shape (signature → params/return → behavior notes →
   usage example linking to source). Keep it accurate to the real signature — no aspirational
   APIs.
3. Add the entry to the [Contents](#contents) list above.
