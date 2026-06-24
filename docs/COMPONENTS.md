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

## Banner

Source: [`src/components/Banner.tsx`](../src/components/Banner.tsx). Focused docs: [notifications](./notifications.md).

| Prop             | Type                                                     | Default                  |
| ---------------- | -------------------------------------------------------- | ------------------------ |
| `severity`       | `BannerSeverity`                                         | Required                 |
| `children`       | `ReactNode`                                              | Required                 |
| `title`          | `string`                                                 | `undefined`              |
| `dismissible`    | `boolean`                                                | `undefined`              |
| `onDismiss`      | `() => void`                                             | `undefined`              |
| `action`         | `{ label: string; href?: string; onClick?: () => void }` | `undefined`              |
| `returnFocusRef` | `React.RefObject<HTMLElement>`                           | `document.body` fallback |

Accessibility: severity maps to `role="alert"` for warning/critical and `role="status"` for info/success. The root has an aria label such as “Warning banner”. Dismiss buttons have `aria-label="Dismiss banner"`, support Escape while focused, and return focus to `returnFocusRef` or `document.body` after dismissal. Icons are aria-hidden.

Tokens: motion duration/easing tokens in CSS; severity color styling is component-owned CSS values and should be reviewed during token migrations.

```tsx
<Banner severity="warning" title="Review required" dismissible onDismiss={closeBanner}>
  Your bond evidence needs one more attestation.
</Banner>
```

## Toast and ToastProvider

Sources: [`src/components/Toast.tsx`](../src/components/Toast.tsx), [`src/components/ToastProvider.tsx`](../src/components/ToastProvider.tsx). Focused docs: [notifications](./notifications.md).

### Toast props

| Prop        | Type                                                       | Default  |
| ----------- | ---------------------------------------------------------- | -------- |
| `toast`     | `{ id: string; severity: ToastSeverity; message: string }` | Required |
| `onDismiss` | `(id: string) => void`                                     | Required |

### ToastProvider API

| API                          | Type                                                 | Default       |
| ---------------------------- | ---------------------------------------------------- | ------------- |
| `children` prop              | `ReactNode`                                          | Required      |
| `useToast().addToast`        | `(severity: ToastSeverity, message: string) => void` | Context value |
| `useToast().removeToast`     | `(id: string) => void`                               | Context value |
| `useToast().removeAllToasts` | `() => void`                                         | Context value |

Accessibility: individual danger toasts use `role="alert"`; other severities use `role="status"`. Provider separates polite notifications into `aria-live="polite"` and danger notifications into `aria-live="assertive"` regions, each with a region label. Dismiss buttons have severity-specific accessible names.

Tokens: `--credence-font-size-*`, `--credence-line-height-base`, motion duration/easing, `--credence-radius-md`, `--credence-shadow-toast`, spacing, `--credence-surface-card`, `--credence-text-primary`.

```tsx
function SaveButton() {
  const { addToast } = useToast()
  return <Button onClick={() => addToast('success', 'Bond saved')}>Save</Button>
}
```

## ConfirmDialog

Source: [`src/components/ConfirmDialog.tsx`](../src/components/ConfirmDialog.tsx). Focused docs: [focus patterns](./focus-patterns.md).

| Prop             | Type                                                                                              | Default           |
| ---------------- | ------------------------------------------------------------------------------------------------- | ----------------- |
| `open`           | `boolean`                                                                                         | Required          |
| `title`          | `string`                                                                                          | Required          |
| `subtitle`       | `string`                                                                                          | `undefined`       |
| `breakdown`      | `{ bondAmount: string; penaltyAmount: string; penaltyPercent: number; resultingBalance: string }` | Required          |
| `onConfirm`      | `() => void`                                                                                      | Required          |
| `onCancel`       | `() => void`                                                                                      | Required          |
| `returnFocusRef` | `RefObject<HTMLElement \| null>`                                                                  | `undefined`       |
| `confirmLabel`   | `string`                                                                                          | `'Withdraw bond'` |

