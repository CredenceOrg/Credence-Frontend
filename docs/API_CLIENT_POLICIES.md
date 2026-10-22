# API Client Policies

This document outlines the core behaviors of our internal API client (`src/api/client.ts`), specifically regarding interceptors, retry policies, and error taxonomy.

**Audience:** Contributors

## Interceptors

Currently, the `apiFetch` utility does not implement a global interceptor registry (like Axios). Instead, cross-cutting concerns (like default headers, base URLs) are handled directly within the `apiFetch` execution flow.

For instance, the `Accept` and `Content-Type` headers are automatically injected for JSON payloads:

```typescript
// src/api/client.ts
function buildHeaders(headers: HeadersInit | undefined, hasJsonBody: boolean): Headers {
  const nextHeaders = new Headers(headers)
  if (!nextHeaders.has('Accept')) {
    nextHeaders.set('Accept', 'application/json')
  }
  if (hasJsonBody && !nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json')
  }
  return nextHeaders
}
```

If you need to intercept requests or responses (e.g., for authentication tokens), wrap `apiFetch` in a custom hook or service layer rather than modifying `apiFetch` itself.

## Retry Policy

We do not automatically retry failed API requests at the `apiFetch` level. This is an intentional design decision to avoid compounding network issues or duplicating non-idempotent requests (like `POST` operations).

