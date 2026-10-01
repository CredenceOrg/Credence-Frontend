# Dark Mode Foundation: Audit & Token Mapping

This document outlines the strategy for implementing dark mode in the Credence Frontend.

## Component Audit

| Component        | Status       | Required Changes                                                                       |
| :--------------- | :----------- | :------------------------------------------------------------------------------------- |
| **Global Shell** | ⚠️ Needs Fix | `index.css` uses hardcoded hexes for background and text.                              |
| **Layout**       | ⚠️ Needs Fix | Header uses `background: #fff` and `borderBottom: 1px solid #e2e8f0` in inline styles. |
| **Banners**      | ⚠️ Needs Fix | Pastel backgrounds (`#eff6ff`, `#f0fdf4`) are too bright for dark mode.                |
| **Toasts**       | ⚠️ Needs Fix | Shares same color logic as Banners; needs dark-optimized surface tokens.               |
| **Badges**       | ✅ Ready     | Can be easily updated by switching internal tokens.                                    |
| **States**       | ⚠️ Needs Fix | Empty states and Loading skeletons use hardcoded grays.                                |
| **Pages**        | ⚠️ Needs Fix | `Bond.tsx` and `TrustScore.tsx` use inline styles for card backgrounds and borders.    |

## Token Mapping Proposal

We will use CSS variables defined in `:root` and overridden in `[data-theme='dark']`.

### Core Surface Tokens

| Token              | Light Value          | Dark Value            | Usage                     |
| :----------------- | :------------------- | :-------------------- | :------------------------ |
| `--bg-page`        | `#f8fafc` (Slate 50) | `#020617` (Slate 950) | Main page background      |
| `--bg-card`        | `#ffffff`            | `#0f172a` (Slate 900) | Card/Header background    |
| `--text-primary`   | `#0f172a`            | `#f8fafc`             | Primary headings and text |
| `--text-secondary` | `#64748b`            | `#94a3b8`             | Supporting text           |
| `--border-default` | `#e2e8f0`            | `#1e293b`             | Default borders           |

### Interactive Tokens

| Token             | Light Value              | Dark Value                | Usage                           |
| :---------------- | :----------------------- | :------------------------ | :------------------------------ |
| `--color-primary` | `#0284c7`                | `#38bdf8`                 | Buttons, links, primary accents |
| `--color-focus`   | `rgba(2, 132, 199, 0.5)` | `rgba(56, 189, 248, 0.5)` | Focus rings                     |

### Saturated (Status) Tokens

For Banners and Toasts in Dark Mode, we will use tinted dark backgrounds instead of pastels.

| Severity    | Light BG  | Dark BG (Tinted Slate 900) |
| :---------- | :-------- | :------------------------- |
| **Info**    | `#eff6ff` | `rgba(59, 130, 246, 0.1)`  |
| **Success** | `#f0fdf4` | `rgba(34, 197, 94, 0.1)`   |
| **Warning** | `#fffbeb` | `rgba(245, 158, 11, 0.1)`  |
| **Danger**  | `#fef2f2` | `rgba(239, 68, 68, 0.1)`   |

## Implementation Steps

1.  **Phase 1**: Define tokens in `src/index.css`.
2.  **Phase 2**: Refactor `Layout`, `Bond`, and `TrustScore` to use CSS variables instead of hardcoded hexes in inline styles.
3.  **Phase 3**: Update `Banner.css`, `Toast.css`, and `Badge.css` to use status tokens.
4.  **Phase 4**: Add a `ThemeToggle` component to `Layout.tsx`.

## Single Source of Truth

The theme has exactly **one** owner: `SettingsContext` (`src/context/SettingsContext.tsx`).

### First-paint FOUC guard

An inline `<script>` in `index.html` reads `credence:settings` from localStorage
and sets `document.documentElement.setAttribute('data-theme', …)` synchronously
before React mounts. This prevents a flash-of-unstyled-content (FOUC) when the
user has a dark or system preference saved.

- The script is self-contained (no dependencies) and runs before any module
  scripts or stylesheets load.
- It reads the same `credence:settings` key that `SettingsContext` writes.
- It resolves `'system'` via `matchMedia('(prefers-color-scheme: dark)')`
  inline — the same logic `SettingsContext` uses — so the first paint matches
  the OS preference without waiting for the React tree.
