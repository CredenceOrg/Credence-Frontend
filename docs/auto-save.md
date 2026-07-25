# Settings Auto-Save Indicator

Closes **#564** — _"Add a debounced auto-save indicator on the settings form"_.

## Why this exists

Operators adjusting Credence preferences used to see no confirmation that their
PATCH actually succeeded; if the request failed, the only signal was a generic
toast that fired on the manual click. This change adds:

- A small **debounced auto-save** flow on the Settings form that PATCHes the
  backend whenever any setting changes — no Save click required for the
  backend round-trip.
- A **token-driven "Saved just now" pill** that briefly confirms success,
  then fades; switches to a danger-toned "Couldn't save" pill with a Retry
  button if the PATCH fails.

This is deliberately **additive**: the existing manual `Save` button on the
Settings page still commits the draft to `localStorage` via
`SettingsContext`. The two flows answer different questions and stay
independent — see [How it coexists with the existing Save button](#how-it-coexists-with-the-existing-save-button).

## What landed

- `src/config/autoSave.ts` — central constants (`DEBOUNCE_MS`, `PILL_TTL_MS`, `PILL_REFRESH_MS`).
- `src/hooks/useDebouncedAutoSave.ts` — generic hook with a status state machine
  (`idle` → `pending` → `saving` → `saved` / `error`), debounce via `setTimeout`,
  in-flight supersede via `AbortController`.
- `src/components/indicators/AutoSaveIndicator.tsx` + `.css` — pill component.
- i18n keys under `settings.autoSave.*` (`en.json`).
- `src/pages/Settings.tsx` wires the hook against the existing `draft` state.

## `useDebouncedAutoSave`

A generic hook that takes the current draft value, a save fn that receives
the value and an `AbortSignal`, and returns status + control handles.

```ts
import { useDebouncedAutoSave } from '../hooks/useDebouncedAutoSave'
import { apiFetch } from '../api/client'

const autoSave = useDebouncedAutoSave({
  value: draft,
  save: (next, signal) =>
    apiFetch<void>('/settings', { method: 'PATCH', body: next, signal }),
  delayMs: AUTO_SAVE_DEFAULTS.DEBOUNCE_MS,
  isEqual: (a, b) =>
    a.themeMode === b.themeMode &&
    a.network === b.network &&
    /* …all Settings fields… */ false,
  onSaved: (v) => addToast('info', 'Settings saved'),
  onError: (err, v) => addToast('warning', err.message),
})

// Render <AutoSaveIndicator … /> using autoSave.{status,lastSavedAt,error}.
```

### Return shape

| Field         | Type             | Notes                                                                                          |
|---------------|------------------|------------------------------------------------------------------------------------------------|
| `status`      | `AutoSaveStatus` | `idle \| pending \| saving \| saved \| error`.                                                  |
| `lastSavedAt` | `number \| null` | `Date.now()` timestamp of the most recent successful save. Drives "Saved Ns ago" relative time. |
| `error`       | `Error \| null`  | Preserved across renders until the next successful save.                                          |
| `isDirty`     | `boolean`        | `true` whenever `value` differs from the value most recently sent.                              |
| `saveNow()`   | `() => Promise<void>` | Flush debounce immediately.                                                                |
| `cancel()`    | `() => void`     | Cancel pending debounce AND abort in-flight save. Status drops to `saved` if a prior save exists, else `idle`. |

### Options

| Option        | Type                                  | Default              | Notes                                                                                                  |
|---------------|---------------------------------------|----------------------|--------------------------------------------------------------------------------------------------------|
| `value`       | `T \| undefined`                      | —                    | Pass `undefined` to park the hook in `idle` and drop any pending / in-flight save.                    |
| `save`        | `(value: T, signal: AbortSignal) => Promise<unknown>` | —                    | Required. Forward `signal` to `fetch` / `apiFetch` so cancellation propagates.                        |
| `delayMs`     | `number`                              | `AUTO_SAVE_DEFAULTS.DEBOUNCE_MS` | Debounce window. Tune per-form; ``600ms`` is a good keyboard-friendly default.         |
| `isEqual`     | `(prev, next) => boolean`            | `Object.is`          | **Required for object/array payloads.** The hook deliberately avoids deep-equality on the hot path. |
| `enabled`     | `boolean`                             | `true`               | Master switch. `false` makes the hook a no-op (no timer, no fetches).                                 |
| `onSaved`     | `(value) => void`                     | —                    | Fires once per successful save, after `lastSavedAt` is updated.                                      |
| `onError`     | `(error, value) => void`              | —                    | Fires once per failed save, after `error` is updated. Aborted saves do NOT call `onError`.           |

### State machine

```
            value !== lastSavedValue              delayMs elapses
  IDLE ───────────────────────────────────► PENDING ────────────► SAVING
                                            │                   │
                                            │                   │ save(value, signal).then
                                            │                   ├──► SAVED ──► (PILL_TTL_MS visual fade) ──► IDLE
                                            │                   └──► ERROR ──► retry / cancel ──► IDLE
```

### Cancellation contract

Every in-flight save runs through a private `AbortController`. When any of
the following occurs, the controller fires:

1. A new value change triggers `runSave(value)` — the older request is
   superseded (`abort('superseded')`).
2. The component unmounts.
3. The caller calls `cancel()`.

This means: a stale PATCH can NOT write back to the form after the user has
moved on. The hook ignores the result of any save whose signal was aborted.

## `<AutoSaveIndicator />`

A pure presentational pill. Container components supply i18n-aware labels.

```tsx
import { AutoSaveIndicator } from '../components/indicators'

<AutoSaveIndicator
  status={autoSave.status}
  lastSavedAt={autoSave.lastSavedAt}
  labels={autoSaveLabels}
  onRetry={() => void autoSave.saveNow()}
/>
```

| Prop          | Type              | Required | Notes                                                                                                  |
|---------------|-------------------|----------|--------------------------------------------------------------------------------------------------------|
| `status`      | `AutoSaveStatus`  | yes      | Drives visual + content.                                                                              |
| `lastSavedAt` | `number \| null`  | yes      | Used to compute the relative-time string while `status === 'saved'`.                                  |
| `labels`      | `AutoSaveIndicatorLabels` | yes | `{ saving, saved, savedRelative, error, retry }` — i18n-aware, supplied by the caller.       |
| `onRetry`     | `() => void`      | no       | When provided, an inline `<button>` shows next to the error message.                                  |
| `ttlMs`       | `number`          | no       | Override `AUTO_SAVE_DEFAULTS.PILL_TTL_MS`. Defaults to 6 seconds (6 000 ms).                          |
| `className`   | `string`          | no       | Appended to the root `className`.                                                                      |

> **Note on `error`**: this indicator intentionally does NOT take an `error` prop. The
> caller already has access to the underlying `Error` via `useDebouncedAutoSave().error`
> (e.g. for logging / telemetry). The user-facing message is rendered via the
> `labels.error` bundle, which keeps the presentational component purely
> text-driven.

> **Note on `cancel()` flash**: `useDebouncedAutoSave.cancel()` returns the hook to
> `status='saved'` whenever a prior save exists, even though the user just
> discarded an unsaved change. The pill briefly re-renders the `Saved` label
> until the next value change re-enters `pending`. This was a deliberate choice:
> returning to `idle` would imply "nothing has ever been confirmed", which is
> misleading after a successful first save. Callers that want a flatter UX can
> pass an empty `onRetry`-less indicator or gate the pill's mount on a parent
> flag.

### Relative-time format

`AutoSaveIndicator` re-renders once every `AUTO_SAVE_DEFAULTS.PILL_REFRESH_MS`
(30 s) when `status === 'saved'`, so the label string stays accurate on long
TTL windows without forcing the parent to manage an extra timer. The marker
uses `Date.now()` snapshotted in state, so test code can freeze timers via
`vi.useFakeTimers()` and assert against the exact string.

## Accessibility

- Pill root is `role="status"` with `aria-live="polite"` so screen readers
  announce the transition (`Saving…` → `Saved just now`) without yanking
  focus.
- The retry button is a real `<button type="button">` (keyboard-reachable
  independently of the surrounding form).
- The spinner respects `prefers-reduced-motion: reduce` (animation is
  suppressed when the user has reduced-motion enabled).
- Focus is preserved across auto-save cycles — the indicator never steals
  focus from the form field the user is editing.

## Style tokens

All styling lives in `AutoSaveIndicator.css` and references design tokens
exclusively — no hard-coded colours, spacing, or radii:

- Colour: `var(--credence-color-info-*)`, `var(--credence-color-success-*)`, `var(--credence-color-danger-*)`.
- Spacing/Radii: `var(--credence-space-*)`, `var(--credence-radius-full)`.
- Motion: `var(--credence-motion-duration-base)`, `var(--credence-motion-easing-standard)`.
- Focus: `var(--credence-focus-ring)`.

## How it coexists with the existing Save button

| Flow                   | Trigger                                   | Writes to                                       | User-visible feedback               |
|------------------------|-------------------------------------------|--------------------------------------------------|-------------------------------------|
| Manual `Save` button   | Click on `<button type="button">Save</button>` | `localStorage` via `SettingsContext.saveSettings(payload)` | `addToast('success', 'Settings saved successfully')` toast. |
| **Auto-save hook (new)** | Every form-field change after `DEBOUNCE_MS` of stability | Backend `PATCH /settings` via `apiFetch`, forwarded `signal` for cancellation. | `<AutoSaveIndicator>` pill near the action buttons.       |

The two flows have **independent state** and answer different questions:

- The manual button confirms a **local** state commitment (the user-facing
  draft is now the source of truth).
- The auto-save hook confirms a **remote** state commitment (the backend
  has acknowledged the change).

Both can succeed or fail independently; we deliberately don't collapse them
into one because:

1. The localStorage write is effectively synchronous and never fails on a
   healthy device; conflating it with a real network call adds noise.
2. Operators can edit while offline — the auto-save will surface an error
   pattern that's distinct from local-only changes.
3. A future "sync on reconnect" pass can re-drive the auto-save without
   touching the manual button.

## Out of scope / future work

- Replay on reconnect: when `apiFetch` errors with a network error, queue
  the failed payload and re-attempt on `online` event.
- Optimistic concurrency: PATCH with `If-Match` and retry on `412 Precondition Failed`.
- Stale-while-revalidate: show the pill from `lastSavedAt` while a new
  PATCH is in flight, so the UI doesn't blank during a long round-trip.

## Acceptance criteria check-list (issue #564)

- [x] **Matches the issue summary** — small "Saved just now" pill appears after each successful debounced PATCH.
- [x] **No regression in the existing test suite** — existing Settings tests and surrounding suites stay untouched (auto-save is additive, the manual `Save` button flow is unchanged).
- [x] **Documented where observable** — this page, `docs/README.md` (index entry), `README.md` (project-layout/usage snippet), API references for the hook + the component.
- [x] **Lint, type-check, and tests all pass locally** — covered by the `feat/settings-auto-save-pill` branch.
- [x] **PR description references this issue with `Closes #564`.**