Accessibility: renders in a portal with `role="dialog"`, `aria-modal="true"`, generated `aria-labelledby`/`aria-describedby`, focus trap, initial focus on Cancel, Escape and backdrop cancellation, body scroll lock, and optional focus restoration. The destructive action is disabled until the user types `CONFIRM`; assertive sr-only announcements describe state changes.

Tokens: danger color tokens, font family/size/weight, line-height, motion, radius, spacing, surface, and text tokens.

```tsx
<ConfirmDialog
  open={isOpen}
  title="Withdraw bond?"
  breakdown={{
    bondAmount: '100 USDC',
    penaltyAmount: '5 USDC',
    penaltyPercent: 5,
    resultingBalance: '95 USDC',
  }}
  onConfirm={withdraw}
  onCancel={close}
/>
```

## AddressInput

Source: [`src/components/AddressInput.tsx`](../src/components/AddressInput.tsx).

| Prop                 | Type                         | Default             |
| -------------------- | ---------------------------- | ------------------- |
| `id`                 | `string`                     | Required            |
| `label`              | `string`                     | `'Stellar Address'` |
| `value`              | `string`                     | Required            |
| `onChange`           | `(value: string) => void`    | Required            |
| `onValidationChange` | `(isValid: boolean) => void` | `undefined`         |
| `disabled`           | `boolean`                    | `false`             |
| `className`          | `string`                     | `''`                |

Accessibility: composes `FormField`, so label, hint, and error IDs wire through `htmlFor`, `aria-describedby`, and `aria-invalid`. Paste and copy controls are native buttons with explicit aria labels and hidden SVGs. Validation requires a 56-character Stellar public key starting with `G`; invalid feedback is exposed by the FormField alert.

Tokens: border, danger, primary, slate, success, focus, font, line-height, motion, radius, spacing, surface, and text tokens.

```tsx
<AddressInput
  id="recipient"
  value={address}
  onChange={setAddress}
  onValidationChange={setAddressValid}
/>
```

## AmountInput

Source: [`src/components/AmountInput.tsx`](../src/components/AmountInput.tsx). Focused docs: [USDC amount input](./uiux/usdc-amount-input.md).

| Prop               | Type                                                                                | Default            |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------ |
| `value`            | `string`                                                                            | Required           |
| `onChange`         | `(value: string) => void`                                                           | Required           |
| `balance`          | `number`                                                                            | Required           |
| `presets`          | `number[]`                                                                          | `[100, 500, 1000]` |
| `currencyLabel`    | `string`                                                                            | `'USDC'`           |
| `error`            | `string`                                                                            | `undefined`        |
| Native input props | `Omit<InputHTMLAttributes<HTMLInputElement>, 'value' \| 'onChange' \| 'inputMode'>` | Forwarded          |

Accessibility: uses a native input with `inputMode="decimal"`, disables browser autocomplete, exposes invalid state when `error` or `aria-invalid="true"` is supplied, hides the currency adornment, and gives Max/preset buttons descriptive aria labels. Presets above balance and Max at zero balance are disabled.

Tokens: border, danger-border, slate, focus, font, motion, radius, spacing, surface, and text tokens.

```tsx
<AmountInput value={amount} onChange={setAmount} balance={availableUsdc} error={amountError} />
```

## TrustGauge

Source: [`src/components/TrustGauge.tsx`](../src/components/TrustGauge.tsx). Focused docs: [TrustGauge quick reference](./TRUST_GAUGE_QUICK_REFERENCE.md), [accessibility report](./TRUST_GAUGE_ACCESSIBILITY_REPORT.md).

| Prop        | Type                                           | Default         |
| ----------- | ---------------------------------------------- | --------------- |
| `score`     | `number`                                       | Required        |
| `tier`      | `'bronze' \| 'silver' \| 'gold' \| 'platinum'` | Required        |
| `className` | `string`                                       | `''`            |
| `id`        | `string`                                       | `'trust-gauge'` |

Accessibility: includes visible heading/description, a `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="1000"`, and an aria label summarizing score and tier. Decorative fills, thumb, and legend dots are presentational or aria-hidden.

