# Component Reference

This reference documents the shared Credence Frontend component library. Use it
when composing pages, adding variants, or reviewing whether a new UI element
should be built from existing primitives.

## Import Conventions

Prefer direct component imports from `src/components` or its subfolders:

```tsx
import Button from '@/components/Button'
import Badge from '@/components/Badge'
import { FormField } from '@/components/forms/FormField'
```

Use the `@` alias for app source imports. Keep relative imports for files that
live next to each other when that reads more clearly.

## Core Components

### `Button`

Path: `src/components/Button.tsx`

Use `Button` for primary commands, secondary actions, ghost actions, and
destructive confirmations.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `'primary' | 'secondary' | 'ghost' | 'danger'` | `'primary'` | Controls visual emphasis. |
| `isLoading` | `boolean` | `false` | Shows a spinner, sets `aria-busy`, and disables interaction. |
| `fullWidth` | `boolean` | `false` | Expands the button to its container width. |
| `children` | `ReactNode` | required | Visible button label or inline content. |

Example:

```tsx
<Button variant="primary" onClick={handleSave}>
  Save changes
</Button>
```

### `Badge`

Path: `src/components/Badge.tsx`

Use `Badge` for tier and status labels. Unknown variants intentionally fall back
to the `unknown` style so callers do not silently render unstyled text.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `BadgeVariant | string` | required | Known variants: `bronze`, `silver`, `gold`, `platinum`, `active`, `locked`, `slashed`, `grace-period`, `unknown`. |
| `label` | `string` | variant label | Overrides the default display label. |
| `className` | `string` | `''` | Appends custom classes. |

Example:

```tsx
<Badge variant="gold" />
<Badge variant="grace-period" label="Grace" />
```

### `Banner`

Path: `src/components/Banner.tsx`

Use `Banner` for contextual information, warnings, success feedback, and critical
messages. Warning and critical banners use `role="alert"`; info and success use
`role="status"`.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `severity` | `'info' | 'success' | 'warning' | 'critical'` | required | Controls icon, tone, and live-region role. |
| `children` | `ReactNode` | required | Message body. |
| `title` | `string` | undefined | Optional bold heading. |
| `dismissible` | `boolean` | false | Shows a close button and enables Escape dismissal on that button. |
| `onDismiss` | `() => void` | undefined | Called when the banner is dismissed. |
| `action` | `{ label; href?; onClick? }` | undefined | Inline CTA rendered as a link or button. |
| `returnFocusRef` | `RefObject<HTMLElement>` | `document.body` | Focus target after dismissal. |

Example:

```tsx
<Banner severity="warning" title="Review required" dismissible onDismiss={hideBanner}>
  Your bond details changed. Confirm before continuing.
</Banner>
```

### `ConfirmDialog`

Path: `src/components/ConfirmDialog.tsx`

Use `ConfirmDialog` for destructive bond withdrawal flows that require the user
to type `CONFIRM`. It uses a focus trap, blocks body scroll while open, and
returns focus through `useFocusTrap`.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `open` | `boolean` | required | Controls portal rendering. |
| `title` | `string` | required | Dialog heading. |
| `subtitle` | `string` | undefined | Optional explanatory text. |
| `breakdown` | `ConfirmDialogPenaltyBreakdown` | required | Bond amount, penalty, percent, and resulting balance. |
| `onConfirm` | `() => void` | required | Called only after the typed phrase matches. |
| `onCancel` | `() => void` | required | Called on cancel, backdrop click, or Escape. |
| `returnFocusRef` | `RefObject<HTMLElement | null>` | undefined | Focus target after close. |
| `confirmLabel` | `string` | `'Withdraw bond'` | Destructive action label. |

Example:

```tsx
<ConfirmDialog
  open={isOpen}
  title="Withdraw bond?"
  breakdown={breakdown}
  onCancel={close}
  onConfirm={withdraw}
/>
```

## Form and Input Components

### `FormField`

Path: `src/components/forms/FormField.tsx`

Use `FormField` to connect a label, hint, and error message to a single form
control. It clones the child element and injects `id`, `aria-describedby`, and
`aria-invalid`.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` | required | Shared by the label and child control. |
| `label` | `string` | required | Visible field label. |
| `hint` | `string` | undefined | Optional helper text. |
| `error` | `string` | undefined | Optional error text rendered with `role="alert"`. |
| `children` | `ReactElement` | required | A single input-like element. |

### `AddressInput`

Path: `src/components/AddressInput.tsx`

Use `AddressInput` for Stellar public key entry. It validates 56-character
addresses beginning with `G`, exposes validation changes, supports clipboard
paste, and echoes a truncated valid address.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` | required | Input id passed into `FormField`. |
| `label` | `string` | `'Stellar Address'` | Field label. |
| `value` | `string` | required | Controlled address value. |
| `onChange` | `(value: string) => void` | required | Called with raw address text. |
| `onValidationChange` | `(isValid: boolean) => void` | undefined | Called whenever validity changes. |
| `disabled` | `boolean` | `false` | Disables input and paste button. |
| `className` | `string` | `''` | Wrapper class. |

