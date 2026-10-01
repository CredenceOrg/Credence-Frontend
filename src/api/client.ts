import { ApiRateLimiter, DEFAULT_API_RATE_LIMIT, readApiRateLimitOverrides } from './rateLimit'
import { emitWalletSessionEvent, generateCorrelationId } from '../lib/walletAudit'
import { AmountError, parseAmount, type AmountErrorCode, type AmountRules } from './amount'

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  /** Stable key for retrying one state-changing operation safely. */
  idempotencyKey?: string
  /** When true, bypasses the client-side rate limiter for this call only. */
  skipRateLimit?: boolean
  /**
   * Declares decimal amount fields inside a JSON object `body` so they are
   * validated and serialized exactly at this boundary.
   */
  amountFields?: ApiAmountFields
/**
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

export type ApiErrorCode = 'invalid_request_url' | 'network_error' | 'http_error'
/**
 * Declaration of decimal amount fields for a request body.
 *
 * - `string[]`: field names validated with the default USDC rules.
 * - `Record<string, AmountRules | true>`: per-field rules (`true` = defaults).
 */
export type ApiAmountFields = string[] | Record<string, AmountRules | true>
export type ApiAmountErrorCode = AmountErrorCode | 'INVALID_BODY' | 'MISSING'

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown
  readonly code?: ApiErrorCode

  constructor(status: number, message: string, payload?: unknown, code?: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
    this.code = code
  }
}

export class ApiRateLimitError extends ApiError {
  readonly retryAfterMs: number

