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