- Failures (missing key, parse error) are silently caught; no theme attribute is
  set, and the default light-theme CSS variables apply until React hydrates.

- **State + persistence**: `themeMode` (`'light' | 'dark' | 'system'`) lives in
  `SettingsContext` and is persisted under the single `credence:settings`
  localStorage key. There is no separate `'theme'` key.
- **Document attribute**: `SettingsContext` is the _only_ writer of
  `document.documentElement[data-theme]`. Its effect resolves `'system'` via
  `matchMedia('(prefers-color-scheme: dark)')` and re-applies on OS changes.
- **`ThemeToggle`** (`src/components/ThemeToggle.tsx`) is a pure consumer of
  `useSettings()`. It owns no theme state and writes to no storage key. It:
  - _derives_ the displayed light/dark from `themeMode` (resolving `'system'`
    via `matchMedia`),
  - subscribes to `matchMedia` so its icon, `aria-pressed`, and dynamic `title`
    stay in sync with `data-theme` when the OS theme changes in `system` mode
    (the accessible name `aria-label="Toggle theme"` is static),
  - on click calls `setThemeMode` with the **explicit** opposite of the
    currently resolved theme (never back to `'system'`).

This removes the historical desync where the toggle kept its own state under a
duplicate `'theme'` key while the document was driven by `credence:settings`.

### Legacy `'theme'` key migration

Older builds of `ThemeToggle` persisted the theme under a standalone `'theme'`
localStorage key. On first load, `SettingsContext` performs a **one-time
migration** so returning users keep their preference:

- If `credence:settings` already carries a `themeMode`, it wins (the single
  source of truth) and the legacy value is discarded.
- Otherwise, a valid legacy `'theme'` value (`'light' | 'dark' | 'system'`)
  seeds `themeMode`; invalid values are ignored and fall back to `'system'`.
- The migrated value is folded into `credence:settings`, and the orphan
  `'theme'` key is removed on mount.

The migration is transparent: it does not register as an unsaved change on the
Settings page.

## Failure boundaries: `getSystemPrefersDark`

`getSystemPrefersDark()` (exported from `src/components/ThemeToggle.tsx`, with
the diagnostic variant `readSystemPrefersDark()` and the change subscription
`subscribeSystemPrefersDark()`) is the guarded read of the OS
`prefers-color-scheme: dark` preference. Invariants:

- **Total function.** It never throws and always returns a strict `boolean`.
  Missing `window` (SSR), missing/non-callable `window.matchMedia`, a throwing
  `matchMedia`, a non-object `MediaQueryList`, and a throwing or non-boolean
  `.matches` all resolve to the light fallback (`false`).
- **Deterministic.** It is a pure read of current environment state: duplicate
  and concurrent calls agree, and it never writes storage, so a retry cannot
  race or duplicate persisted user data.
- **Strict boolean.** Only `matches === true` means dark; a truthy
  non-boolean (`'true'`, `1`) is reported as unreadable instead of being
  coerced, so malformed input can never silently flip the theme.
- **Non-destructive fallback.** A failed read yields `'light'` and never
  supersedes an explicitly persisted `themeMode` — the user's saved choice
  survives any environment failure, and the toggle stays clickable.
- **Bounded retries, no torn state.** The `change` subscription is
  established with at most `SUBSCRIBE_MAX_ATTEMPTS` attempts (linear backoff);
  on give-up the last known value is retained and re-synced on the next
  `themeMode` transition. Invalid/stale event payloads are dropped rather than
  coerced, and duplicate unsubscribes are no-ops.
- **Diagnosable, not noisy.** Each failure class is logged once per session
  through `src/lib/log.ts` (`event=theme_system_preference_unavailable
failure=<class>`) — the class only, never an error message or user value.
  The button also carries `data-theme-source` (`'explicit' | 'system' |
'fallback'`) so support can read the current path straight from the DOM.

`SettingsContext` mirrors the same guard locally for its `data-theme`
application (it must not import components, because the Settings tests
module-mock `ThemeToggle`), so an absent or hostile `matchMedia` degrades to
"no live OS updates" instead of crashing the tree.

Focused coverage lives in
`src/components/ThemeToggle.failure-boundary.test.tsx` (success, rejection,
boundary, retry, recovery, regression); the happy path and single-source-of-
truth regressions live in `src/components/ThemeToggle.test.tsx`.
