import { ApiRateLimiter, DEFAULT_API_RATE_LIMIT, readApiRateLimitOverrides } from './rateLimit'
import { emitWalletSessionEvent, generateCorrelationId } from '../lib/walletAudit'

import { AmountError, parseAmount, type AmountErrorCode, type AmountRules } from './amount'

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  /** Stable key for retrying one state-changing operation safely. */
  idempotencyKey?: string
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
   * When provided, the request is only dispatched if the active identity
   * epoch matches this value at call time **and** when the response arrives.
   * A mismatch at either point causes the promise to reject with
   * {@link ApiSessionConflictError}, leaving no partial state.
   *
   * Pass the epoch obtained from {@link getIdentityEpoch} at the moment the
   * caller reads the identity it intends to act on. The client advances the
   * epoch automatically on every {@link setIdentityEpoch} call (disconnect,
   * reconnect, expiry).
   */
  identityEpoch?: number
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

 * Thrown by `apiFetch` when a session identity conflict is detected.
 *
 * A conflict is detected in two places:
 *
 * 1. **Pre-flight** — the caller supplied an `identityEpoch` option and the
 *    active epoch has already advanced (disconnect / reconnect / expiry) before
 *    the request even hits the network. The request is never dispatched.
 *
 * 2. **Post-flight** — the epoch advanced *while* the request was in-flight
 *    (e.g. the user disconnected their wallet before the response arrived). The
 *    response is discarded and the promise rejects with this error. No partial
 *    state is committed.
 *
 * `status` is `409` so existing `err instanceof ApiError` handlers keep
 * working; code that wants specific conflict handling can narrow on this class
 * or on `err.status === 409`. Do **not** retry automatically — re-acquire a
 * fresh epoch via {@link getIdentityEpoch} and re-issue.
 */
export class ApiSessionConflictError extends ApiError {
  /** Epoch value at the time the request was created (now stale). */
  readonly staleEpoch: number
  /** Epoch value at the time the conflict was detected (current). */
  readonly currentEpoch: number

  constructor(staleEpoch: number, currentEpoch: number, message?: string) {
    super(
      409,
      message ??
        `Session identity changed during request (epoch ${staleEpoch} → ${currentEpoch}). Re-authenticate and retry.`,
      { staleEpoch, currentEpoch }
    )
    this.name = 'ApiSessionConflictError'
    this.staleEpoch = staleEpoch
    this.currentEpoch = currentEpoch
  }
}

/**
 * Thrown by `apiFetch` when a request body exceeds `MAX_REQUEST_BODY_BYTES`.
 * Enforced locally (before any expense) so oversized or adversarial payloads
 * are never serialized over the wire.
 */
export class ApiBodyTooLargeError extends ApiError {
  readonly limitBytes: number
  readonly bodySizeBytes: number

  constructor(limitBytes: number, payload?: { bodySize: number }) {
    super(413, `Request body too large (limit ${limitBytes} bytes).`, payload ?? { limitBytes })
    this.name = 'ApiBodyTooLargeError'
    this.limitBytes = limitBytes
    this.bodySizeBytes = payload?.bodySize ?? 0
  }
}

/** Maximum allowed JSON body size in bytes (1 MiB). */
export const MAX_REQUEST_BODY_BYTES = 1_048_576

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env

export const API_BASE_URL = normalizeBaseUrl(env?.VITE_API_BASE_URL || '/api')

type ReplayEntry = {
  fingerprint: string
  promise: Promise<unknown>
}

const replayEntries = new Map<string, ReplayEntry>()

// ── Identity epoch ──────────────────────────────────────────────────────────
//
// A monotonic counter advanced on every session boundary (connect, disconnect,
// expiry, reconnect, account change). Callers capture the current epoch with
// `getIdentityEpoch()` and pass it to `apiFetch` via the `identityEpoch`
// option; the client checks it both before dispatching and when the response
// arrives, rejecting with `ApiSessionConflictError` and discarding stale
// results so no partial state leaks across sessions.
let _identityEpoch = 0

/** Returns the current identity epoch counter. */
export function getIdentityEpoch(): number {
  return _identityEpoch
}