  constructor(retryAfterMs: number, message = 'Too many requests', payload?: unknown) {
    super(429, message, payload, 'http_error')
    this.name = 'ApiRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class ApiAmountError extends ApiError {
  readonly field: string | null
  readonly code: ApiAmountErrorCode

  constructor(field: string | null, code: ApiAmountErrorCode, message: string) {
    super(400, message, { field, code }, 'http_error')
    this.name = 'ApiAmountError'
    this.field = field
    this.code = code
  }
}

/**
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
  readonly staleEpoch: number
  readonly currentEpoch: number

  constructor(staleEpoch: number, currentEpoch: number, message?: string) {
    super(
      409,
      message ??
        `Session identity changed during request (epoch ${staleEpoch} ? ${currentEpoch}). Re-authenticate and retry.`,
      { staleEpoch, currentEpoch }
    )
    this.name = 'ApiSessionConflictError'
    this.staleEpoch = staleEpoch
    this.currentEpoch = currentEpoch
  }
}

export class ApiBodyTooLargeError extends ApiError {
  readonly limitBytes: number
  readonly bodySizeBytes: number

  constructor(limitBytes: number, payload?: { bodySize: number }) {
    super(413, `Request body too large (limit ${limitBytes} bytes).`, payload ?? { limitBytes }, 'http_error')
    this.name = 'ApiBodyTooLargeError'
    this.limitBytes = limitBytes
    this.bodySizeBytes = payload?.bodySize ?? 0
  }
}

export const MAX_REQUEST_BODY_BYTES = 1_048_576
const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
const IS_DEV = env?.PROD !== true
const DIAGNOSTIC_PATH_MAX_LENGTH = 80
const LAST_C0_CODE = 0x1f
const DEL_CODE = 0x7f
const LAST_C1_CODE = 0x9f

function isControlCode(code: number): boolean {
  return code <= LAST_C0_CODE || (code >= DEL_CODE && code <= LAST_C1_CODE)
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (isControlCode(value.charCodeAt(index))) return true
  }
  return false
}

function replaceControlCharacters(value: string): string {
  let result = ''
  for (let index = 0; index < value.length; index += 1) {
    result += isControlCode(value.charCodeAt(index)) ? '?' : value[index]
  }
  return result
}

function rejectBaseUrl(): '' {
  if (IS_DEV) {
    console.warn(
      '[api] VITE_API_BASE_URL is not a supported API base. Expected an empty value, ' +
        'a root-relative prefix (e.g. "/api"), or an absolute http(s) origin. ' +
        'Falling back to same-origin requests.'
    )
  }
  return ''
}

type ReplayEntry = {
  fingerprint: string
  promise: Promise<unknown>
}

const replayEntries = new Map<string, ReplayEntry>()
let _identityEpoch = 0

export function getIdentityEpoch(): number {
  return _identityEpoch
}

export function advanceIdentityEpoch(): number {
  _identityEpoch += 1
  return _identityEpoch
}

export function setIdentityEpoch(epoch?: number): number {
  _identityEpoch = epoch ?? _identityEpoch + 1
  return _identityEpoch
}

export function resetIdentityEpoch(): void {
  _identityEpoch = 0
}

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

export function apiRateLimiterSnapshot(): Readonly<{
  maxRequests: number
  windowMs: number
  enabled: boolean
}> {
  const cfg = defaultApiRateLimiter.config
  return Object.freeze({ maxRequests: cfg.maxRequests, windowMs: cfg.windowMs, enabled: cfg.enabled })
}

export function resetApiRateLimiter(): void {
  defaultApiRateLimiter.reset()
}

export function normalizeBaseUrl(value: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed || trimmed === '/') {
    return ''
  }

  // `//host` and `/\host` are resolved by fetch as protocol-relative URLs, so
  // keeping them would send every API request — including Authorization
  // headers — to a foreign origin. Fail closed instead.
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return rejectBaseUrl()
  }

  if (trimmed.startsWith('/')) {
    if (trimmed.includes('?') || trimmed.includes('#')) {
      return rejectBaseUrl()
    }
    return trimmed.replace(/\/+$/, '')
  }

  // Anything else must be an explicit absolute http(s) URL. This rejects
  // scheme-less typos (`api.example.com`, which fetch would resolve as a
  // same-origin *path* and silently 404) and dangerous schemes
  // (`javascript:`, `data:`, `blob:`, `file:`).
  if (!/^https?:\/\//i.test(trimmed)) {
    return rejectBaseUrl()
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return rejectBaseUrl()
  }
  if (parsed.search || parsed.hash) {
    return rejectBaseUrl()
  }

  return trimmed.replace(/\/+$/, '')
}

/**
 * Reports an unusable `VITE_API_BASE_URL` and yields the same-origin fallback.
 *
 * The offending value is deliberately **not** echoed: a base URL may embed
 * credentials (`https://user:token@host`) and the value is already visible in
 * the operator's own `.env` file. Only the classification is logged.
 */
function rejectBaseUrl(): '' {
  if (IS_DEV) {
    console.warn(
      '[api] VITE_API_BASE_URL is not a supported API base. Expected an empty value, ' +
        'a root-relative prefix (e.g. "/api"), or an absolute http(s) origin. ' +
        'Falling back to same-origin requests.'
    )
  }
  return ''
}

/**
 * Builds the redacted, length-bounded path echoed in `ApiError.payload`.
 *
 * Strips the query string so bearer tokens, signatures, and user-supplied
 * identifiers never reach logs, telemetry, or the `ErrorState` UI. Control
 * characters are replaced with `?` so the value cannot smuggle newlines into a
 * log line.
 */
function redactPathForDiagnostics(value: unknown): string {
  if (typeof value !== 'string') {
    return typeof value
  }
  const queryStart = value.indexOf('?')
  const pathOnly = queryStart === -1 ? value : value.slice(0, queryStart)
  const printable = replaceControlCharacters(pathOnly)
  const clipped =
    printable.length > DIAGNOSTIC_PATH_MAX_LENGTH
      ? `${printable.slice(0, DIAGNOSTIC_PATH_MAX_LENGTH)}…`
      : printable
  return queryStart === -1 ? clipped : `${clipped}?<redacted>`
}

/** Reasons reported by {@link normalizeApiPath}; each is a stable string. */
type PathRejection =
  | 'path must be a string'
  | 'path must not be empty'
  | 'path must be relative, not origin-relative'
  | 'path must not contain backslashes'
  | 'path must not contain control characters'
  | 'path must not contain a URL fragment'

function redactPathForDiagnostics(value: unknown): string {
  if (typeof value !== 'string') return typeof value
  const queryStart = value.indexOf('?')
  const pathOnly = queryStart === -1 ? value : value.slice(0, queryStart)
  const printable = replaceControlCharacters(pathOnly)
  const clipped =
    printable.length > DIAGNOSTIC_PATH_MAX_LENGTH
      ? `${printable.slice(0, DIAGNOSTIC_PATH_MAX_LENGTH)}�`
      : printable
  return queryStart === -1 ? clipped : `${clipped}?<redacted>`
}

function invalidPathError(reason: PathRejection, path: unknown): ApiError {
  return new ApiError(0, `Invalid API request path: ${reason}`, {
    code: 'invalid_request_url',
    reason,
    path: redactPathForDiagnostics(path),
  }, 'invalid_request_url')
}

function normalizeApiPath(path: string): string {
  if (typeof path !== 'string') {
    throw invalidPathError('path must be a string', path)
  }
  const trimmed = path.trim()
  if (!trimmed) throw invalidPathError('path must not be empty', path)
  if (trimmed.startsWith('//')) throw invalidPathError('path must be relative, not origin-relative', path)
  if (trimmed.includes('\\')) throw invalidPathError('path must not contain backslashes', path)
  if (hasControlCharacters(trimmed)) throw invalidPathError('path must not contain control characters', path)
  if (trimmed.includes('#')) throw invalidPathError('path must not contain a URL fragment', path)
  return `/${trimmed.replace(/^\/+/, '')}`
}

export function buildUrl(path: string, baseUrl: string = API_BASE_URL): string {
  return `${normalizeBaseUrl(baseUrl)}${normalizeApiPath(path)}`
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
    !(typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
  )
}

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
      throw new ApiAmountError(field, 'MISSING', `Declared amount field "${field}" is missing or undefined.`)
    }
    try {
      wireBody[field] = parseAmount(value as string | number | bigint, rules)
    } catch (error) {
      if (error instanceof AmountError) {
        throw new ApiAmountError(field, error.code, `Invalid amount for field "${field}": ${error.message}`)
      }
      throw error
    }
  }
  return wireBody
}