Tokens: tier color tokens, `--credence-color-primary`, slate, focus, font, line-height, motion, radius, and spacing tokens. Dynamic inline CSS custom properties set progress width, marker position, thumb position, and legend-dot color.

```tsx
<TrustGauge score={640} tier="gold" />
```

## TierLadder

Source: [`src/components/TierLadder.tsx`](../src/components/TierLadder.tsx). Focused docs: [tier thresholds](./tier-thresholds.md).

| Prop          | Type      | Default |
| ------------- | --------- | ------- |
| `className`   | `string`  | `''`    |
| `defaultOpen` | `boolean` | `false` |

Accessibility: root section is labelled by an sr-only heading. Trigger is a native button with `aria-expanded` and `aria-controls`; the panel uses `hidden` when collapsed. Decorative rail and chevron are aria-hidden. Tier content is structured as an ordered list with nested headings and benefit lists.

Tokens: border, tier color tokens, slate, focus, font, line-height, motion, radius, spacing, surface, and text tokens.

```tsx
<TierLadder defaultOpen />
```

## ActivityTimeline

Source: [`src/components/ActivityTimeline.tsx`](../src/components/ActivityTimeline.tsx). Focused docs: [activity surface concept](./ACTIVITY_SURFACE_CONCEPT.md).

| Prop      | Type             | Default                |
| --------- | ---------------- | ---------------------- |
| `compact` | `boolean`        | `false`                |
| `items`   | `ActivityItem[]` | Built-in sample events |

`ActivityItem` is `{ id: string; timestamp: string; title: string; description: string; actor: string; statusLabel: string; tone: 'success' | 'warning' | 'info'; meta: string }`.

Accessibility: renders a labelled section and a labelled timeline list. Decorative rails/nodes are aria-hidden. Empty data delegates to `EmptyState` with activity illustration and explanatory copy.

Tokens: border, info/success/warning color tokens, primary, font, line-height, radius, spacing, surface, and text tokens.

```tsx
<ActivityTimeline compact items={events} />
```

## FormField

Source: [`src/components/forms/FormField.tsx`](../src/components/forms/FormField.tsx).

| Prop       | Type                 | Default     |
| ---------- | -------------------- | ----------- |
| `id`       | `string`             | Required    |
| `label`    | `string`             | Required    |
| `hint`     | `string`             | `undefined` |
| `error`    | `string`             | `undefined` |
| `children` | `React.ReactElement` | Required    |

Accessibility: renders a `<label htmlFor={id}>`, optional hint, clones the child to inject `id`, merged `aria-describedby`, and `aria-invalid` when an error exists. Error text has `role="alert"`.

Tokens: `--credence-color-danger-text`, `--credence-font-size-sm`, `--credence-font-weight-semibold`, `--credence-space-2`, `--credence-text-secondary`.

```tsx
<FormField id="amount" label="Bond amount" hint="Enter USDC" error={error}>
  <input value={amount} onChange={handleAmountChange} />
</FormField>
```

## controls/Select

Source: [`src/components/controls/Select.tsx`](../src/components/controls/Select.tsx).

| Prop        | Type                                 | Default     |
| ----------- | ------------------------------------ | ----------- |
| `id`        | `string`                             | `undefined` |
| `value`     | `string`                             | Required    |
| `onChange`  | `(v: string) => void`                | Required    |
| `options`   | `{ value: string; label: string }[]` | Required    |
| `ariaLabel` | `string`                             | `undefined` |

Accessibility: renders a native `<select>` with optional `id` and `aria-label`; pair with a visible `<label>` via `id` when possible. Native keyboard behavior is preserved.

Tokens: shared control CSS consumes border, primary, white, focus, font, line-height, motion, radius, spacing, surface, and text tokens.

```tsx
<Select
  id="tier-filter"
  value={tier}
  onChange={setTier}
  ariaLabel="Filter by tier"
  options={[{ value: 'gold', label: 'Gold' }]}
/>
```

## controls/Toggle

Source: [`src/components/controls/Toggle.tsx`](../src/components/controls/Toggle.tsx).

