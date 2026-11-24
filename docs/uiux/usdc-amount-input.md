# USDC Amount Input

`AmountInput` is the canonical controlled input for USDC amounts. It handles sanitization, formatting, balance-aware preset/Max disabling, and — as of this update — inline over-balance validation.

---

## Props

| Prop               | Type                         | Default            | Description                                                                                                                   |
| ------------------ | ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `value`            | `string`                     | —                  | Controlled decimal amount string (e.g. `"100.00"`)                                                                            |
| `onChange`         | `(value: string) => void`    | —                  | Called with sanitized value on each keystroke; normalized value on blur                                                       |
| `balance`          | `number`                     | —                  | Available balance; drives Max/preset disabling and over-balance validation                                                    |
| `presets`          | `number[]`                   | `[100, 500, 1000]` | Quick-select amounts rendered as chips below the input                                                                        |
| `currencyLabel`    | `string`                     | `"USDC"`           | Label shown as input adornment and in aria-labels                                                                             |
| `error`            | `string`                     | —                  | Explicit error message; takes precedence over all internal errors                                                             |
| `onValidityChange` | `(isValid: boolean) => void` | —                  | Called whenever internal validity changes; lets callers gate submission without re-implementing the comparison                |
| `isLoading`        | `boolean`                    | `false`            | Shows skeleton/spinner and disables all interaction                                                                           |
| `min`              | `number`                     | —                  | Minimum allowed amount; triggers an inline error and `onValidityChange(false)` when the entered value is below this threshold |

---

## Validation contract

### Over-balance detection (internal)

The component compares `normalizeUSDC(value)` against `balance` on every render. When the numeric value exceeds `balance` (and no explicit `error` prop is supplied), it:

1. Renders an inline `⚠ Amount exceeds available balance.` message in a `<span role="alert">`.
2. Sets `aria-invalid="true"` on the `<input>`.
3. Links the error to the input via `aria-describedby` (the error element's `id`).
4. Sets `data-invalid="true"` on the wrapper `<div>` (for CSS styling).
5. Calls `onValidityChange(false)` if the callback is provided.

When the value is empty, equal to, or below balance the component is valid and the error is not rendered.

### Explicit `error` prop

Passing a non-empty `error` string always wins over the internal check. This covers server-side or additional form-level errors (e.g. "Minimum bond is 10 USDC"). The explicit error is rendered in the same `<span role="alert">` element.

### Below-minimum detection (internal)

When `min` is supplied and the numeric value is greater than zero but less than `min`, the component:

1. Renders an inline `⚠ Amount must be at least <min> <currencyLabel>.` message in a `<span role="alert">`.
2. Sets `aria-invalid="true"` on the `<input>`.
3. Links the error to the input via `aria-describedby`.
4. Sets `data-invalid="true"` on the wrapper `<div>`.
5. Calls `onValidityChange(false)` if the callback is provided.

When the value is empty or at/above `min` the below-minimum error is not rendered.

**Precedence**: explicit `error` prop always wins; over-balance takes precedence over below-minimum when both conditions hold simultaneously.

```tsx
<AmountInput
  value={amount}
  onChange={setAmount}
  balance={walletBalance}
  min={10}
  onValidityChange={(isValid) => setCanSubmit(isValid)}
/>
```

### `onValidityChange` callback

```tsx
<AmountInput
  value={amount}
  onChange={setAmount}
  balance={walletBalance}
  onValidityChange={(isValid) => setCanSubmit(isValid)}
/>
```

`onValidityChange(false)` fires whenever **either** the over-balance or below-minimum check fails. `onValidityChange(true)` fires when both pass (or the value is empty). Use this to gate submit buttons or progress steps without re-implementing the comparisons in the page layer.

---

## Aria / accessibility

- The error `<span>` has `role="alert"` so screen readers announce it immediately on appearance.
- `aria-invalid="true"` is set on the `<input>` when any error (internal or explicit) is active.
- `aria-describedby` on the `<input>` is merged with any value supplied by the caller, so wrapping in `<FormField>` continues to work correctly (hint + error ids are all chained).

---

## Address display formatting

When entering a Stellar address, `AddressInput` shows a **Recognized:** echo once the address is valid.

The text shown in this echo respects **Settings → Display → Address format** (`addressDisplay`).

| Setting value | Format                                    | Example                                                    |
| ------------- | ----------------------------------------- | ---------------------------------------------------------- |
| `short`       | First 12 chars + `...` + last 8 (default) | `GBRPYHIL2CI3...X2H`                                       |
| `full`        | Complete 56-character key                 | `GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H` |
| `friendly`    | First 6 chars + `…` (U+2026) + last 4     | `GBRPYH…X2H`                                               |

The helper function `formatAddressForDisplay(address, mode)` in `src/lib/stellar.ts` is the single source of truth for this logic. Import it directly if you need to format an address in any other component.

## Test Coverage

- `src/components/AmountInput.test.ts` covers `sanitizeUSDCInput`, `normalizeUSDC`, and `formatUSDC` with table-driven USDC edge cases.
- `src/components/AmountInput.test.tsx` (React Testing Library) covers:
  - Typing sanitization, blur normalization, Max balance selection, preset disabling
  - Over-balance error rendering (value over / at / under balance, empty value)
  - Below-minimum error rendering (value below / at / above `min`, empty value, custom `currencyLabel`)
  - Over-balance takes precedence over below-minimum when both conditions hold
  - `aria-invalid` and `aria-describedby` wiring for both over-balance and below-minimum states
  - Explicit `error` prop overriding both internal errors
  - `onValidityChange` callback for all validity transitions including below-minimum
  - `balance: 0` — Max disabled but typed value still validates
