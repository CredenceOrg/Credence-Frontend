# Form Inputs & Variants

This document defines the standard states and behaviors for form input components in the Credence Frontend.

We maintain consistency across all inputs (text, numeric, selects, toggles) to ensure a predictable and accessible user experience. Reviewers should use this as a reference for verifying documented intent.

## Core States

Each form input variant supports the following states:

### 1. Default

The normal interactive state for the input.

- **Behavior**: Fully interactive, clear visual focus on interaction.
- **Implementation**: Standard props (`value`, `onChange`).

### 2. Error

Used when the input value fails validation or an external error is provided.

- **Behavior**: Visually distinguished (usually with a red border), accompanied by an error message.
- **Accessibility**:
  - `aria-invalid="true"` set on the input.
  - Error message is linked via `aria-describedby`.
  - Error message uses `role="alert"` for immediate announcement.

### 3. Success

Used when the input value has passed validation and the UI should confirm that fact inline.

- **Behavior**: Optional success border cue via `FormField` `data-state="success"`, accompanied by a short confirmation message.
- **Accessibility**:
  - Do **not** set `aria-invalid` for success.
  - Success message is linked via `aria-describedby` (`${id}-success`).
  - Success message uses `role="status"` (polite), never `role="alert"`.
  - When both `error` and `success` are supplied to `FormField`, **error wins** and success is suppressed.

### 4. Disabled

Used when an input is temporarily or permanently unavailable for interaction.

- **Behavior**: Reduced opacity, `not-allowed` cursor, interaction is suppressed.
- **Implementation**: Native `disabled` attribute on the underlying input/button.

### 5. Loading

Used when the component is waiting for data (e.g., fetching a balance or resolving an address).

- **Behavior**: Input is disabled, shows a visual loading indicator (spinner or skeleton).
- **Implementation**: `isLoading` prop. Prevents user interaction while preserving the layout.

---

## Component Catalog

### AddressInput

Canonical input for Stellar public keys.

- **Source**: `src/components/AddressInput.tsx`
- **Story**: `Components/Forms/AddressInput`
- **States**: Default, Error, Disabled, Loading. Surfacess "Recognized:" echo when valid.

### AmountInput

Controlled input for USDC amounts.

- **Source**: `src/components/AmountInput.tsx`
- **Story**: `Components/Forms/AmountInput`
- **States**: Default, Error (including over-balance), Disabled, Loading. Includes Max and preset buttons.

### Select

Standardized dropdown control.

- **Source**: `src/components/controls/Select.tsx`
- **Story**: `Components/Controls/Select`
- **States**: Default, Error, Disabled, Loading.

### Toggle

Switch control for boolean settings.

- **Source**: `src/components/controls/Toggle.tsx`
- **Story**: `Components/Controls/Toggle`
- **States**: Default (On/Off), Error, Disabled, Loading.

### FormField

A structural wrapper for inputs to provide labels, hints, error messages, and success confirmations.

- **Source**: `src/components/forms/FormField.tsx`
- **Story**: `Components/Forms/FormField`
- **Accessibility**: Ensures proper ARIA wiring between labels, hints, errors, success messages, and the child input. Use `srOnlyLabel` when the visible UI relies on a placeholder but a hidden `<label>` linked via `htmlFor`/`id` is still required for assistive technology. Prefer one message owner per field — either `FormField` or the control, not both.

### Input / Textarea

Token-styled native controls meant to sit inside `FormField`.

- **Source**: `src/components/forms/Input.tsx`, `src/components/forms/Textarea.tsx`
- **Story**: `Components/Forms/Input`
- **States**: Default, Error (via FormField / `aria-invalid`), Success (via FormField `data-state`), Disabled.
- **Usage**: Import from `src/components/forms` (`FormField`, `Input`, `Textarea`). Use `Input compact` for short values such as quiet-hours times.

---

## Developer Guidelines

1. **Always use FormField**: Wrap your inputs in `FormField` to ensure consistent labeling and accessibility wiring.
2. **Prefer Input/Textarea primitives**: Avoid ad-hoc inline styles on raw `<input>` / `<textarea>` in shared flows; use the forms primitives so focus, invalid, and disabled styles stay token-driven.
3. **Handle Loading States**: If your input depends on asynchronous data, use the `isLoading` prop to prevent partial state interaction.
4. **Validation**: Use `onValidationChange` (AddressInput) or `onValidityChange` (AmountInput) to gate form submission.
5. **Design Tokens**: Do not hard-code colors or spacing. Rely on `--credence-*` tokens defined in `DESIGN_TOKENS.md`.
6. **Shared field errors**: When one message applies to multiple controls (e.g. quiet-hours start/end), put `error` on a single `FormField` and point sibling controls at that alert id with `aria-describedby` + `aria-invalid` so screen readers hear one alert.
## Quality Checklist

- [ ] Input is reachable via keyboard (`Tab`).
- [ ] Focused state has a visible ring (`--credence-focus-ring`).
- [ ] Error messages are descriptive and helpful.
- [ ] Disabled states are not clickable/activatable.
- [ ] Loading states do not cause layout shifts.