| Prop        | Type                      | Default     |
| ----------- | ------------------------- | ----------- |
| `id`        | `string`                  | `undefined` |
| `checked`   | `boolean`                 | Required    |
| `onChange`  | `(next: boolean) => void` | Required    |
| `ariaLabel` | `string`                  | `undefined` |

Accessibility: renders a native button with `role="switch"` and `aria-checked`; label it with `ariaLabel` or external labelling. Click toggles state; Space/Enter activation comes from button semantics.

Tokens: shared control CSS consumes border, primary, white, focus, font, line-height, motion, radius, spacing, surface, and text tokens.

```tsx
<Toggle checked={toastsEnabled} onChange={setToastsEnabled} ariaLabel="Enable notifications" />
```

## states/EmptyState

Source: [`src/components/states/EmptyState.tsx`](../src/components/states/EmptyState.tsx). Focused docs: [UI states guide](./UI_STATES_GUIDE.md), [zero states copy](./zero-states-copy.md).

| Prop           | Type                                                                         | Default     |
| -------------- | ---------------------------------------------------------------------------- | ----------- |
| `icon`         | `ReactNode`                                                                  | `undefined` |
| `title`        | `string`                                                                     | Required    |
| `description`  | `string`                                                                     | Required    |
| `action`       | `{ label: string; onClick: () => void; variant?: 'primary' \| 'secondary' }` | `undefined` |
| `illustration` | `'bond' \| 'trust' \| 'dispute' \| 'attestation' \| 'activity'`              | `undefined` |

Accessibility: illustration SVGs are aria-hidden; the accessible name comes from the visible title and description. Optional action is a native button. There is no landmark role; place inside a labelled region when context is needed.

Tokens: inline styles consume illustration color tokens, radius, spacing, font, line-height, text, border, primary, and white tokens. Inline styles are flagged for migration.

```tsx
<EmptyState
  title="No bonds yet"
  description="Create a bond to start earning trust."
  action={{ label: 'Create bond', onClick: start }}
/>
```

## states/ErrorState

Source: [`src/components/states/ErrorState.tsx`](../src/components/states/ErrorState.tsx). Focused docs: [UI states guide](./UI_STATES_GUIDE.md).

| Prop      | Type                                                  | Default               |
| --------- | ----------------------------------------------------- | --------------------- |
| `type`    | `'network' \| 'backend' \| 'validation' \| 'generic'` | `'generic'`           |
| `title`   | `string`                                              | Type-specific title   |
| `message` | `string`                                              | Type-specific message |
| `action`  | `{ label: string; onClick: () => void }`              | `undefined`           |
| `icon`    | `ReactNode`                                           | Type-specific emoji   |

Accessibility: visible title/message describe the error; optional action is a native button. No `role="alert"` is set, so add surrounding live-region behavior when errors are asynchronous and need announcement.

Tokens: inline styles consume danger surface/text/action, white, radius, spacing, font, line-height, and border tokens. Inline styles are flagged for migration.

```tsx
<ErrorState type="network" action={{ label: 'Retry', onClick: refetch }} />
```

## states/LoadingSkeleton

Source: [`src/components/states/LoadingSkeleton.tsx`](../src/components/states/LoadingSkeleton.tsx). Focused docs: [UI states guide](./UI_STATES_GUIDE.md).

| Prop      | Type                                                   | Default     |
| --------- | ------------------------------------------------------ | ----------- |
| `variant` | `'text' \| 'card' \| 'form' \| 'table' \| 'dashboard'` | `'text'`    |
| `rows`    | `number`                                               | `3`         |
| `width`   | `string`                                               | `'100%'`    |
| `height`  | `string`                                               | `undefined` |

Accessibility: purely visual placeholder with no aria attributes. Pair with `aria-busy`, status text, or route-level loading announcements when loading state needs to be exposed to assistive technologies.

Tokens: inline styles consume `--credence-skeleton-gradient`, `--credence-motion-skeleton`, border, radius, spacing, and layout values. Inline styles are flagged for migration.

```tsx
<LoadingSkeleton variant="card" rows={2} />
```