function buildHeaders(
  headers: HeadersInit | undefined,
  hasJsonBody: boolean,
  correlationId?: string
): Headers {
  const nextHeaders = new Headers(headers)
  if (!nextHeaders.has('Accept')) nextHeaders.set('Accept', 'application/json')
  if (hasJsonBody && !nextHeaders.has('Content-Type')) {
    nextHeaders.set('Content-Type', 'application/json')
  }
  if (correlationId && !nextHeaders.has('X-Correlation-ID')) {
    nextHeaders.set('X-Correlation-ID', correlationId)
  }
  return nextHeaders
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json()
  const text = await response.text()
  return text || undefined
}

/** Maximum length of a server-provided error message we will surface verbatim. */
const MAX_ERROR_MESSAGE_LENGTH = 500

/**
 * Extracts a deterministic, safe, user-visible error message from a failed
 * response payload.
 *
 * Invariants:
 * - Always returns a non-empty string, so callers can rely on
 *   `new ApiError(status, message)` never producing an empty message.
 * - Never throws: any shape of `payload` (null, primitives, arrays, objects
 *   with getters that throw, cyclic structures) resolves to a fallback.
 * - Never leaks unbounded or control-character-laden server content: string
 *   messages are trimmed, stripped of control characters, and truncated to
 *   {@link MAX_ERROR_MESSAGE_LENGTH}. This keeps logs and UI rendering
 *   deterministic and prevents log-injection / terminal-escape attacks.
 * - Prefers an explicit `message` string, then a `error` string, then a
 *   non-empty string payload, then a status-derived fallback.
 */
function errorMessage(status: number, payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string') {
    return payload.message
  }
  if (typeof payload === 'string' && payload.trim()) return payload
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
  return JSON.stringify([url, init.method || 'GET', comparableHeaders.join('\n'), serializedBody ?? null])
}

function replayConflict(key: string): ApiError {
  return new ApiError(409, `Idempotency key has already been used for a different operation: ${key}`, {
    code: 'idempotency_key_conflict',
  })
}