/** Advances the identity epoch by 1 and returns the new value. */
export function advanceIdentityEpoch(): number {
  _identityEpoch += 1
  return _identityEpoch
}

/**
 * Advances the identity epoch, or sets it to an explicit value when one is
 * given. Session-boundary callers (disconnect / expiry / reconnect / account
 * change) use this to record the newly active identity epoch.
 */
export function setIdentityEpoch(epoch?: number): number {
  _identityEpoch = epoch ?? _identityEpoch + 1
  return _identityEpoch
}

/** Resets the identity epoch to 0. Test-only. */
export function resetIdentityEpoch(): void {
  _identityEpoch = 0
}

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
  const normalizedPath = path.startsWith('/') ? path : '/' + path
  return '' + API_BASE_URL + normalizedPath
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
function buildHeaders(
  headers: HeadersInit | undefined,
  hasJsonBody: boolean,
  correlationId: string
): Headers {
  const nextHeaders = new Headers(headers)
  if (!nextHeaders.has('Accept')) {
    nextHeaders.set('Accept', 'application/json')
  }
  if (hasJsonBody && !nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json')
  }
  if (!nextHeaders.has('X-Correlation-ID')) {
    nextHeaders.set('X-Correlation-ID', correlationId)
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
  return 'Request failed with status ' + status
}

function requestFingerprint(
  url: string,
  init: RequestInit,
  serializedBody: BodyInit | undefined,
  headers: Headers
): string {
  const comparableHeaders: string[] = []
  headers.forEach((value, name) => {
    const lowerName = name.toLowerCase()
    if (lowerName !== 'idempotency-key' && lowerName !== 'x-correlation-id') {
      comparableHeaders.push(`${lowerName}:${value}`)
    }
  })

  return JSON.stringify([
    url,
    init.method || 'GET',
    comparableHeaders.join('\n'),
    serializedBody ?? null,
  ])
}

function replayConflict(key: string): ApiError {
  return new ApiError(
    409,
    `Idempotency key has already been used for a different operation: ${key}`,
    {
      code: 'idempotency_key_conflict',
    }
  )
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, skipRateLimit, amountFields, ...init } = options

  // Exact-amount gate: validate and canonicalize declared amount fields
  // BEFORE any state change. An invalid amount must never consume
  // rate-limit budget or reach the network, and must never mutate the
  // caller's body object.
  const wireBody = applyAmountFields(body, amountFields)
  const hasJsonBody = isJsonBody(wireBody)
  const { body, headers, idempotencyKey, skipRateLimit, identityEpoch, ...init } = options
  const hasJsonBody = isJsonBody(body)

  // Validate input size before expensive operations. Serializing an oversized
  // body is wasted work and could exhaust memory or downstream resources.
  if (hasJsonBody) {
    const serialized = JSON.stringify(body)
    if (new TextEncoder().encode(serialized).byteLength > MAX_REQUEST_BODY_BYTES) {
      throw new ApiBodyTooLargeError(MAX_REQUEST_BODY_BYTES, { bodySize: serialized.length })
    }
  }

  const serializedBody = hasJsonBody ? JSON.stringify(body) : (body ?? undefined)
  const correlationId = generateCorrelationId('api-fetch')
  const requestHeaders = buildHeaders(headers, hasJsonBody, correlationId)
  const method = (init.method || 'GET').toUpperCase()

  if (idempotencyKey !== undefined) {
    const normalizedKey = idempotencyKey.trim()
    if (!normalizedKey) {
      throw new ApiError(400, 'Idempotency key must not be empty', {
        code: 'invalid_idempotency_key',
      })
    }

    const existing = replayEntries.get(normalizedKey)
    const url = buildUrl(path)
    const fingerprint = requestFingerprint(url, { ...init, method }, serializedBody, requestHeaders)

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw replayConflict(normalizedKey)
      }
      return existing.promise as Promise<T>
    }

    requestHeaders.set('Idempotency-Key', normalizedKey)
    const requestPromise = apiFetchWithoutReplay<T>(url, init, requestHeaders, serializedBody, {
      correlationId,
      path,
      method,
      skipRateLimit,
      identityEpoch,
    })
    replayEntries.set(normalizedKey, { fingerprint, promise: requestPromise })
    requestPromise.catch(() => {
      if (replayEntries.get(normalizedKey)?.promise === requestPromise) {
        replayEntries.delete(normalizedKey)
      }
    })
    return requestPromise
  }

  return apiFetchWithoutReplay<T>(buildUrl(path), init, requestHeaders, serializedBody, {
    correlationId,
    path,
    method,
    skipRateLimit,
    identityEpoch,
  })
}

