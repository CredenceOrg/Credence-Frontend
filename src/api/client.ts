import { ApiRateLimiter, DEFAULT_API_RATE_LIMIT, readApiRateLimitOverrides } from './rateLimit'

import { AmountError, parseAmount, type AmountErrorCode, type AmountRules } from './amount'

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  /**
   * When true, bypasses the client-side rate limiter for this call only.
   * Defaults to false. Intended for tests; production callers should never
   * need this.
   */
  skipRateLimit?: boolean
  /**
   * Declares decimal amount fields inside a JSON object `body` so they are
   * validated and serialized exactly at this boundary.
   *
   * Opt-in and backwards compatible: when omitted (or empty), the body is
   * serialized exactly as before. When present, each declared field must
   * exist on the body and hold a plain unsigned decimal (string, finite
   * non-negative number, or non-negative bigint). Valid values are replaced
   * with their canonical decimal-string form (e.g. `1000.5` → `'1000.50'`)
   * matching the `Bond.amount` contract in `openapi.yaml`; invalid values
   * reject with {@link ApiAmountError} **before** the rate limiter is
   * consulted or the network is touched, and the caller's body object is
   * never mutated.
   *
   * Accepts either:
   * - an array of top-level field names using the default USDC rules
   *   (scale 2, min `'0'`, max = the int64 scaled-integer bound), or
   * - a map of field name to {@link AmountRules} (or `true` for defaults).
   *
   * @example
   * ```ts
   * await apiFetch('/bonds', {
   *   method: 'POST',
   *   body: { borrower: address, amount: '1000.5' },
   *   amountFields: { amount: { min: '1.00' } },
   * })
   * ```
   */
  amountFields?: ApiAmountFields
}

/**
 * Declaration of decimal amount fields for a request body.
 *
 * - `string[]`: field names validated with the default USDC rules.
 * - `Record<string, AmountRules | true>`: per-field rules (`true` = defaults).
 */
export type ApiAmountFields = string[] | Record<string, AmountRules | true>

/**
 * Rejection codes for {@link ApiAmountError}. Mirrors
 * {@link AmountErrorCode} plus the boundary-only codes `INVALID_BODY`
 * (`amountFields` declared but the body is not a JSON object) and `MISSING`
 * (a declared field is absent from the body).
 */
export type ApiAmountErrorCode = AmountErrorCode | 'INVALID_BODY' | 'MISSING'

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

/**
 * Thrown by `apiFetch` when the client-side rate limiter rejects a request.
 *
 * Extends `ApiError` with `status: 429` so existing handlers that only check
 * `err instanceof ApiError` keep working unchanged; code that wants to
 * specifically retry-after a cooldown can additionally narrow on this class
 * (or on `err.status === 429`).
 */
export class ApiRateLimitError extends ApiError {
  readonly retryAfterMs: number

