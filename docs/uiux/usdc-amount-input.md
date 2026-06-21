# USDC Amount Input

(Existing content omitted for brevity)

## Address display formatting

When entering a Stellar address, `AddressInput` shows a **Recognized:** echo once the address is valid.

The text shown in this echo respects **Settings → Display → Address format**:

## Test Coverage

- `src/components/AmountInput.test.ts` covers `sanitizeUSDCInput`, `normalizeUSDC`, and `formatUSDC` with table-driven USDC edge cases.
- React Testing Library coverage verifies typing sanitization, blur normalization, Max balance selection, preset disabling, and disabled Max behavior when balance is zero.
