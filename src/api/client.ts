export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  /** Stable key for retrying one state-changing operation safely. */
  idempotencyKey?: string
}

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

const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env

export const API_BASE_URL = normalizeBaseUrl(env?.VITE_API_BASE_URL || '/api')

type ReplayEntry = {
  fingerprint: string
  promise: Promise<unknown>
}

const replayEntries = new Map<string, ReplayEntry>()

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

function requestFingerprint(
  url: string,
  init: RequestInit,
  serializedBody: BodyInit | undefined,
  headers: Headers
): string {
  const comparableHeaders: string[] = []
  headers.forEach((value, name) => {
    if (name !== 'idempotency-key') comparableHeaders.push(`${name}:${value}`)
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
  const { body, headers, idempotencyKey, ...init } = options
  const hasJsonBody = isJsonBody(body)
  const serializedBody = hasJsonBody ? JSON.stringify(body) : (body ?? undefined)
  const requestHeaders = buildHeaders(headers, hasJsonBody)

  if (idempotencyKey !== undefined) {
    const normalizedKey = idempotencyKey.trim()
    if (!normalizedKey) {
      throw new ApiError(400, 'Idempotency key must not be empty', {
        code: 'invalid_idempotency_key',
      })
    }

    const existing = replayEntries.get(normalizedKey)
    const url = buildUrl(path)
    const fingerprint = requestFingerprint(url, init, serializedBody, requestHeaders)

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw replayConflict(normalizedKey)
      }
      return existing.promise as Promise<T>
    }

    requestHeaders.set('Idempotency-Key', normalizedKey)
    const requestPromise = apiFetchWithoutReplay<T>(url, init, requestHeaders, serializedBody)
    replayEntries.set(normalizedKey, { fingerprint, promise: requestPromise })
    requestPromise.catch(() => {
      if (replayEntries.get(normalizedKey)?.promise === requestPromise) {
        replayEntries.delete(normalizedKey)
      }
    })
    return requestPromise
  }

  return apiFetchWithoutReplay<T>(buildUrl(path), init, requestHeaders, serializedBody)
}

async function apiFetchWithoutReplay<T>(
  url: string,
  init: RequestInit,
  headers: Headers,
  serializedBody: BodyInit | undefined
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers,
      body: serializedBody,
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