interface ApiFetchContext {
  correlationId: string
  path: string
  method: string
  skipRateLimit?: boolean
  identityEpoch?: number
}

async function apiFetchWithoutReplay<T>(
  url: string,
  init: RequestInit,
  headers: Headers,
  serializedBody: BodyInit | undefined,
  ctx: ApiFetchContext
): Promise<T> {
  // Rate-limit gate: cheap O(k) sliding-window check before paying the cost
  // of a fetch + DNS + TLS round-trip. When the bucket is empty we surface a
  // typed ApiRateLimitError instead of letting a runaway loop slam prod.
  if (!ctx.skipRateLimit) {
    const decision = defaultApiRateLimiter.acquire()
    if (!decision.allowed) {
      throw new ApiRateLimitError(
        decision.retryAfterMs,
        `Too many requests, retry in ${decision.retryAfterMs}ms`,
        { retryAfterMs: decision.retryAfterMs }
      )
    }
  }

  // Pre-flight identity epoch check.
  //
  // If the caller supplied an epoch, verify it against the current module-
  // level epoch before issuing the request. An epoch mismatch here means the
  // session already changed (disconnect / reconnect / expiry) before this
  // request even hit the network — reject immediately without dispatching.
  if (ctx.identityEpoch !== undefined && ctx.identityEpoch !== _identityEpoch) {
    throw new ApiSessionConflictError(
      ctx.identityEpoch,
      _identityEpoch,
      `Session identity changed before request was dispatched (epoch ${ctx.identityEpoch} → ${_identityEpoch}).`
    )
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: buildHeaders(headers, hasJsonBody),
      body: hasJsonBody ? JSON.stringify(wireBody) : wireBody,
      headers,
      body: serializedBody,
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      emitWalletSessionEvent('action_failed', {
        address: null,
        network: null,
        correlationId: ctx.correlationId,
        metadata: { path: ctx.path, method: ctx.method, aborted: true },
      })
      throw error
    }
    const message = error instanceof Error ? error.message : 'Network request failed'
    emitWalletSessionEvent('action_failed', {
      address: null,
      network: null,
      correlationId: ctx.correlationId,
      metadata: { path: ctx.path, method: ctx.method, status: 0, message },
    })
    throw new ApiError(0, message, error)
  }

  // Post-flight identity epoch check.
  //
  // The request was in-flight during an await. Check that the epoch has not
  // advanced since the pre-flight check. If it has, the response belongs to a
  // now-stale session and must be discarded. Reject with ApiSessionConflictError
  // so the caller can decide whether to re-authenticate and retry.
  if (ctx.identityEpoch !== undefined && ctx.identityEpoch !== _identityEpoch) {
    throw new ApiSessionConflictError(
      ctx.identityEpoch,
      _identityEpoch,
      `Session identity changed while request was in-flight (epoch ${ctx.identityEpoch} → ${_identityEpoch}). Response discarded.`
    )
  }

  const payload = await parseResponse(response)

  if (!response.ok) {
    const message = errorMessage(response.status, payload)
    emitWalletSessionEvent('action_failed', {
      address: null,
      network: null,
      correlationId: ctx.correlationId,
      metadata: { path: ctx.path, method: ctx.method, status: response.status, message },
    })
    throw new ApiError(response.status, message, payload)
  }

  emitWalletSessionEvent('action_succeeded', {
    address: null,
    network: null,
    correlationId: ctx.correlationId,
    metadata: { path: ctx.path, method: ctx.method, status: response.status },
  })

  return payload as T
}