  constructor(retryAfterMs: number, message = 'Too many requests', payload?: unknown) {
    super(429, message, payload)
    this.name = 'ApiRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

/**
 * Thrown by `apiFetch` when a field declared in `amountFields` violates the
 * exact-decimal amount rules (see `src/api/amount.ts`).
 *
 * Extends `ApiError` with a synthetic `status: 400` — mirroring how
 * `ApiRateLimitError` surfaces client-side rejections as 429 — so existing
 * handlers that only check `err instanceof ApiError` keep working. The
 * request is rejected **locally**: no rate-limit budget is consumed and
 * `fetch` is never called, so a rejected amount can never produce partial
 * or unauthorized server-side state.
 */
export class ApiAmountError extends ApiError {
  /** Body field the rejection applies to (`null` for body-level rejections). */
  readonly field: string | null
  /** Machine-readable rejection reason. */
  readonly code: ApiAmountErrorCode

  constructor(field: string | null, code: ApiAmountErrorCode, message: string) {
    super(400, message, { field, code })
    this.name = 'ApiAmountError'
    this.field = field
    this.code = code
  }
}

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env

export const API_BASE_URL = normalizeBaseUrl(env?.VITE_API_BASE_URL || '/api')

/**
 * Process-wide default rate limiter consulted by `apiFetch`.
 *
 * Built once at module init from environment overrides on top of
 * {@link DEFAULT_API_RATE_LIMIT}. Exposed (read-only via {@link
 * apiRateLimiterSnapshot}) so tests can inspect current configuration and
 * tear down bucket state via {@link resetApiRateLimiter}.
 */
const rateLimitOverrides = readApiRateLimitOverrides({
  VITE_API_RATE_LIMIT_MAX: env?.VITE_API_RATE_LIMIT_MAX,
  VITE_API_RATE_LIMIT_WINDOW_MS: env?.VITE_API_RATE_LIMIT_WINDOW_MS,
  VITE_API_RATE_LIMIT_ENABLED: env?.VITE_API_RATE_LIMIT_ENABLED,
})

export const defaultApiRateLimiter = new ApiRateLimiter({
  maxRequests: rateLimitOverrides.maxRequests ?? DEFAULT_API_RATE_LIMIT.maxRequests,
  windowMs: rateLimitOverrides.windowMs ?? DEFAULT_API_RATE_LIMIT.windowMs,
  enabled: rateLimitOverrides.enabled ?? DEFAULT_API_RATE_LIMIT.enabled,
})

/**
 * Read-only snapshot of the active rate-limiter configuration.
 *
 * The returned object is deep-frozen at runtime — callers cannot mutate it
 * through the type system or at language level.
 */
export function apiRateLimiterSnapshot(): Readonly<{
  maxRequests: number
  windowMs: number
  enabled: boolean
}> {
  const cfg = defaultApiRateLimiter.config
  return Object.freeze({
    maxRequests: cfg.maxRequests,
    windowMs: cfg.windowMs,
    enabled: cfg.enabled,
  })
}

/**
 * Resets the process-wide default limiter to an empty window.
 *
 * Intended for tests that call `apiFetch` repeatedly and would otherwise
 * saturate the bucket. Not for production use.
 */
export function resetApiRateLimiter(): void {
  defaultApiRateLimiter.reset()
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '/') {
    return ''
  }
  return trimmed.replace(/\/+$/, '')
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

function isJsonBody(body: ApiFetchOptions['body']): body is Record<string, unknown> | unknown[] {
  const isReadableStream = typeof ReadableStream !== 'undefined' && body instanceof ReadableStream

  return (
    Boolean(body) &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(body) &&
    !(body instanceof URLSearchParams) &&
    !isReadableStream
  )
}

/**
 * Normalizes an {@link ApiAmountFields} spec into ordered `[field, rules]`
 * pairs (`undefined` rules = defaults).
 */
function normalizeAmountFields(
  amountFields: ApiAmountFields | undefined
): Array<[string, AmountRules | undefined]> {
  if (!amountFields) return []
  if (Array.isArray(amountFields)) {
    return amountFields.map((field): [string, AmountRules | undefined] => [field, undefined])
  }
  return Object.entries(amountFields).map(([field, rules]): [string, AmountRules | undefined] => [
    field,
    rules === true ? undefined : rules,
  ])
}

/**
 * Exact-amount gate for `apiFetch`.
 *
 * Returns the body to put on the wire: an untouched pass-through when no
 * `amountFields` are declared (byte-for-byte backwards compatible), or a
 * shallow copy with every declared amount field replaced by its canonical
 * decimal string. The caller's body object is never mutated, so a rejected
 * or failed request leaves no partial state behind.
 *
 * @throws {ApiAmountError} before any state change (rate-limit budget,
 * network) when the body shape is wrong or a declared amount is invalid.
 */
function applyAmountFields(
  body: ApiFetchOptions['body'],
  amountFields: ApiAmountFields | undefined
): ApiFetchOptions['body'] {
  const fields = normalizeAmountFields(amountFields)
  if (fields.length === 0) return body

  if (!isJsonBody(body) || Array.isArray(body)) {
    throw new ApiAmountError(
      null,
      'INVALID_BODY',
      'amountFields requires a JSON object body (object bodies only; arrays and streaming bodies are not supported).'
    )
  }

  const record = body as Record<string, unknown>
  const wireBody: Record<string, unknown> = { ...record }

  for (const [field, rules] of fields) {
    const hasField = Object.prototype.hasOwnProperty.call(record, field)
    const value = record[field]
    if (!hasField || value === undefined) {
      throw new ApiAmountError(
        field,
        'MISSING',
        `Declared amount field "${field}" is missing or undefined.`
      )
    }
    try {
      wireBody[field] = parseAmount(value as string | number | bigint, rules)
    } catch (error) {
      if (error instanceof AmountError) {
        throw new ApiAmountError(
          field,
          error.code,
          `Invalid amount for field "${field}": ${error.message}`
        )
      }
      throw error
    }
  }

  return wireBody
}

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

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  return text || undefined
}

function errorMessage(status: number, payload: unknown): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    typeof payload.message === 'string'
  ) {
    return payload.message
  }
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }
  return `Request failed with status ${status}`
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, skipRateLimit, amountFields, ...init } = options

  // Exact-amount gate: validate and canonicalize declared amount fields
  // BEFORE any state change. An invalid amount must never consume
  // rate-limit budget or reach the network, and must never mutate the
  // caller's body object.
  const wireBody = applyAmountFields(body, amountFields)
  const hasJsonBody = isJsonBody(wireBody)

  // Rate-limit gate: cheap O(k) sliding-window check before paying the cost
  // of a fetch + DNS + TLS round-trip. When the bucket is empty we surface a
  // typed ApiRateLimitError instead of letting a runaway loop slam prod.
  if (!skipRateLimit) {
    const decision = defaultApiRateLimiter.acquire()
    if (!decision.allowed) {
      throw new ApiRateLimitError(
        decision.retryAfterMs,
        `Too many requests, retry in ${decision.retryAfterMs}ms`,
        { retryAfterMs: decision.retryAfterMs }
      )
    }
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path), {
      ...init,
      headers: buildHeaders(headers, hasJsonBody),
      body: hasJsonBody ? JSON.stringify(wireBody) : wireBody,
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Network request failed'
    throw new ApiError(0, message, error)
  }

  const payload = await parseResponse(response)

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(response.status, payload), payload)
  }

  return payload as T
}
