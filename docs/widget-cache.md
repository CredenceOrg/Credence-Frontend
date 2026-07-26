# Widget Cache & Per-Widget Refresh

Closes **#561** — _"Add a per-widget refresh button on the dashboard"_.

## Why this exists

Operators, support engineers, and downstream contracts refresh dashboard data
many times a day. Before this change, refreshing a single widget meant
reloading the entire page, which wiped unrelated widgets' state and forced
people to scroll back to where they were. This feature introduces a
**shared widget cache** so that pressing refresh on one card only invalidates
that card's key — every other widget on the page keeps its current state.

The refresh button is a small, accessible icon button that surfaces a spinner
and an "Last updated Xs ago" cue so the operator knows when the payload is
fresh.

## Architecture at a glance

```
┌────────────────────────────────────────────────────────────┐
│  <App>                                                     │
│   └── <WidgetCacheProvider>      (singleton store)         │
│        ├── <ToastProvider>                               │
│        │    └── <Routes>                                 │
│        │         └── <Bond> ── useWidgetCache('bond:...')│
│        │         │     └── <WidgetRefreshButton>         │
│        │         └── <TrustScore> ── useWidgetCache(...) │
│        │              └── <WidgetRefreshButton>          │
└────────────────────────────────────────────────────────────┘
```

- **One store, many keys** — `src/widgetCache/WidgetCache.tsx` exposes a
  module-level `WidgetCacheStore`. Keys are arbitrary strings — we use a
  colon-namespaced convention (`bond:active-bonds`, `trust:recent-activity`)
  to avoid collisions across pages.
- **Per-key isolation** — `useWidgetCache.refresh('a')` only invalidates
  widget `'a'`. Widget `'b'` keeps its data, spinner state, and `lastUpdated`
  timestamp untouched.
- **No new runtime dependency** — implemented in ~200 lines plus tests,
  using `useSyncExternalStore` so subscribers only re-render when their
  specific widget slot changes.

## Install

The `WidgetCacheProvider` is already mounted in `src/App.tsx` — no setup
required for existing pages. New dashboard widgets that want to opt in just
call `useWidgetCache` and render a `<WidgetRefreshButton>`.

## Usage

```tsx
import { useWidgetCache } from '../widgetCache'
import { WidgetRefreshButton } from '../components/widget'

interface BondRow { id: number; amountUsdc: number }

async function fetchActiveBonds(): Promise<BondRow[]> {
  const res = await fetch('/api/bonds')
  if (!res.ok) throw new Error('Failed to load bonds')
  return res.json()
}

export function ActiveBondsWidget() {
  const widget = useWidgetCache<BondRow[]>('bond:active-bonds', fetchActiveBonds)

  return (
    <article>
      <header>
        <h2>Active Bonds</h2>
        <WidgetRefreshButton
          onRefresh={widget.refresh}
          isLoading={widget.isLoading}
          lastUpdated={widget.lastUpdated}
          label="active bonds"
        />
      </header>

      {widget.isLoading && !widget.data ? (
        <LoadingSkeleton variant="card" rows={2} />
      ) : widget.error ? (
        <ErrorState type="network" action={{ label: 'Retry', onClick: widget.refresh }} />
      ) : (
        <ul>{widget.data?.map((b) => <li key={b.id}>{b.amountUsdc} USDC</li>)}</ul>
      )}
    </article>
  )
}
```

## API reference

### `WidgetCacheProvider`

Mounts the singleton store into the React tree. Wrap as high as needed
(typically at the app root, like `ToastProvider`).

### `useWidgetCache<T>(key, fetcher, options?)`

| Argument                              | Type                          | Purpose                                                                                 |
|---------------------------------------|-------------------------------|-----------------------------------------------------------------------------------------|
| `key`                                 | `string`                      | Stable widget identifier. Must be unique app-wide. Convention: `page:widget-name`.      |
| `fetcher`                             | `() => Promise<T>`            | Async function that produces the widget's data. Called on mount and on every refresh.   |
| `options.enabled`                      | `boolean \| undefined`        | `false` skips the initial automatic fetch. Defaults to `true`.                          |

Returns:

