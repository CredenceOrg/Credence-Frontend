import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  ApiRateLimitError,
  apiFetch,
  apiRateLimiterSnapshot,
  defaultApiRateLimiter,
  resetApiRateLimiter,
} from './client'

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

describe('apiFetch logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs an error with path and status when a fetch fails with a non-2xx response', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/bonds/missing').catch(() => {})

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const line = errorSpy.mock.calls[0]?.[0] ?? ''
    expect(line).toMatch(/event=api_fetch_failed/)
    expect(line).toContain('path=/bonds/missing')
    expect(line).toMatch(/status=404/)
    expect(line).toMatch(/error=Not found/)
  })

  it('logs an error with status 0 when a network error occurs', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/bonds').catch(() => {})

    expect(errorSpy).toHaveBeenCalledTimes(1)
    const line = errorSpy.mock.calls[0]?.[0] ?? ''
    expect(line).toMatch(/event=api_fetch_failed/)
    expect(line).toContain('path=/bonds')
    expect(line).toMatch(/status=0/)
    expect(line).toMatch(/error=Failed to fetch/)
  })

  it('does not log when a fetch succeeds', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/health')

    expect(errorSpy).not.toHaveBeenCalled()
  })
})
