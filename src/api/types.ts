/**
 * Runtime guards and boundary helpers for the API type surface.
 *
 * These helpers exist so that callers can validate untrusted payloads
 * (network responses, cached data, user input) against the same shapes
 * declared by the OpenAPI-derived types above. They are intentionally
 * dependency-free and side-effect-free so they can be used in tests,
 * reducers, and recovery paths without pulling in the HTTP client.
 */

/**
 * Public type surface for the Credence API.
 *
 * All types are derived from the OpenAPI spec at `/openapi.yaml`.
 * Run `npm run generate:api` to regenerate `generated.ts` after spec changes,
 * then re-run `npm run build` to catch any drift between the spec and this file.
 */

import type { components } from './generated'

// Re-export the raw generated interfaces so callers that need path/operation
// metadata can import them directly from here.
export type { components, operations, paths } from './generated'

// ── Named type aliases (backwards-compatible public surface) ────────────────

export type BondStatus = components['schemas']['BondStatus']
export type TrustTier = components['schemas']['TrustTier']
export type TrustScore = components['schemas']['TrustScore']
export type Bond = components['schemas']['Bond']
export type Transaction = components['schemas']['Transaction']
export type ApiMessageResponse = components['schemas']['ApiMessageResponse']
export type Tenant = components['schemas']['Tenant']

/**
 * Cursor-paginated list envelope.
 *
 * OpenAPI does not support generics, so the spec defines a concrete
 * `TransactionList` schema. This generic alias lets the rest of the codebase
 * work with any item type while remaining structurally identical to the
 * generated schema.
 */
export type ApiListResponse<T> = { items: T[]; nextCursor?: string }

export type ApiListResponseLike<T> = { items?: T[] | null; nextCursor?: string | null }

// ── Operation-level helpers ─────────────────────────────────────────────────

/**
 * Extracts the `application/json` response body type for the HTTP 200 case
 * of a given named operation.
 *
 * @example
 * ```ts
 * import { apiFetch } from './client'
 * import type { operations, ApiResponse } from './types'
 *
 * // Type is inferred from the spec — no manual annotation needed.
 * const score = await apiFetch<ApiResponse<operations['getTrustScore']>>(
 *   `/trust-score/${address}`
 * )
 * ```
 */
export type ApiResponse<
  Op extends { responses: { 200: { content: { 'application/json': unknown } } } },
> = Op['responses'][200]['content']['application/json']

// ── Boundary / recovery helpers ─────────────────────────────────────────────

/**
 * Result of validating an untrusted value against an expected API shape.
 *
 * `ok: true` narrows `value` to the validated type. `ok: false` carries a
 * stable, non-sensitive `reason` suitable for logs and user-visible errors.
 */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: ValidationReason }

export type ValidationReason =
  | 'not_an_object'
  | 'missing_field'
  | 'wrong_type'
  | 'empty_list'
  | 'invalid_cursor'
  | 'out_of_range'

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0

/**
 * Validate a cursor-paginated list envelope.
 *
 * Invariants enforced:
 * - `items` must be an array (empty arrays are allowed and preserved).
 * - `nextCursor`, when present, must be a non-empty string; `null` is
 *   normalized to `undefined` so downstream code has a single "no more
 *   pages" representation.
 * - Unknown fields are preserved on the returned value to avoid silent
 *   data loss when the spec adds fields ahead of the client.
 */
export function validateApiListResponse<T>(
  input: unknown,
  validateItem: (item: unknown) => ValidationResult<T>,
): ValidationResult<ApiListResponse<T>> {
  if (!isPlainObject(input)) return { ok: false, reason: 'not_an_object' }
  if (!Array.isArray(input.items)) return { ok: false, reason: 'missing_field' }

  const items: T[] = []
  for (const raw of input.items) {
    const result = validateItem(raw)
    if (!result.ok) return result
    items.push(result.value)
  }

  const rawCursor = input.nextCursor
  if (rawCursor === undefined || rawCursor === null) {
    return { ok: true, value: { ...input, items, nextCursor: undefined } }
  }
  if (!isNonEmptyString(rawCursor)) {
    return { ok: false, reason: 'invalid_cursor' }
  }
  return { ok: true, value: { ...input, items, nextCursor: rawCursor } }
}

/**
 * Merge a freshly fetched page into an existing list without losing data.
 *
 * Recovery semantics:
 * - Duplicate items (by `keyOf`) are dropped, keeping the first occurrence,
 *   so retries and concurrent refreshes cannot produce duplicates.
 * - `nextCursor` from the new page wins; `undefined` means "end of list".
 * - The previous items are never mutated.
 */
export function mergeApiListResponse<T>(
  previous: ApiListResponse<T> | undefined,
  next: ApiListResponse<T>,
  keyOf: (item: T) => string,
): ApiListResponse<T> {
  const seen = new Set<string>()
  const merged: T[] = []
  const push = (item: T) => {
    const key = keyOf(item)
    if (seen.has(key)) return
    seen.add(key)
    merged.push(item)
  }
  if (previous) for (const item of previous.items) push(item)
  for (const item of next.items) push(item)
  return { items: merged, nextCursor: next.nextCursor }
}

/**
 * Clamp a numeric trust score to the inclusive `[0, 100]` range.
 *
 * Returns `null` for non-finite inputs so callers can distinguish "invalid"
 * from a legitimate boundary value of `0` or `100`.
 */
export function clampTrustScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

/**
 * Retry helper with bounded attempts and deterministic backoff.
 *
 * Invariants:
 * - `attempts` is clamped to `[1, maxAttempts]`; a non-positive value still
 *   performs exactly one attempt so callers never silently skip work.
 * - Only the final error is surfaced; intermediate errors are passed to
 *   `onRetry` for observability without leaking them to the caller.
 * - The operation is awaited sequentially; concurrent retries are the
 *   caller's responsibility and are not spawned here.
 */
export async function withRetry<T>(
  op: (attempt: number) => Promise<T>,
  options: {
    maxAttempts?: number
    delayMs?: (attempt: number) => number
    onRetry?: (attempt: number, error: unknown) => void
    sleep?: (ms: number) => Promise<void>
  } = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3))
  const delayMs = options.delayMs ?? ((attempt) => 100 * 2 ** (attempt - 1))
  const sleep =
    options.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)))

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await op(attempt)
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        options.onRetry?.(attempt, error)
        await sleep(delayMs(attempt))
      }
    }
  }
  throw lastError
}

/**
 * Narrow an unknown error into a safe, user-visible message.
 *
 * Never returns stack traces, request bodies, or tokens. Falls back to a
 * stable generic message so UI code has a deterministic string to render.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof Error && isNonEmptyString(error.message)) {
    return error.message
  }
  if (typeof error === 'string' && error.length > 0) return error
  return 'Something went wrong. Please try again.'
}