| Property      | Type             | Notes                                                                                       |
|---------------|------------------|---------------------------------------------------------------------------------------------|
| `data`        | `T \| undefined` | Last successfully resolved payload. Kept while a refresh is in flight.                      |
| `isLoading`   | `boolean`        | `true` while a fetch for this key is in flight (including the very first one).             |
| `isSuccess`   | `boolean`        | Mirror of `status === 'success'`.                                                           |
| `isError`     | `boolean`        | Mirror of `status === 'error'`.                                                             |
| `error`       | `Error \| und.`  | Surfaced fetcher error. Previous data is preserved so the UI does not blank on transient failures. |
| `lastUpdated` | `number \| und.` | `Date.now()` timestamp of the most recent successful fetch. Drives the "Last updated X" tooltip. |
| `refresh`     | `() => void`     | Force a re-fetch for this widget only. Supersedes any in-flight refresh for the same key.   |

### `<WidgetRefreshButton />`

| Prop          | Type                | Required | Notes                                                                                                |
|---------------|---------------------|----------|------------------------------------------------------------------------------------------------------|
| `onRefresh`   | `() => void`        | yes      | Click handler — typically `widget.refresh`.                                                            |
| `isLoading`   | `boolean`           | no       | When `true`, the button renders a spinner, sets `aria-busy="true"`, and disables the click.          |
| `disabled`    | `boolean`           | no       | Externally disable the button without rendering the spinner. Combined with `isLoading` if both true.  |
| `label`       | `string`            | no       | Read aloud by screen readers ("Refresh active bonds") and shown in the tooltip. Defaults to `'widget'`. |
| `lastUpdated` | `number`            | no       | Appends a "Last updated Xs ago" cue to the tooltip and accessible name.                              |

All other `ButtonHTMLAttributes` (except `onClick`, which we own) are spread
through to the underlying `<button>`, so consumers can pass things like
`data-testid` or `className` overrides.

## Accessibility

- The button's accessible name is composed: `"Refresh <label>"` while idle,
  `"Refreshing <label>"` while busy, and `"Refresh <label>. Last updated Xs
  ago"` once at least one fetch has succeeded. Screen readers and keyboard
  users get the same context without hidden helper text.
- `aria-busy` flips to `"true"` while loading so users know the action is in
  progress and not silently failing.
- The spinner respects `prefers-reduced-motion` (animation is suppressed when
  the user has reduced-motion enabled).
- Focus is preserved across refreshes — the button itself does not steal
  focus from the rest of the card content.

## Style tokens

All WidgetRefreshButton styling lives in `WidgetRefreshButton.css` and
references design tokens exclusively (no hard-coded colours, spacing, or
radii):

- Colour: `var(--credence-text-secondary)`, `var(--credence-color-primary-strong)`,
  `var(--credence-color-info-surface)`, `var(--credence-color-info-border)`.
- Spacing/Radii: `var(--credence-radius-md)`, `var(--credence-space-2)`, etc.
- Motion: `var(--credence-motion-duration-fast`,
  `var(--credence-motion-easing-standard)`.
- Focus: `var(--credence-focus-ring)`.

Adding a new widget should feel like the existing Bond / TrustScore widgets —
just import `useWidgetCache` + `WidgetRefreshButton` and use `data-testid` if
you need a hook for end-to-end tests.

## Out of scope / future work

- LRU eviction on `MAX_ENTRIES` (currently FIFO; documented in
  `src/config/widgetCache.ts` but not yet enforced).
- Stale-while-revalidate based on `WIDGET_CACHE_DEFAULTS.STALE_TIME_MS`.
- Request cancellation via `AbortController` — currently superseded by a guard
  flag inside the store; a real `AbortSignal` pass-through to `fetch()` would
  reduce wasted network traffic when the user mashes refresh.

## Acceptance criteria check-list (issue #561)

- [x] **The change matches the summary above** — `_refresh('a')` only
      invalidates widget `a`; widget `b` is unaffected.
- [x] **No regression in the existing test suite** — the existing
      `AddressInput`, `ConfirmDialog`, `Layout`, `useFocusTrap`, and
      `AmountInput` tests still pass unchanged.
- [x] **Documented where observable** — this page (`docs/widget-cache.md`),
      `README.md` (technical overview), and `docs/README.md` (index entry).
- [x] **Lint, type-check, and tests pass locally** — covered by the
      `feat/widget-refresh-button` branch.
- [x] **PR description references this issue with `Closes #`.**
