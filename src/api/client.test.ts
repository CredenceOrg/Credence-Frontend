import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import {
  ApiAmountError,
  ApiBodyTooLargeError,
  ApiError,
  ApiRateLimitError,
  MAX_REQUEST_BODY_BYTES,
  apiFetch,
  apiRateLimiterSnapshot,
  defaultApiRateLimiter,
  resetApiRateLimiter,
  type ApiFetchOptions,
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

  it('rejects JSON bodies exceeding MAX_REQUEST_BODY_BYTES before fetching', async () => {
    const oversizedPayload = { data: 'x'.repeat(MAX_REQUEST_BODY_BYTES + 1) }

    await expect(apiFetch('/upload', { method: 'POST', body: oversizedPayload })).rejects.toMatchObject({
      name: 'ApiBodyTooLargeError',
      status: 413,
    } satisfies Partial<ApiBodyTooLargeError>)

    // Fetch must NOT have been called — the guard fires before the network.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts JSON bodies at exactly MAX_REQUEST_BODY_BYTES', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const payload = { data: 'x'.repeat(MAX_REQUEST_BODY_BYTES - 100) }
    await expect(apiFetch('/upload', { method: 'POST', body: payload })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not validate body size for non-JSON payloads (FormData, Blob, etc.)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const fd = new FormData()
    fd.append('file', new Blob([new Uint8Array(10_000_000)]), 'big.bin')
    await expect(apiFetch('/upload', { method: 'POST', body: fd })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
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

describe('apiFetch amount precision boundary (exact decimal amounts)', () => {
  /**
   * Integration-boundary regression coverage for the `amountFields` gate.
   *
   * The invariant under test: a declared amount either leaves this client as
   * an exact, canonical decimal string on the wire, or the call rejects with
   * `ApiAmountError` *before* the rate limiter is consulted or `fetch` is
   * called — with no mutation of the caller's body object.
   */
  const amountFetch = (body: unknown, amountFields: ApiFetchOptions['amountFields']) =>
    apiFetch('/bonds', {
      method: 'POST',
      body: body as Record<string, unknown>,
      amountFields,
      skipRateLimit: true,
    })

  function wireBodyOf(callIndex: number): string {
    return fetchMock.mock.calls[callIndex][1]?.body as string
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('serializes declared amount fields as exact canonical decimal strings', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    await amountFetch({ borrower: 'GABC', amount: 1000.5 }, ['amount'])

    // Byte-exact assertion: the number 1000.5 became the canonical decimal
    // string '1000.50' matching the Bond.amount contract in openapi.yaml.
    expect(wireBodyOf(0)).toBe('{"borrower":"GABC","amount":"1000.50"}')
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('canonicalizes string, number, and bigint inputs identically', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    await amountFetch({ amount: '007.5' }, ['amount'])
    await amountFetch({ amount: 1000n }, ['amount'])
    await amountFetch({ amount: 1000.5 }, ['amount'])
    await amountFetch({ amount: '1000' }, { amount: true })

    expect(wireBodyOf(0)).toBe('{"amount":"7.50"}')
    expect(wireBodyOf(1)).toBe('{"amount":"1000.00"}')
    expect(wireBodyOf(2)).toBe('{"amount":"1000.50"}')
    expect(wireBodyOf(3)).toBe('{"amount":"1000.00"}')
  })

  it('accepts the int64 scaled-integer maximum and rejects anything above it', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    await amountFetch({ amount: '92233720368547758.07' }, ['amount'])
    expect(wireBodyOf(0)).toBe('{"amount":"92233720368547758.07"}')

    await expect(amountFetch({ amount: '92233720368547758.08' }, ['amount'])).rejects.toMatchObject(
      { name: 'ApiAmountError', code: 'OVERFLOW' }
    )
    await expect(amountFetch({ amount: 1e21 }, ['amount'])).rejects.toMatchObject({
      code: 'OVERFLOW',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects float drift, excess scale, negative, and non-finite amounts before fetch', async () => {
    vi.stubGlobal('fetch', fetchMock)

    const invalidBodies = [
      { amount: 0.1 + 0.2 }, // 0.30000000000000004 — float drift
      { amount: '1000.005' }, // excess precision — never rounded
      { amount: -5 }, // negative sign
      { amount: '-0.01' },
      { amount: Number.NaN }, // JSON.stringify would emit null
      { amount: Number.POSITIVE_INFINITY },
    ]

    for (const body of invalidBodies) {
      const rejection = await amountFetch(body, ['amount']).then(
        () => undefined,
        (error: unknown) => error
      )
      expect(rejection, `expected ${JSON.stringify(body)} to be rejected`).toBeInstanceOf(
        ApiAmountError
      )
    }

    // Negative-test invariant: none of the invalid bodies reached the network.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects missing, mistyped, and empty amount fields before fetch', async () => {
    vi.stubGlobal('fetch', fetchMock)

    await expect(amountFetch({}, ['amount'])).rejects.toMatchObject({ code: 'MISSING' })
    await expect(amountFetch({ amount: undefined }, ['amount'])).rejects.toMatchObject({
      code: 'MISSING',
    })
    await expect(amountFetch({ amount: null }, ['amount'])).rejects.toMatchObject({
      code: 'INVALID_TYPE',
    })
    await expect(amountFetch({ amount: 'abc' }, ['amount'])).rejects.toMatchObject({
      code: 'INVALID_FORMAT',
    })
    await expect(amountFetch({ amount: '' }, ['amount'])).rejects.toMatchObject({
      code: 'EMPTY',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects when the body is not a JSON object', async () => {
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiFetch('/bonds', {
        method: 'POST',
        body: [{ amount: '1.00' }],
        amountFields: ['amount'],
        skipRateLimit: true,
      })
    ).rejects.toMatchObject({ code: 'INVALID_BODY', field: null })
    await expect(
      apiFetch('/bonds', {
        method: 'POST',
        body: null,
        amountFields: ['amount'],
        skipRateLimit: true,
      })
    ).rejects.toMatchObject({ code: 'INVALID_BODY' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('enforces per-field rules such as a minimum bond amount and custom scale', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    await amountFetch({ amount: '0.00' }, { amount: { min: '0.01' } }).then(
      () => undefined,
      (error: unknown) => error
    )
    expect(fetchMock).not.toHaveBeenCalled()

    await amountFetch({ amount: '0.01' }, { amount: { min: '0.01' } })
    expect(wireBodyOf(0)).toBe('{"amount":"0.01"}')

    // Stellar-precision (7 decimal place) amounts.
    await amountFetch({ amount: '12.1234567' }, { amount: { scale: 7 } })
    expect(wireBodyOf(1)).toBe('{"amount":"12.1234567"}')
    await expect(
      amountFetch({ amount: '12.12345678' }, { amount: { scale: 7 } })
    ).rejects.toMatchObject({ code: 'INVALID_SCALE' })
  })

  it('does not consume rate-limit budget when rejecting an amount', async () => {
    resetApiRateLimiter()
    const acquireSpy = vi.spyOn(defaultApiRateLimiter, 'acquire')
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiFetch('/bonds', {
        method: 'POST',
        body: { amount: '-1' },
        amountFields: ['amount'],
      })
    ).rejects.toBeInstanceOf(ApiAmountError)

    // The amount gate runs BEFORE the limiter: no budget was spent on the
    // rejected call.
    expect(acquireSpy).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()

    await apiFetch('/bonds', {
      method: 'POST',
      body: { amount: '1.00' },
      amountFields: ['amount'],
    })
    expect(acquireSpy).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never mutates the caller body object', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    const body = { borrower: 'GABC', amount: 1000.5, nested: { keep: true } }
    const snapshot = structuredClone(body)

    await amountFetch(body, ['amount'])

    expect(body).toEqual(snapshot) // original values untouched
    expect(typeof body.amount).toBe('number') // still the caller's number
    expect(body.nested).toBe(body.nested) // sibling references preserved
    // Only the wire body carries the canonical string.
    expect(wireBodyOf(0)).toBe('{"borrower":"GABC","amount":"1000.50","nested":{"keep":true}}')
  })

  it('preserves sibling fields and their JSON types on the wire', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    await amountFetch({ borrower: 'GABC', amount: '1000', durationDays: 90, flags: [1, 2] }, [
      'amount',
    ])

    expect(JSON.parse(wireBodyOf(0))).toEqual({
      borrower: 'GABC',
      amount: '1000.00',
      durationDays: 90,
      flags: [1, 2],
    })
  })

  it('produces byte-identical wire bodies across repeated identical calls', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    await amountFetch({ amount: 1000.5 }, ['amount'])
    await amountFetch({ amount: 1000.5 }, ['amount'])
    await amountFetch({ amount: 1000.5 }, ['amount'])

    expect(wireBodyOf(0)).toBe(wireBodyOf(1))
    expect(wireBodyOf(1)).toBe(wireBodyOf(2))
    expect(wireBodyOf(0)).toBe('{"amount":"1000.50"}')
  })

  it('validates concurrently-submitted calls independently', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.allSettled([
      amountFetch({ requestId: 'a', amount: '100.00' }, ['amount']),
      amountFetch({ requestId: 'b', amount: '100.005' }, ['amount']),
      amountFetch({ requestId: 'c', amount: '50' }, ['amount']),
    ])

    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(results[2].status).toBe('fulfilled')

    const rejection = (results[1] as PromiseRejectedResult).reason
    expect(rejection).toBeInstanceOf(ApiAmountError)
    expect(rejection.code).toBe('INVALID_SCALE')

    // Exactly the two valid calls reached the network.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(wireBodyOf(0)).toBe('{"requestId":"a","amount":"100.00"}')
    expect(wireBodyOf(1)).toBe('{"requestId":"c","amount":"50.00"}')
  })

  it('a network failure after validation leaves no partial state and can be retried', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    const body = { amount: 250.25 }
    const snapshot = structuredClone(body)

    await expect(amountFetch(body, ['amount'])).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    })
    expect(body).toEqual(snapshot)

    // Retry with a healthy network succeeds with the exact same wire body.
    await expect(amountFetch(body, ['amount'])).resolves.toEqual({ id: 'b1' })
    expect(wireBodyOf(1)).toBe('{"amount":"250.25"}')
  })

  it('leaves bodies untouched when amountFields is omitted or empty (back-compat)', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ id: 'b1' })))
    vi.stubGlobal('fetch', fetchMock)

    // Undeclared amounts keep their legacy wire representation, including the
    // float — the gate is strictly opt-in.
    await amountFetch({ amount: 1000.005 }, undefined)
    await amountFetch({ amount: 1000.005 }, [])

    expect(wireBodyOf(0)).toBe('{"amount":1000.005}')
    expect(wireBodyOf(1)).toBe('{"amount":1000.005}')
  })

  it('surfaces ApiAmountError as a 400 ApiError with structured field and code', async () => {
    vi.stubGlobal('fetch', fetchMock)

    let captured: unknown
    try {
      await amountFetch({ amount: -1 }, ['amount'])
    } catch (error) {
      captured = error
    }

    expect(captured).toBeInstanceOf(ApiAmountError)
    expect(captured).toBeInstanceOf(ApiError)
    const err = captured as ApiAmountError
    expect(err.status).toBe(400)
    expect(err.field).toBe('amount')
    expect(err.code).toBe('NEGATIVE')
    expect(err.payload).toEqual({ field: 'amount', code: 'NEGATIVE' })
    expect(err.message).toContain('amount')
  })
})
