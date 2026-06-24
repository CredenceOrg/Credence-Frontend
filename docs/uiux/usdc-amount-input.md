# USDC Amount Input

`AmountInput` is the canonical controlled input for USDC amounts. It handles sanitization, formatting, balance-aware preset/Max disabling, and — as of this update — inline over-balance validation.

---

## Props

| Prop               | Type                         | Default            | Description                                                                                                    |
| ------------------ | ---------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `value`            | `string`                     | —                  | Controlled decimal amount string (e.g. `"100.00"`)                                                             |
| `onChange`         | `(value: string) => void`    | —                  | Called with sanitized value on each keystroke; normalized value on blur                                        |
| `balance`          | `number`                     | —                  | Available balance; drives Max/preset disabling and over-balance validation                                     |
| `presets`          | `number[]`                   | `[100, 500, 1000]` | Quick-select amounts rendered as chips below the input                                                         |
| `currencyLabel`    | `string`                     | `"USDC"`           | Label shown as input adornment and in aria-labels                                                              |
| `error`            | `string`                     | —                  | Explicit error message; takes precedence over the internal over-balance error                                  |
| `onValidityChange` | `(isValid: boolean) => void` | —                  | Called whenever internal validity changes; lets callers gate submission without re-implementing the comparison |

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

### `onValidityChange` callback

```tsx
<AmountInput
  value={amount}
  onChange={setAmount}
  balance={walletBalance}
  onValidityChange={(isValid) => setCanSubmit(isValid)}
/>
```

Use this to gate submit buttons or progress steps without re-implementing `numericValue > balance` in the page layer.

---

## Aria / accessibility

- The error `<span>` has `role="alert"` so screen readers announce it immediately on appearance.
- `aria-invalid="true"` is set on the `<input>` when any error (internal or explicit) is active.
- `aria-describedby` on the `<input>` is merged with any value supplied by the caller, so wrapping in `<FormField>` continues to work correctly (hint + error ids are all chained).

---

## Address display formatting

When entering a Stellar address, `AddressInput` shows a **Recognized:** echo once the address is valid.

The text shown in this echo respects **Settings → Display → Address format**.

---

## Test Coverage

- `src/components/AmountInput.test.ts` covers `sanitizeUSDCInput`, `normalizeUSDC`, and `formatUSDC` with table-driven USDC edge cases.
- `src/components/AmountInput.test.tsx` (React Testing Library) covers:
  - Typing sanitization, blur normalization, Max balance selection, preset disabling
  - Over-balance error rendering (value over / at / under balance, empty value)
  - `aria-invalid` and `aria-describedby` wiring
  - Explicit `error` prop overriding internal over-balance error
  - `onValidityChange` callback for all validity transitions
  - `balance: 0` — Max disabled but typed value still validates