Utility:

- `truncateAddress(address)` returns the first 12 and last 8 characters with an
  ellipsis for long addresses.

### `AmountInput`

Path: `src/components/AmountInput.tsx`

Use `AmountInput` for USDC-style decimal amounts. It sanitizes numeric input,
normalizes to two decimals on blur, formats display when unfocused, and supports
quick presets plus a max button.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `value` | `string` | required | Controlled decimal string. |
| `onChange` | `(value: string) => void` | required | Receives sanitized or normalized value. |
| `balance` | `number` | required | Maximum value used by the Max button and preset disabled state. |
| `presets` | `number[]` | `[100, 500, 1000]` | Quick amount chips. |
| `currencyLabel` | `string` | `'USDC'` | Visible adornment and accessible labels. |
| `error` | `string` | undefined | Marks the wrapper invalid. |

Example:

```tsx
<AmountInput value={amount} onChange={setAmount} balance={availableBalance} />
```

## Trust Components

### `TrustGauge`

Path: `src/components/TrustGauge.tsx`

Use `TrustGauge` to display a 0-1000 trust score across Bronze, Silver, Gold,
and Platinum tiers. It renders an accessible progressbar plus a tier legend.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `score` | `number` | required | Current score. Values above 1000 visually clamp at 100%. |
| `tier` | `'bronze' | 'silver' | 'gold' | 'platinum'` | required | Current tier used for labels and next-tier text. |
| `className` | `string` | `''` | Wrapper class. |
| `id` | `string` | `'trust-gauge'` | Wrapper id. |

Related export:

- `TIER_CONFIG` contains tier thresholds, colors, and labels.

### `TierLadder`

Path: `src/components/TierLadder.tsx`

Use `TierLadder` for an expandable explanation of trust tiers, thresholds, and
benefits. Thresholds align with `docs/tier-thresholds.md`.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `className` | `string` | `''` | Section class. |
| `defaultOpen` | `boolean` | `false` | Initial expanded state. |

Related exports:

- `TIER_LADDER` is the ordered list of tier definitions.
- `TierDefinition` describes each tier's id, label, score range, and benefits.

## State Components

### `EmptyState`

Path: `src/components/states/EmptyState.tsx`

Use `EmptyState` when a view has no content yet and the user needs a next step.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `icon` | `ReactNode` | undefined | Custom icon node. |
| `title` | `string` | required | Heading. |
| `description` | `string` | required | Supporting copy. |
| `action` | `{ label; onClick; variant? }` | undefined | Optional CTA button. |
| `illustration` | `'bond' | 'trust' | 'dispute' | 'attestation' | 'activity'` | undefined | Token-backed preset illustration. |

### `ErrorState`

Path: `src/components/states/ErrorState.tsx`

Use `ErrorState` for recoverable errors. Preset types provide default title,
message, and icon copy.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `type` | `'network' | 'backend' | 'validation' | 'generic'` | `'generic'` | Selects default copy. |
| `title` | `string` | preset title | Overrides default title. |
| `message` | `string` | preset message | Overrides default message. |
| `action` | `{ label; onClick }` | undefined | Optional recovery button. |
| `icon` | `ReactNode` | preset icon | Overrides default icon. |

### `LoadingSkeleton`

Path: `src/components/states/LoadingSkeleton.tsx`

Use `LoadingSkeleton` for loading placeholders. It supports text, card, form,
table, dashboard, and fallback block shapes.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `variant` | `'text' | 'card' | 'form' | 'table' | 'dashboard'` | `'text'` | Skeleton layout. |
| `rows` | `number` | `3` | Number of repeated rows/cards. |
| `width` | `string` | `'100%'` | CSS width. |
| `height` | `string` | undefined | Fallback block height. |

## Control Components

### `Select`

Path: `src/components/controls/Select.tsx`

Use `Select` for simple native select controls where the caller owns the value.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` | undefined | Native select id. |
| `value` | `string` | required | Controlled selected value. |
| `onChange` | `(value: string) => void` | required | Called with the selected option value. |
| `options` | `{ value: string; label: string }[]` | required | Option list. |
| `ariaLabel` | `string` | undefined | Accessible label when no visible label exists. |

### `Toggle`

Path: `src/components/controls/Toggle.tsx`

Use `Toggle` for binary settings. It renders a button with `role="switch"` and
`aria-checked`.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `string` | undefined | Button id. |
| `checked` | `boolean` | required | Current switch state. |
| `onChange` | `(next: boolean) => void` | required | Called with the next state. |
| `ariaLabel` | `string` | undefined | Accessible label when surrounding text is not enough. |

## Review Checklist

Before adding or changing a shared component:

- Can an existing component or variant solve the need?
- Are public props exported and documented with TSDoc when useful?
- Does the component use design tokens instead of one-off visual values?
- Are labels, roles, focus behavior, and error states accessible?
- Are behavior tests or usage examples updated for new variants?
