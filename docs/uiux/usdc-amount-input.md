# USDC amount input pattern

This introduces a reusable USDC amount input pattern for `Bond` that improves UX for entering financial amounts with formatting and quick actions. Balance is mocked (UI-only).

## Behavior

- **Currency adornment**: shows `USDC` inside the input as a suffix (visual affordance only).
- **Thousands formatting**: when the input is not focused, the value is displayed with grouping separators and **2 decimal places** (e.g. `12,345.60`).
- **Editing**: while focused, the raw value is shown (no commas) to avoid cursor-jumps; invalid characters are stripped.
- **Normalization**:
  - On blur, values normalize to 2 decimals (e.g. `12345.6` → `12345.60`).
  - Presets/Max set normalized values immediately.

## Presets and Max

- Preset chips: `100`, `500`, `1000` (USDC).
- Presets are disabled when the preset amount is greater than the available balance.
- **Mock available balance**: `2500.00` USDC.
- “Max” sets the amount to the mocked available balance.

## Validation (UI-only)

- Error displays only when `amount > balance`.
- Error is announced via `FormField` using `role="alert"`.

## Visual QA

- Route: `/bond`
- Viewports: 375×800 and 1280×800
- Check: adornment, Max, presets, focus-visible ring, error state when amount > 2500.00

## Test Coverage

- `src/components/AmountInput.test.ts` covers `sanitizeUSDCInput`, `normalizeUSDC`, and `formatUSDC` with table-driven USDC edge cases.
- React Testing Library coverage verifies typing sanitization, blur normalization, Max balance selection, preset disabling, and disabled Max behavior when balance is zero.