If a specific component or query requires retries (e.g., fetching a user's wallet balance), that logic should be implemented at the React Query level (or equivalent state management layer) using its built-in retry configurations.

## Error Taxonomy
### `errorMessage` — Deterministic Failure Boundaries

`errorMessage(error)` in `src/api/client.ts` maps any thrown value to a
user-safe, deterministic string. It is the single boundary every caller should
use when rendering an error, so its behavior is pinned by focused tests.

Invariants (all enforced by `src/api/__tests__/client.errorMessage.test.ts`):

1. **Total function.** Any input — `Error`, `ApiError`, `ApiAmountError`,
   `DOMException`, `AbortError`, plain object, `null`, `undefined`, string,
   number, symbol, or a throwing getter — returns a non-empty `string`. It
   never throws and never returns `undefined`.
2. **`ApiError` precedence.** When the value is an `ApiError` (including the
   `ApiAmountError` subclass) with a non-empty `message`, that message is
   returned verbatim. The synthetic `status: 400` on `ApiAmountError` does not
   change the message.
3. **Abort is not an error.** `AbortError` (by `name`) resolves to the stable
   cancellation string, never the raw native message, so cancellation is not
   surfaced as a failure.
4. **Network fallback.** `ApiError` with `status: 0` and an empty/whitespace
   message falls back to `"Network request failed"`.
5. **Unknown values.** Non-`Error` inputs and empty messages fall back to a
   single generic string; no `[object Object]`, no `String(Symbol())` throw,
   and no leakage of `payload` (which may contain server internals).
6. **Determinism.** Identical inputs always produce identical outputs; the
   function reads no ambient state (no `Date`, `Math.random`, locale, or I/O).

Security: `errorMessage` deliberately never serializes `error.payload` or
`error.stack`. Server payloads can contain tokens, PII, or stack traces, so
only the curated `message` is exposed. Callers that need structured handling
should branch on `error instanceof ApiError` and inspect `status`/`payload`
themselves rather than routing through `errorMessage`.

Compatibility: the exported signature `errorMessage(error: unknown): string`
is unchanged. Existing callers that passed `Error` or `ApiError` observe the
same strings; only previously-undefined behavior (non-`Error` inputs, empty
messages) is now pinned to the documented fallbacks.


All failed API requests surface as an `ApiError`. This taxonomy ensures consumers can reliably switch on the `status` code or inspect the server `payload`.

### `ApiError` Structure

```typescript
export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown

  constructor(status: number, message: string, payload?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}
```

### Error Scenarios

1. **Network Failures / CORS:**
   Throws an `ApiError` with `status: 0`. The message falls back to the native error message or `"Network request failed"`.
2. **Abort / Cancellation:**
   If the fetch is aborted via an `AbortSignal`, the native `AbortError` is re-thrown. It is _not_ wrapped in an `ApiError`.
3. **HTTP Status Errors (4xx, 5xx):**
   Throws an `ApiError` with the actual HTTP status code (e.g., `status: 404`). The `payload` will contain the parsed JSON response (if available).

### Example Usage

```typescript
import { apiFetch, ApiError } from '../api/client'

async function submitData() {
  try {
    await apiFetch('/users', {
      method: 'POST',
      body: { name: 'Alice' },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 400) {
        console.error('Validation failed:', error.payload)
      } else if (error.status === 0) {
        console.error('Network offline or CORS issue')
      }
    } else if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request was cancelled')
    }
    // Prefer the boundary helper when rendering to the user:
    // setBanner(errorMessage(error))
  }
}
```

### Failure-Boundary Test Matrix

| Scenario            | Input                                   | Expected output                     |
| ------------------- | --------------------------------------- | ----------------------------------- |
| Success (no error)  | `null` / `undefined`                    | generic fallback string             |
| `ApiError` 4xx/5xx  | `new ApiError(404, 'Not found')`        | `"Not found"`                       |
| `ApiError` network  | `new ApiError(0, '')`                   | `"Network request failed"`          |
| `ApiAmountError`    | `new ApiAmountError('amount', 'OVERFLOW', '…')` | its `message` verbatim      |
| Abort               | `Object.assign(new Error(), { name: 'AbortError' })` | cancellation string   |
| Boundary: empty msg | `new ApiError(500, '   ')`              | generic fallback string             |
| Hostile input       | `Symbol('x')`, throwing getter          | generic fallback string, no throw   |
| Duplicate calls     | same input twice                        | identical output (determinism)      |

Retries and concurrent execution are unaffected: `errorMessage` is pure and
stateless, so it cannot introduce ordering, timing, or shared-state hazards.
Partial failures surface per-call through the same deterministic mapping.

## Amount Precision & Overflow

Requests that carry monetary amounts should declare them with the opt-in
`amountFields` option so they are validated and canonicalized **exactly** at
this boundary — before the rate limiter and before the network:

```typescript
// src/api/client.ts
await apiFetch('/bonds', {
  method: 'POST',
  body: { borrower: address, amount: '1000.5' },
  amountFields: { amount: { min: '1.00' } }, // or simply ['amount'] for defaults
})
// Wire body: {"borrower":"G…","amount":"1000.50"} — canonical decimal string
```

Why: `JSON.stringify` alone silently corrupts money — `0.1 + 0.2` becomes
`0.30000000000000004`, `NaN`/`Infinity` become `null`, large numbers become
exponent notation, and nothing checks sign, scale, or magnitude. The
`amountFields` gate (backed by `src/api/amount.ts`, a `BigInt`-only decimal
engine) guarantees:

- exact decimal-string serialization with fixed scale (default 2, USDC),
- rejection — never rounding — of excess precision (`INVALID_SCALE`),
- rejection of negative values (`NEGATIVE`) and non-finite numbers
  (`NOT_FINITE`),
- an overflow bound: the scaled integer must fit in a signed 64-bit integer
  (`OVERFLOW` above `92233720368547758.07` at scale 2), plus optional
  `min`/`max` rules,
- no rate-limit budget consumption, no network call, and no caller-body
  mutation when a value is rejected.

Invalid amounts throw `ApiAmountError extends ApiError` with a synthetic
`status: 400`, plus structured `field` / `code` / `payload` for handling.
Calls that omit `amountFields` keep their exact previous behavior.

See [docs/AMOUNT_PRECISION.md](./AMOUNT_PRECISION.md) for the full design,
invariants, error taxonomy, compatibility, and rollback notes.
