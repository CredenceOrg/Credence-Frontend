# Shared Components Catalog

This catalog is the source-facing reference for shared UI under `src/components/`. It documents current TypeScript props, accessibility contracts, styling ownership, and the `--credence-*` design tokens each component consumes. Keep this page in sync whenever component props or CSS tokens change.

Related focused docs: [button system](./button-system.md), [notifications](./notifications.md), [design tokens](./DESIGN_TOKENS.md), [dark mode](./dark-mode.md), [focus patterns](./focus-patterns.md), [UI states](./UI_STATES_GUIDE.md), [TrustGauge quick reference](./TRUST_GAUGE_QUICK_REFERENCE.md), and [tier thresholds](./tier-thresholds.md).

## Styling ownership snapshot

| Component              | Styling owner                                                                       | Inline-style migration note                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Button                 | `src/components/Button.css`                                                         | None.                                                                                                                     |
| Badge                  | `src/components/Badge.css`                                                          | None.                                                                                                                     |
| Banner                 | `src/components/Banner.css`                                                         | None.                                                                                                                     |
| Toast / ToastProvider  | `src/components/Toast.css`                                                          | None.                                                                                                                     |
| ConfirmDialog          | `src/components/ConfirmDialog.css`                                                  | None.                                                                                                                     |
| AddressInput           | `src/components/AddressInput.css` + `FormField.css`                                 | None.                                                                                                                     |
| AmountInput            | `src/components/AmountInput.css`                                                    | None.                                                                                                                     |
| TrustGauge             | `src/components/TrustGauge.css`                                                     | Uses inline CSS custom properties for dynamic progress, marker, thumb, and legend-dot colors; keep scoped until migrated. |
| TierLadder             | `src/components/TierLadder.css` + `Badge.css`                                       | None.                                                                                                                     |
| ActivityTimeline       | `src/components/ActivityTimeline.css` + EmptyState inline styles for empty fallback | Empty fallback inherits `EmptyState` inline styles; migrate with states components.                                       |
| FormField              | `src/components/forms/FormField.css`                                                | None.                                                                                                                     |
| controls/Select        | `src/components/controls/controls.css`                                              | None.                                                                                                                     |
| controls/Toggle        | `src/components/controls/controls.css`                                              | None.                                                                                                                     |
| states/EmptyState      | Inline styles in `src/components/states/EmptyState.tsx`                             | Owns inline styles and should be migrated to CSS.                                                                         |
| states/ErrorState      | Inline styles in `src/components/states/ErrorState.tsx`                             | Owns inline styles and should be migrated to CSS.                                                                         |
| states/LoadingSkeleton | Inline styles in `src/components/states/LoadingSkeleton.tsx`                        | Owns inline styles and should be migrated to CSS.                                                                         |

## Shared vocabularies

### `BadgeVariant`

Source: [`Badge.tsx`](../src/components/Badge.tsx)

`'bronze' | 'silver' | 'gold' | 'platinum' | 'active' | 'locked' | 'slashed' | 'grace-period' | 'unknown'`

Unknown runtime strings normalize to the `unknown` visual style while preserving the supplied string as a fallback label only when no known label exists.

### `BannerSeverity`

Source: [`Banner.tsx`](../src/components/Banner.tsx)

`'info' | 'success' | 'warning' | 'critical'`

`warning` and `critical` render urgent `role="alert"`; `info` and `success` render `role="status"`.

### `ToastSeverity`

Source: [`Toast.tsx`](../src/components/Toast.tsx) and [`ToastProvider.tsx`](../src/components/ToastProvider.tsx)

`'info' | 'success' | 'warning' | 'danger'`

Default auto-dismiss timeouts are 5s for `info` and `success`, 8s for `warning`, and persistent for `danger` unless settings override auto-dismiss.

### `TIER_CONFIG`

Source: [`TrustGauge.tsx`](../src/components/TrustGauge.tsx)

| Tier       | Range    | Label    | Tokens referenced by config                                                                               |
| ---------- | -------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `bronze`   | 0-250    | Bronze   | `--credence-color-bronze-border`, `--credence-color-bronze-surface`, `--credence-color-bronze-text`       |
| `silver`   | 250-500  | Silver   | `--credence-color-silver-border`, `--credence-color-silver-surface`, `--credence-color-silver-text`       |
| `gold`     | 500-750  | Gold     | `--credence-color-gold-border`, `--credence-color-gold-surface`, `--credence-color-gold-text`             |
| `platinum` | 750-1000 | Platinum | `--credence-color-platinum-border`, `--credence-color-platinum-surface`, `--credence-color-platinum-text` |

## Button

Source: [`src/components/Button.tsx`](../src/components/Button.tsx). Focused docs: [button system](./button-system.md).

| Prop                | Type                                              | Default                                  |
| ------------------- | ------------------------------------------------- | ---------------------------------------- |
| `variant`           | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'`                              |
| `isLoading`         | `boolean`                                         | `false`                                  |
| `fullWidth`         | `boolean`                                         | `false`                                  |
| `children`          | `ReactNode`                                       | Required                                 |
| Native button props | `ButtonHTMLAttributes<HTMLButtonElement>`         | Forwarded; `type` defaults to `'button'` |

Accessibility: renders a native `<button>`, disables interaction while `disabled` or `isLoading`, sets `aria-busy` for loading state, hides spinner SVG from assistive tech, and inherits keyboard activation/focus behavior from the platform.

Tokens: `--credence-border-default`, `--credence-color-danger-*`, `--credence-color-info-surface`, `--credence-color-primary*`, `--credence-color-slate-*`, `--credence-color-white`, `--credence-focus-ring`, font, line-height, radius, spacing, surface, and text tokens.

```tsx
<Button variant="primary" isLoading={isSaving} onClick={saveBond}>
  Save bond
</Button>
```

## Badge

Source: [`src/components/Badge.tsx`](../src/components/Badge.tsx).

| Prop        | Type                     | Default             |
| ----------- | ------------------------ | ------------------- |
| `variant`   | `BadgeVariant \| string` | Required            |
| `label`     | `string`                 | Known variant label |
| `className` | `string`                 | `''`                |

Accessibility: renders text in a `<span>`; consumers should provide surrounding context when the badge alone is not descriptive.

Tokens: tier/status color tokens, `--credence-font-size-xs`, `--credence-font-weight-semibold`, `--credence-radius-full`, `--credence-space-2`.

```tsx
<Badge variant="gold" />
<Badge variant="grace-period" label="Grace" />
```
