import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  ApiRateLimitError,
  apiFetch,
  apiRateLimiterSnapshot,
  defaultApiRateLimiter,
  resetApiRateLimiter,
} from './client'
import { getWalletAuditTrail, resetWalletAuditTrail } from '../lib/walletAudit'

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  })
}

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  resetWalletAuditTrail()
})

describe('apiFetch', () => {
  it('prefixes /api, sends JSON headers, and parses JSON responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ score: 720 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await apiFetch<{ score: number }>('/trust-score/GABC', {
      method: 'POST',
      body: { network: 'testnet' },
    })

    expect(result).toEqual({ score: 720 })
    expect(fetchMock).toHaveBeenCalledWith('/api/trust-score/GABC', {
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({ network: 'testnet' }),
    })

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('throws ApiError with status, message, and payload for non-2xx JSON responses', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: 'Bond not found', code: 'not_found' }, { status: 404 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Bond not found',
      payload: { message: 'Bond not found', code: 'not_found' },
    } satisfies Partial<ApiError>)
  })

  it('uses text response bodies as ApiError messages when JSON is not returned', async () => {
    fetchMock.mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/health')).rejects.toMatchObject({
      status: 503,
      message: 'temporarily unavailable',
      payload: 'temporarily unavailable',
    })
  })

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch<void>('/bonds/123', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('passes AbortSignal through to fetch so callers can cancel requests', async () => {
    const controller = new AbortController()
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/bonds', { signal: controller.signal })

    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal)
  })

  it('preserves AbortError rejections from fetch', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValueOnce(abortError)
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).rejects.toBe(abortError)
  })

  it('wraps network failures in ApiError with status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: 'Failed to fetch',
    } satisfies Partial<ApiError>)
  })

  it('normalizes paths without a leading slash', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('bonds')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/bonds')
  })

  it('falls back to a status-based message when an error response has no body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed with status 500',
      payload: undefined,
    })
  })

  it('preserves query parameters in the request URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/bonds?status=active&page=2')

    expect(fetchMock.mock.calls[0][0]).toBe('/api/bonds?status=active&page=2')
  })

  it('does not set Content-Type when there is no JSON body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/health')

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('Content-Type')).toBeNull()
  })

  it('preserves custom headers alongside defaults', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/bonds', {
      headers: { 'X-Custom': 'my-value' },
    })

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('X-Custom')).toBe('my-value')
  })

  it('lets caller-provided Accept override the default', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/bonds', {
      headers: { Accept: 'text/plain' },
    })

    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Accept')).toBe('text/plain')
  })

  it('handles 500 with HTML body, using raw text as error message', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>Internal Server Error</html>', { status: 500 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).rejects.toMatchObject({
      status: 500,
      message: '<html>Internal Server Error</html>',
      payload: '<html>Internal Server Error</html>',
    })
  })

  it('rejects with SyntaxError when server claims JSON but body is malformed', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{bad json}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).rejects.toThrow(SyntaxError)
  })

  it('wraps non-Error thrown values in ApiError with status 0', async () => {
    fetchMock.mockRejectedValueOnce('string error')
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: 'Network request failed',
    })
  })

  it('commits one effect when a keyed operation is duplicated or reordered', async () => {
    const committedKeys = new Set<string>()
    fetchMock.mockImplementation(async (_url, init) => {
      const key = (init?.headers as Headers).get('Idempotency-Key')
      if (key && !committedKeys.has(key)) committedKeys.add(key)
      return jsonResponse({ committed: true, count: committedKeys.size })
    })
    vi.stubGlobal('fetch', fetchMock)

    const first = apiFetch<{ committed: boolean; count: number }>('/bonds', {
      method: 'POST',
      idempotencyKey: 'bond-1',
      body: { amount: '10.00' },
    })
    const duplicate = apiFetch<{ committed: boolean; count: number }>('/bonds', {
      method: 'POST',
      idempotencyKey: 'bond-1',
      body: { amount: '10.00' },
    })

    await expect(Promise.all([duplicate, first])).resolves.toEqual([
      { committed: true, count: 1 },
      { committed: true, count: 1 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('allows a timeout retry and retains only the successful effect', async () => {
    let attempts = 0
    let committedEffects = 0
    const committedResponses = new Map<string, { committedEffects: number }>()
    fetchMock.mockImplementation(async () => {
      attempts += 1
      const key = (fetchMock.mock.calls.at(-1)?.[1]?.headers as Headers).get('Idempotency-Key')
      if (key && committedResponses.has(key)) return jsonResponse(committedResponses.get(key))

      committedEffects += 1
      const response = { committedEffects }
      if (key) committedResponses.set(key, response)
      if (attempts === 1) throw new TypeError('response timed out after commit')
      return jsonResponse(response)
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiFetch('/bonds', {
        method: 'POST',
        idempotencyKey: 'bond-retry',
        body: { amount: '10.00' },
      })
    ).rejects.toMatchObject({ status: 0 })
    await expect(
      apiFetch('/bonds', {
        method: 'POST',
        idempotencyKey: 'bond-retry',
        body: { amount: '10.00' },
      })
    ).resolves.toEqual({ committedEffects: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(committedEffects).toBe(1)
  })

  it('rejects conflicting reuse before making another request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ committed: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/bonds', {
      method: 'POST',
      idempotencyKey: 'bond-conflict',
      body: { amount: '10.00' },
    })

    await expect(
      apiFetch('/bonds', {
        method: 'POST',
        idempotencyKey: 'bond-conflict',
        body: { amount: '20.00' },
      })
    ).rejects.toMatchObject({
      status: 409,
      payload: { code: 'idempotency_key_conflict' },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('forwards the key and rejects empty keys without partial state', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiFetch('/bonds', { method: 'POST', idempotencyKey: '   ' })
    ).rejects.toMatchObject({
      status: 400,
      payload: { code: 'invalid_idempotency_key' },
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await apiFetch('/bonds', { method: 'POST', idempotencyKey: 'bond-header' })
    const requestHeaders = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(requestHeaders.get('Idempotency-Key')).toBe('bond-header')
  })
})

describe('apiFetch rate limiting (defence-in-depth)', () => {
  // Shrink the bucket just for this block so the negative test sits well
  // below the production default cap of 20 / 5s. Defaults are still covered
  // by the ApiRateLimiter unit tests in src/api/rateLimit.test.ts.
  const TEST_MAX = 3
  const TEST_WINDOW_MS = 60_000
  let originalConfig: { maxRequests: number; windowMs: number; enabled: boolean }

  beforeAll(() => {
    originalConfig = { ...apiRateLimiterSnapshot() }
    defaultApiRateLimiter.configure({
      maxRequests: TEST_MAX,
      windowMs: TEST_WINDOW_MS,
    })
  })

  afterAll(() => {
    defaultApiRateLimiter.configure(originalConfig)
  })

  /**
   * NEGATIVE TEST — fails without the fix, passes with it.
   *
   * Before this PR: `apiFetch(missing)` returns a 404 every call, fetch is
   * invoked N+1 times and all rejections are plain `ApiError`. After this PR:
   * the (N+1)th call short-circuits at the rate-limit gate and throws
   * `ApiRateLimitError` without touching the network.
   */
  it('rejects the (N+1)th call with ApiRateLimitError instead of hitting fetch', async () => {
    expect(defaultApiRateLimiter.config.maxRequests).toBe(TEST_MAX)

    // First N calls: endpoint returns 404 but the gate lets them through.
    for (let i = 0; i < TEST_MAX; i++) {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    }
    vi.stubGlobal('fetch', fetchMock)

    for (let i = 0; i < TEST_MAX; i++) {
      const err = await apiFetch('/runaway').catch((e) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect(err).not.toBeInstanceOf(ApiRateLimitError)
    }

    // (N+1)th call: limiter blocks it before fetch runs.
    await expect(apiFetch('/runaway')).rejects.toMatchObject({
      name: 'ApiRateLimitError',
      status: 429,
      retryAfterMs: expect.any(Number),
    } satisfies Partial<ApiRateLimitError>)

    // Negative-test invariant: fetch was only invoked TEST_MAX times.
    expect(fetchMock).toHaveBeenCalledTimes(TEST_MAX)
  })

  it('ApiRateLimitError is also an ApiError so existing handlers keep working', async () => {
    // mockImplementation so each fetch return is a fresh Response with a
    // readable body — `mockResolvedValue(jsonResponse(...))` would re-use one
    // Response and trip the "body already read" guard.
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})))
    vi.stubGlobal('fetch', fetchMock)
    for (let i = 0; i < TEST_MAX; i++) {
      await apiFetch('/x').catch(() => undefined)
    }

    let captured: unknown
    try {
      await apiFetch('/x')
    } catch (err) {
      captured = err
    }

    expect(captured).toBeInstanceOf(ApiError)
    expect(captured).toBeInstanceOf(ApiRateLimitError)
  })

  it('skipRateLimit bypasses the limiter without touching the gate', async () => {
    resetApiRateLimiter()
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)

    // TEST_MAX + 2 calls is well over the configured cap, but skipRateLimit
    // should let them all through and hit fetch every time.
    for (let i = 0; i < TEST_MAX + 2; i++) {
      await expect(apiFetch('/loop', { skipRateLimit: true })).resolves.toEqual({ ok: true })
    }

    expect(fetchMock).toHaveBeenCalledTimes(TEST_MAX + 2)
  })

  it('resetApiRateLimiter frees capacity without waiting for the window', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)

    for (let i = 0; i < TEST_MAX; i++) {
      await apiFetch('/x')
    }
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiRateLimitError)

    resetApiRateLimiter()

    await expect(apiFetch('/x')).resolves.toEqual({ ok: true })
  })

  it('apiRateLimiterSnapshot reflects the active configuration', () => {
    const snapshot = apiRateLimiterSnapshot()
    expect(snapshot).toEqual({
      maxRequests: TEST_MAX,
      windowMs: TEST_WINDOW_MS,
      enabled: true,
    })
  })
})