/**
 * Issues a JSON API request and returns the parsed body.
 *
 * Failure taxonomy — every rejection carries an {@link ApiError} that says
 * *which* stage failed, so callers can distinguish a retryable network blip
 * from a non-retryable programming fault:
 *
 * | Stage                       | `status` | `code`                 | Retryable |
 * | --------------------------- | -------- | ---------------------- | --------- |
 * | URL/path validation         | `0`      | `invalid_request_url`  | no        |
 * | transport (offline, CORS)   | `0`      | `network_error`        | yes       |
 * | non-2xx response            | status   | `http_error`           | per status |
 * | caller aborted via `signal` | —        | rethrown `AbortError`  | n/a       |
 *
 * `buildUrl`, header construction, and body serialization all run *before* the
 * network `try` block. A caller mistake is therefore never re-wrapped as
 * `status: 0` / `network_error`, which previously hid the real cause and could
 * make a permanent fault look like a transient one worth retrying.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, idempotencyKey, skipRateLimit, identityEpoch, amountFields, ...init } = options
  const wireBody = applyAmountFields(body, amountFields)
  const hasJsonBody = isJsonBody(wireBody)

  // Pre-flight: deterministic, request-independent failures.
  const url = buildUrl(path)
  const requestHeaders = buildHeaders(headers, hasJsonBody)
  const requestBody = hasJsonBody ? JSON.stringify(body) : body
  // Validate input size before expensive operations. Serializing an oversized
  // body is wasted work and could exhaust memory or downstream resources.
  if (hasJsonBody) {
    const serialized = JSON.stringify(wireBody)
    if (new TextEncoder().encode(serialized).byteLength > MAX_REQUEST_BODY_BYTES) {
      throw new ApiBodyTooLargeError(MAX_REQUEST_BODY_BYTES, { bodySize: serialized.length })
    }
  }

  const serializedBody = hasJsonBody ? JSON.stringify(wireBody) : (wireBody ?? undefined)
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

  return apiFetchWithoutReplay<T>(url, init, requestHeaders, serializedBody, {
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

  if (ctx.identityEpoch !== undefined && ctx.identityEpoch !== _identityEpoch) {
    throw new ApiSessionConflictError(
      ctx.identityEpoch,
      _identityEpoch,
      `Session identity changed before request was dispatched (epoch ${ctx.identityEpoch} ? ${_identityEpoch}).`
    )
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers,
      body: serializedBody,
    })
  } catch (error) {
    // Preserve AbortError unchanged — callers may inspect it directly.
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      emitWalletSessionEvent('action_failed', {
        address: null,
        network: null,
        correlationId: ctx.correlationId,
        metadata: { path: ctx.path, method: ctx.method, aborted: true },
      })
      throw error
    }
    // Network transport failure: wrap in ApiError with deterministic classification.

    const message = error instanceof Error ? error.message : 'Network request failed'
    emitWalletSessionEvent('action_failed', {
      address: null,
      network: null,
      correlationId: ctx.correlationId,
      metadata: { path: ctx.path, method: ctx.method, status: 0, message },
    })
    throw new ApiError(0, message, error, 'network_error')
  }

  if (ctx.identityEpoch !== undefined && ctx.identityEpoch !== _identityEpoch) {
    throw new ApiSessionConflictError(
      ctx.identityEpoch,
      _identityEpoch,
      `Session identity changed while request was in-flight (epoch ${ctx.identityEpoch} ? ${_identityEpoch}). Response discarded.`
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
    throw new ApiError(response.status, message, payload, 'http_error')
  }

  emitWalletSessionEvent('action_succeeded', {
    address: null,
    network: null,
    correlationId: ctx.correlationId,
    metadata: { path: ctx.path, method: ctx.method, status: response.status },
  })

  return payload as T
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, amountFields, headers, ...init } = options
  const wireBody = applyAmountFields(body, amountFields)
  const hasJsonBody = isJsonBody(wireBody)
  const serializedBody: BodyInit | undefined = hasJsonBody ? JSON.stringify(wireBody) : (wireBody as BodyInit | undefined)

  if (hasJsonBody) {
    const encoded = new TextEncoder().encode(serializedBody as string)
    if (encoded.byteLength > MAX_REQUEST_BODY_BYTES) {
      throw new ApiBodyTooLargeError(MAX_REQUEST_BODY_BYTES, { bodySize: encoded.byteLength })
    }
  }

  const finalUrl = buildUrl(path)
  const method = (init.method || 'GET').toUpperCase()
  const requestHeaders = buildHeaders(headers, hasJsonBody, generateCorrelationId('api-fetch'))

  if (options.idempotencyKey !== undefined) {
    const key = options.idempotencyKey.trim()
    if (!key) {
      throw new ApiError(400, 'Idempotency key must not be empty', {
        code: 'invalid_idempotency_key',
      })
    }

    const fingerprint = requestFingerprint(finalUrl, { ...init, method }, serializedBody, requestHeaders)
    const existing = replayEntries.get(key)
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw replayConflict(key)
      }
      return existing.promise as Promise<T>
    }

    requestHeaders.set('Idempotency-Key', key)
    const requestPromise = apiFetchWithoutReplay<T>(
      finalUrl,
      { ...init, headers: requestHeaders, body: serializedBody },
      requestHeaders,
      serializedBody,
      {
        correlationId: requestHeaders.get('X-Correlation-ID') || 'api-fetch',
        path,
        method,
        skipRateLimit: options.skipRateLimit,
        identityEpoch: options.identityEpoch,
      }
    )

    replayEntries.set(key, { fingerprint, promise: requestPromise })
    requestPromise.catch(() => {
      const current = replayEntries.get(key)
      if (current?.promise === requestPromise) replayEntries.delete(key)
    })
    return requestPromise
  }

  return apiFetchWithoutReplay<T>(
    finalUrl,
    { ...init, headers: requestHeaders, body: serializedBody },
    requestHeaders,
    serializedBody,
    {
      correlationId: requestHeaders.get('X-Correlation-ID') || 'api-fetch',
      path,
      method,
      skipRateLimit: options.skipRateLimit,
      identityEpoch: options.identityEpoch,
    }
  )
}
