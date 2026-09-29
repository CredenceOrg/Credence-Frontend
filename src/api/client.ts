export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
}

/**
 * Machine-readable, non-sensitive classification of an {@link ApiError}.
 *
 * - `invalid_request_url` — the request never left the browser because the
 *   path or base URL failed validation. Retrying the identical call cannot
 *   succeed, so callers should surface it as a configuration/programming fault
 *   rather than as a retryable failure.
 * - `network_error` — the request never produced an HTTP response (offline,
 *   DNS failure, CORS rejection). `status` is `0`.
 * - `http_error` — the server answered with a non-2xx status.
 */
export type ApiErrorCode = 'invalid_request_url' | 'network_error' | 'http_error'

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown
  /**
   * Optional classification. `undefined` for `ApiError`s constructed by legacy
   * call sites, so existing three-argument construction keeps working.
   */
  readonly code?: ApiErrorCode

  constructor(status: number, message: string, payload?: unknown, code?: ApiErrorCode) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
    this.code = code
  }
}

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env

/** Console warnings are emitted in dev/test builds only. */
const IS_DEV = env?.PROD !== true

/**
 * Longest path fragment echoed back in an error payload. Keeps diagnostics
 * bounded so a hostile or accidental huge path cannot flood logs or the
 * `ErrorState` UI.
 */
const DIAGNOSTIC_PATH_MAX_LENGTH = 80

/** C0 control range. */
const LAST_C0_CODE = 0x1f
/** DEL. */
const DEL_CODE = 0x7f
/** End of the C1 control range. */
const LAST_C1_CODE = 0x9f

/**
 * C0 controls, DEL, and C1 controls are rejected in request paths.
 *
 * The WHATWG URL parser silently *strips* tab/LF/CR and percent-encodes the
 * rest, so `/bonds\nx` and `/bondsx` would resolve to the same endpoint.
 * Rejecting them keeps the mapping from input to request one-to-one.
 *
 * Implemented as a code-point scan rather than a regex literal so the
 * `no-control-regex` lint rule stays meaningful for every other file.
 */
function isControlCode(code: number): boolean {
  return code <= LAST_C0_CODE || (code >= DEL_CODE && code <= LAST_C1_CODE)
}

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (isControlCode(value.charCodeAt(index))) {
      return true
    }
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

export const API_BASE_URL = normalizeBaseUrl(env?.VITE_API_BASE_URL || '/api')

/**
 * Normalizes the configured API base URL.
 *
 * Invariants (all enforced by the `normalizeBaseUrl` tests):
 *  1. The result is either `''` (same-origin, no prefix) or a base with **no
 *     trailing slash**, so joining a path always inserts exactly one separator.
 *  2. The result is never scheme-relative (`//host` or `/\host`) and never a
 *     non-`http(s)` URL, so {@link buildUrl} cannot be steered to a foreign
 *     origin by configuration.
 *  3. The result never carries a query string or fragment, because a path
 *     appended after `?`/`#` would be swallowed by the URL parser and the
 *     server would never see it.
 *  4. The function is idempotent: `normalizeBaseUrl(normalizeBaseUrl(x))`
 *     always equals `normalizeBaseUrl(x)`.
 *  5. Invalid or hostile values **fail closed** to `''` rather than throwing.
 *     A bad `.env` entry degrades the app to same-origin requests instead of
 *     breaking module evaluation (and therefore app boot).
 *
 * Rule 5 means a misconfigured `VITE_API_BASE_URL` cannot leak request URLs or
 * credentials to another host; it can only ever remove the prefix.
 *
 * Exported so the failure boundaries are directly testable. `import.meta.env`
 * is inlined at build time, so stubbing `VITE_API_BASE_URL` from a test cannot
 * reach the module-load path that computes {@link API_BASE_URL}.
 */
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

function invalidPathError(reason: PathRejection, path: unknown): ApiError {
  return new ApiError(
    0,
    `Invalid API request path: ${reason}`,
    { code: 'invalid_request_url', reason, path: redactPathForDiagnostics(path) },
    'invalid_request_url'
  )
}

/**
 * Validates and normalizes an API path.
 *
 * Invariants:
 *  1. The result always begins with **exactly one** `/`. Combined with the
 *     base normalization this makes the joined URL incapable of being read as
 *     a scheme-relative or absolute URL by the fetch/URL parser, so a request
 *     can never be redirected to another origin via a crafted path.
 *  2. Interior duplicate slashes and trailing slashes are preserved verbatim,
 *     because some REST resources treat `/bonds//children` as significant. A
 *     run of **two or more** leading slashes is rejected rather than collapsed,
 *     because the URL parser reads `///bonds` as the origin `bonds`.
 *  3. Rejection is total and deterministic: every invalid input throws
 *     `ApiError` with `code: 'invalid_request_url'`, `status: 0`, and a
 *     redacted `payload`. No input can produce a silently wrong URL.
 */
function normalizeApiPath(path: string): string {
  if (typeof path !== 'string') {
    throw invalidPathError('path must be a string', path)
  }

  const trimmed = path.trim()
  if (!trimmed) {
    throw invalidPathError('path must not be empty', path)
  }
  if (trimmed.startsWith('//')) {
    // `fetch('//host/x')` resolves to `https://host/x` — a cross-origin
    // request carrying every default header and credential cookie.
    throw invalidPathError('path must be relative, not origin-relative', path)
  }
  if (trimmed.includes('\\')) {
    // The WHATWG URL parser treats `\` as `/` for special schemes, so
    // `/\evil.com` also escapes the origin and `/a\..\b` silently traverses
    // out of the API prefix.
    throw invalidPathError('path must not contain backslashes', path)
  }
  if (hasControlCharacters(trimmed)) {
    throw invalidPathError('path must not contain control characters', path)
  }
  if (trimmed.includes('#')) {
    // `fetch('/bonds#x')` requests `/bonds`; the fragment is never sent. That
    // is a silent wrong-resource fetch, which is worse than a hard failure.
    throw invalidPathError('path must not contain a URL fragment', path)
  }

  return `/${trimmed.replace(/^\/+/, '')}`
}

/**
 * Joins the API base and a request path into a single absolute-or-root-relative
 * request URL.
 *
 * Pure and deterministic: it reads no mutable module state beyond the
 * `baseUrl` default, so repeated calls with the same arguments are equal and
 * concurrent calls cannot interfere. `apiFetch` is the only production caller.
 *
 * The optional `baseUrl` argument exists so callers (and tests) can resolve
 * against an arbitrary prefix; it is re-normalized on every call, so even a raw
 * un-normalized `VITE_API_BASE_URL` cannot produce a cross-origin or
 * malformed URL. `normalizeBaseUrl` is a fixed point on already-valid bases,
 * so passing `API_BASE_URL` (the default) never warns.
 *
 * @throws {ApiError} `status: 0`, `code: 'invalid_request_url'` for any path
 * that would be silently rewritten or re-pointed by the URL parser.
 */
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
    !isReadableStream
  )
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
  const { body, headers, ...init } = options
  const hasJsonBody = isJsonBody(body)

  // Pre-flight: deterministic, request-independent failures.
  const url = buildUrl(path)
  const requestHeaders = buildHeaders(headers, hasJsonBody)
  const requestBody = hasJsonBody ? JSON.stringify(body) : body

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: requestHeaders,
      body: requestBody,
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Network request failed'
    throw new ApiError(0, message, error, 'network_error')
  }

  const payload = await parseResponse(response)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorMessage(response.status, payload),
      payload,
      'http_error'
    )
  }

  return payload as T
}
