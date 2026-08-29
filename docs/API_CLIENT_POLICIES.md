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
  }
}
```

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
