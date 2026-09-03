# Amount Precision & Overflow at the API Boundary

**Audience:** Contributors, reviewers, operators
**Applies to:** `src/api/amount.ts`, `src/api/client.ts` (`amountFields` / `ApiAmountError`)
**Related:** [`docs/API_CLIENT_POLICIES.md`](./API_CLIENT_POLICIES.md), [`openapi.yaml`](../openapi.yaml) (`Bond.amount`)

## Why this exists

Every USDC amount this app sends to the backend crosses `apiFetch` in
`src/api/client.ts`. Before this change, the body went through
`JSON.stringify` with **no amount guarantees**, and JavaScript silently
corrupts money-like numbers on that path:

| Input (caller)     | What used to go on the wire | Problem                                   |
| ------------------ | --------------------------- | ----------------------------------------- |
| `0.1 + 0.2`        | `0.30000000000000004`       | IEEE-754 drift sent verbatim              |
| `NaN`, `Infinity`  | `null`                      | `JSON.stringify` quirk; shape changes     |
| `1e21`             | `1e+21`                     | Exponent notation; strict decimals reject |
| `9007199254740993` | `9007199254740992`          | Silent rounding past `MAX_SAFE_INTEGER`   |
| `-5`, `1000.005`   | `-5`, `1000.005`            | No sign or scale validation, ever         |

The OpenAPI contract is explicit that amounts are decimal strings
(`Bond.amount`: _"decimal string (avoids float precision issues)"_), and the
UI helper `normalizeUSDC` (src/lib/format.ts) _rounds_ to 2 decimals via
`Number.toFixed(2)` — so nothing before this change could guarantee that the
amount a user saw, the amount a review showed, and the amount the backend
received were the same number.

## Design

Two pieces, mirroring the existing `rateLimit.ts` + `client.ts` pattern:

1. **`src/api/amount.ts` — exact decimal engine.** Parsing, validation, and
   canonical serialization using only string-digit manipulation and `BigInt`
   arithmetic. No floating-point operation ever touches an amount value.
   Numbers are interpreted as their **shortest round-trip decimal string**
   (`String(n)`); exponent forms (`1e-7`, `1e+21`) are expanded exactly by
   digit shifting.

2. **`src/api/client.ts` — the `amountFields` gate.** An opt-in request
   option that declares which body fields are decimal amounts. The gate runs
   **first** in `apiFetch` — before the rate limiter and before `fetch` —
   validates each declared field, and replaces it with its canonical decimal
   string on the wire.

```ts
import { apiFetch } from '@/api'

await apiFetch('/bonds', {
  method: 'POST',
  body: { borrower: address, amount: bondAmount }, // '1000.5' | 1000.5 | 1000n
  amountFields: { amount: { min: '1.00' } },
})
// Wire body: {"borrower":"G…","amount":"1000.50"}   ← exact, canonical string
```

## Invariants (each is covered by a named test)

1. **Exactness** — a declared amount leaves the client as a plain decimal
   string with exactly `rules.scale` fractional digits (`1000.5` →
   `'1000.50'`), no exponent, no leading zeros.
2. **No rounding, ever** — excess precision is _rejected_
   (`INVALID_SCALE`), never rounded or truncated the way `toFixed(2)` does.
   `0.1 + 0.2` is rejected, not sent as `0.30000000000000004` or coerced to
   `0.30`.
3. **Unsigned by design** — negative values are rejected (`NEGATIVE`);
   debits/credits are separate operations, not signed values.
4. **Bounded magnitude** — the scaled integer (`value × 10^scale`) must fit
   in a signed 64-bit integer (`9223372036854775807`), the Soroban/Stellar
   on-chain amount representation, and within optional `min`/`max` rules.
   At scale 2 the ceiling is `92233720368547758.07` (exactly `2^63 − 1`
   cents); at scale 7 it is `922337203685.4775807`.
5. **Reject before state change** — an invalid amount throws
   `ApiAmountError` _before_ the rate limiter is consulted and _before_
   `fetch` is called: no budget consumed, no network traffic, no partial or
   unauthorized server-side state.
6. **No caller mutation** — the caller's body object is never modified; the
   gate builds a shallow copy for the wire. Sibling fields and their JSON
   types pass through untouched.
7. **Determinism** — identical inputs produce byte-identical wire bodies
   across repeated and concurrent calls; the check order is fixed
   (`INVALID_RULES` → `INVALID_TYPE` → `EMPTY` → `INVALID_FORMAT`/
   `NOT_FINITE`/`NEGATIVE` → `INVALID_SCALE` → `BELOW_MIN` → `OVERFLOW`).
8. **Strict grammar** — plain unsigned decimals only: `/^\d+(\.\d+)?$/`
   after trimming. Signs (`+`/`-`), exponents, grouping separators,
   non-ASCII digits, and empty strings are all rejected with typed codes.
9. **Opt-in compatibility** — calls that do not declare `amountFields` are
   byte-for-byte identical to the previous behavior (including sending raw
   numbers), so no existing caller can break.

## Failure behavior & error taxonomy

Rejections throw `ApiAmountError extends ApiError` with a **synthetic
`status: 400`** (mirroring how `ApiRateLimitError` surfaces a client-side
rejection as 429), so existing `instanceof ApiError` handlers keep working:

```ts
err instanceof ApiError // true — existing handlers unchanged
err instanceof ApiAmountError
err.status // 400 (synthetic; the request never left the client)
err.field // 'amount' (null for body-level rejections)
err.code // see below
err.payload // { field, code }
```

| Code             | Meaning                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| `INVALID_BODY`   | `amountFields` declared but the body is not a JSON object                             |
| `MISSING`        | A declared field is absent or `undefined` on the body                                 |
| `INVALID_TYPE`   | Field holds `null`, a boolean, an object, …                                           |
| `EMPTY`          | Empty / whitespace-only string                                                        |
| `INVALID_FORMAT` | Not a plain unsigned decimal (`'abc'`, `'1e3'`, `'1,000'`, `'+1'`)                    |
| `NOT_FINITE`     | `NaN` / `±Infinity` (would otherwise serialize as `null`)                             |
| `NEGATIVE`       | Negative sign                                                                         |
| `INVALID_SCALE`  | More fractional digits than `rules.scale` allows (rejected, not rounded)              |
| `BELOW_MIN`      | Below the configured `min`                                                            |
| `OVERFLOW`       | Above the configured `max` or the int64 scaled-integer bound                          |
| `INVALID_RULES`  | The rules object itself is misconfigured (bad `scale`, unparsable bound, `min > max`) |

Declared fields are **required**: if a field is absent the call rejects with
`MISSING` rather than silently sending nothing. Send optional amounts by
declaring the field only on calls that include it.

## Compatibility, migration & rollback

- **No behavior change for existing callers.** The gate is opt-in; every
  current call site in the repo (settings PATCH, queries) omits
  `amountFields` and produces identical requests. The full pre-existing
  `client.test.ts` suite passes unmodified.
- **For amount-carrying calls (current and future):** declared values are
  serialized as **strings**, matching the `Bond.amount` OpenAPI contract.
  Callers that previously sent a raw number amount should expect the string
  form on the backend side once they opt in — this is the documented
  contract, not a regression.
- **Bond recovery compatibility:** `validateBondAmount` now returns the
  canonical two-decimal string (for example, `'500'` becomes `'500.00'`) to
  the bond submission boundary. This is intentional: converting it back to a
  JavaScript number would defeat the exactness guarantee. Stored historical
  numeric metadata remains accepted and is canonicalized when recovered.
- **`Number(-0)` vs `'-0'`:** the number `-0` canonicalizes to `'0.00'`
  (IEEE-754 `-0 === 0`, `String(-0) === '0'`), while the string `'-0'` is
  rejected as `NEGATIVE`. This asymmetry is intentional and tested.
- **Rollback:** revert the commit. No persisted state, no wire-format
  migration, and no backend coordination is involved; the feature is purely
  client-side and opt-in.

## Operational limitations

- **Top-level object bodies only.** `amountFields` resolves keys on the
  body object itself (no nested paths, no array bodies). Nested amount
  objects should be validated with `parseAmount` before being placed in the
  body.
- **Request-side only.** Response amounts (e.g. `Transaction.amountUsdc`,
  typed `number` in the spec) are still parsed by `JSON.parse` and subject
  to double rounding at extreme magnitudes. Use `parseAmount` /
  `tryParseAmount` (which accept string, number, and bigint) when consuming
  response amounts that must be exact; a spec-level change to decimal
  strings for response fields is the long-term fix.
- **Scale, not denomination, is validated.** The engine guarantees decimal
  shape and bounds; it does not know exchange rates or issuer metadata.
- The int64 ceiling is the **on-chain representability** bound, not a
  business limit. Set `max` (e.g. `{ max: '1000000.00' }`) for
  product-level caps.

## Security assumptions

- The client-side gate is a **correctness and defence-in-depth** control.
  The backend remains the authority on authorization: it must independently
  re-validate amounts (scale, sign, bounds, balance sufficiency) before any
  state change. Never rely on client validation for security.
- Rejection happens before `fetch`, so invalid amounts cannot consume
  rate-limit budget or leak request contents to the network.
- Error messages embed a truncated (≤ 40 char) preview of the offending
  value; they never echo full user input into logs.
- Amounts are unsigned, which removes an entire class of sign-flip/abs()
  mistakes from the request path.

## Testing

- `src/api/amount.test.ts` — unit + property coverage, including zero,
  minimum, maximum, near-overflow, fractional, and conversion-boundary
  values (`Number.MAX_SAFE_INTEGER`, `2^53`, `2^63`, `1e21`, `1e-7`,
  `0.1 + 0.2`) checked against an **independent oracle** (string-digit and
  char-walk implementations that deliberately differ from the production
  algorithm). Property tests use a fixed seed (mulberry32) so they are
  deterministic and cannot flake.
- `src/api/client.test.ts` — integration coverage at the real
  `apiFetch` → `fetch` boundary: byte-exact wire bodies, rejection before
  `fetch`, no rate-limit budget consumption on rejection, no caller-body
  mutation, repeated/concurrent determinism, and network-failure isolation.

Run them with:

```bash
npx vitest run src/api
```
