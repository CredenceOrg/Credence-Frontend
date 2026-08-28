import { emitWalletSessionEvent, generateCorrelationId } from '../lib/walletAudit'

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | unknown[] | null
  /** Optional correlation identifier for end-to-end request tracing */
  correlationId?: string
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

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, correlationId: customCorrelationId, ...init } = options
  const correlationId = customCorrelationId || generateCorrelationId('req')
  const hasJsonBody = isJsonBody(body)

  const method = (init.method || 'GET').toUpperCase()
  emitWalletSessionEvent('action_attempted', {
    address: null,
    network: null,
    correlationId,
    metadata: { path, method },
  })

  let response: Response
  try {
    response = await fetch(buildUrl(path), {
      ...init,
      headers: buildHeaders(headers, hasJsonBody, correlationId),
      body: hasJsonBody ? JSON.stringify(body) : body,
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
      emitWalletSessionEvent('action_failed', {
        address: null,
        network: null,
        correlationId,
        metadata: { path, method, aborted: true },
      })
      throw error
    }
    const message = error instanceof Error ? error.message : 'Network request failed'
    emitWalletSessionEvent('action_failed', {
      address: null,
      network: null,
      correlationId,
      metadata: { path, method, status: 0, message },
    })
    throw new ApiError(0, message, error)
  }

  const payload = await parseResponse(response)

  if (!response.ok) {
    const message = errorMessage(response.status, payload)
    emitWalletSessionEvent('action_failed', {
      address: null,
      network: null,
      correlationId,
      metadata: { path, method, status: response.status, message },
    })
    throw new ApiError(response.status, message, payload)
  }

  emitWalletSessionEvent('action_succeeded', {
    address: null,
    network: null,
    correlationId,
    metadata: { path, method, status: response.status },
  })

  return payload as T
}
