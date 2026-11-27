/**
 * @file client.concurrency.test.ts
 *
 * Regression suite for the identity-epoch concurrency and race-safety
 * guarantees added to `apiFetch`.
 *
 * ## What is tested
 *
 * 1. **Pre-flight stale epoch** — a request carrying a stale epoch is
 *    rejected with `ApiSessionConflictError` before `fetch` is called.
 *
 * 2. **Post-flight stale epoch** — a request whose epoch becomes stale while
 *    the request is in-flight is rejected on arrival; the response is
 *    discarded and no partial state is committed.
 *
 * 3. **Concurrent parallel requests / same epoch** — two concurrent GET
 *    requests that share an epoch both commit when the epoch does not change.
 *
 * 4. **Epoch mismatch mid-flight for one of two concurrent requests** — the
 *    epoch advances after one request is dispatched but before the second
 *    responds; the first commits (it arrived before the advance), the second
 *    is rejected.
 *
 * 5. **Retry-after-conflict contract** — after a conflict, the caller can
 *    advance the epoch, re-acquire a fresh epoch, and re-issue the request
 *    successfully.
 *
 * 6. **Disconnect / reconnect cycle** — every session boundary properly
 *    invalidates in-flight requests.
 *
 * 7. **Multiple advances in quick succession** — rapid connect→disconnect→
 *    reconnect sequences do not leave the epoch in a bad state.
 *
 * 8. **No epoch option — backward compatibility** — existing callers that do
 *    not pass `identityEpoch` are unaffected by any epoch value.
 *
 * 9. **ApiSessionConflictError extends ApiError** — existing handlers that
 *    only check `err instanceof ApiError` keep working.
 *
 * 10. **resetIdentityEpoch test helper** — the helper returns the counter to
 *    zero so test isolation is clean.
 *
 * ## Invariant asserted throughout
 *
 * - `fetch` is called at most as many times as the number of requests that
 *   passed the pre-flight check.
 * - Rejected requests leave `fetchMock.mock.calls.length` unchanged relative
 *   to expectations.
 * - No promise settles with a partial success for a stale epoch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  ApiRateLimitError,
  ApiSessionConflictError,
  advanceIdentityEpoch,
  apiFetch,
  getIdentityEpoch,
  resetApiRateLimiter,
  resetIdentityEpoch,
} from './client'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const fetchMock = vi.fn<typeof fetch>()

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  })
}

/**
 * Returns a promise that resolves after `ms` milliseconds of real time.
 * Used to sequence concurrent operations in tests without fake timers.
 */
function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ----------------------------------------------------------------------------
// Setup / teardown
// ----------------------------------------------------------------------------

beforeEach(() => {
  // Clean slate: reset epoch and rate-limiter bucket before every test.
  resetIdentityEpoch()
  resetApiRateLimiter()
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

// ----------------------------------------------------------------------------
// ApiSessionConflictError shape tests
// ----------------------------------------------------------------------------

describe('ApiSessionConflictError', () => {
  it('is an instance of ApiError so existing handlers keep working', () => {
    const err = new ApiSessionConflictError(0, 1)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toBeInstanceOf(ApiSessionConflictError)
    expect(err.name).toBe('ApiSessionConflictError')
    expect(err.status).toBe(409)
  })

  it('carries staleEpoch and currentEpoch', () => {
    const err = new ApiSessionConflictError(3, 7)
    expect(err.staleEpoch).toBe(3)
    expect(err.currentEpoch).toBe(7)
  })

  it('accepts a custom message', () => {
    const err = new ApiSessionConflictError(0, 1, 'custom message')
    expect(err.message).toBe('custom message')
  })

  it('generates a meaningful default message', () => {
    const err = new ApiSessionConflictError(2, 5)
    expect(err.message).toMatch(/epoch 2/)
    expect(err.message).toMatch(/5/)
  })

  it('payload reflects staleEpoch and currentEpoch', () => {
    const err = new ApiSessionConflictError(1, 2)
    expect(err.payload).toEqual({ staleEpoch: 1, currentEpoch: 2 })
  })
})

// ----------------------------------------------------------------------------
// Identity epoch helpers
// ----------------------------------------------------------------------------

describe('getIdentityEpoch / advanceIdentityEpoch / resetIdentityEpoch', () => {
  it('starts at 0 after reset', () => {
    expect(getIdentityEpoch()).toBe(0)
  })

  it('advanceIdentityEpoch increments by 1 and returns the new value', () => {
    const next = advanceIdentityEpoch()
    expect(next).toBe(1)
    expect(getIdentityEpoch()).toBe(1)
  })

  it('multiple advances increment monotonically', () => {
    advanceIdentityEpoch()
    advanceIdentityEpoch()
    const third = advanceIdentityEpoch()
    expect(third).toBe(3)
    expect(getIdentityEpoch()).toBe(3)
  })

  it('resetIdentityEpoch returns the counter to 0', () => {
    advanceIdentityEpoch()
    advanceIdentityEpoch()
    resetIdentityEpoch()
    expect(getIdentityEpoch()).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// Pre-flight stale epoch (request never dispatched)
// ----------------------------------------------------------------------------

describe('apiFetch pre-flight epoch check', () => {
  it('rejects with ApiSessionConflictError before calling fetch when epoch is stale', async () => {
    // epoch is 0 at reset; advance it to 1 to make epoch 0 stale
    advanceIdentityEpoch()

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds', { identityEpoch: 0 })).rejects.toMatchObject({
      name: 'ApiSessionConflictError',
      status: 409,
      staleEpoch: 0,
      currentEpoch: 1,
    } satisfies Partial<ApiSessionConflictError>)

    // fetch must never have been called
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not throw when the epoch matches', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const epoch = getIdentityEpoch() // 0
    await expect(apiFetch('/bonds', { identityEpoch: epoch })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not throw when identityEpoch is omitted (backward compatibility)', async () => {
    advanceIdentityEpoch() // epoch is 1, but we pass nothing
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).resolves.toEqual({ ok: true })
  })

  it('stale epoch rejects even if the server would have returned 200', async () => {
    // Simulate: caller captured epoch 0, then disconnect advanced it to 1
    const capturedEpoch = getIdentityEpoch() // 0
    advanceIdentityEpoch() // 1

    fetchMock.mockResolvedValue(jsonResponse({ secret: 'data' }))
    vi.stubGlobal('fetch', fetchMock)

    // The request should not go through regardless of the server response
    await expect(apiFetch('/secret', { identityEpoch: capturedEpoch })).rejects.toMatchObject({
      name: 'ApiSessionConflictError',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ----------------------------------------------------------------------------
// Post-flight stale epoch (epoch advances while request is in-flight)
// ----------------------------------------------------------------------------

describe('apiFetch post-flight epoch check', () => {
  it('rejects with ApiSessionConflictError when epoch advances during in-flight request', async () => {
    // Capture the epoch before the request starts
    const capturedEpoch = getIdentityEpoch() // 0

    // Arrange: fetch hangs until we manually resolve it
    let resolveResponse!: (r: Response) => void
    const hangingFetch = new Promise<Response>((resolve) => {
      resolveResponse = resolve
    })
    fetchMock.mockReturnValueOnce(hangingFetch)
    vi.stubGlobal('fetch', fetchMock)

    // Start the request (does not await yet)
    const requestPromise = apiFetch<{ ok: boolean }>('/bonds', {
      identityEpoch: capturedEpoch,
      skipRateLimit: true,
    })

    // While the request is in-flight, advance the epoch (disconnect event)
    advanceIdentityEpoch()

    // Now let the network response arrive
    resolveResponse(jsonResponse({ ok: true }))

    // The response should be discarded; conflict error should be thrown
    await expect(requestPromise).rejects.toMatchObject({
      name: 'ApiSessionConflictError',
      status: 409,
      staleEpoch: capturedEpoch,
      currentEpoch: 1,
    } satisfies Partial<ApiSessionConflictError>)

    // fetch was called once (the request was dispatched), but result was discarded
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('discards both response body and error body on post-flight conflict', async () => {
    const capturedEpoch = getIdentityEpoch()

    let resolveResponse!: (r: Response) => void
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const requestPromise = apiFetch('/admin/action', {
      identityEpoch: capturedEpoch,
      method: 'POST',
      skipRateLimit: true,
    })

    // Advance twice (reconnect scenario: disconnect + new connect)
    advanceIdentityEpoch()
    advanceIdentityEpoch()

    // Resolve with a 200 — the result must still be discarded
    resolveResponse(jsonResponse({ committed: true }))

    const err = await requestPromise.catch((e) => e)
    expect(err).toBeInstanceOf(ApiSessionConflictError)
    expect((err as ApiSessionConflictError).staleEpoch).toBe(capturedEpoch)
    expect((err as ApiSessionConflictError).currentEpoch).toBe(2)
  })
})

// ----------------------------------------------------------------------------
// Concurrent parallel requests — same epoch, no advance
// ----------------------------------------------------------------------------

describe('concurrent requests with the same epoch (no conflict)', () => {
  it('two concurrent GETs both commit when epoch does not change', async () => {
    const epoch = getIdentityEpoch()

    // Two independent responses
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: 'first' }))
      .mockResolvedValueOnce(jsonResponse({ data: 'second' }))
    vi.stubGlobal('fetch', fetchMock)

    const [r1, r2] = await Promise.all([
      apiFetch<{ data: string }>('/endpoint-a', { identityEpoch: epoch, skipRateLimit: true }),
      apiFetch<{ data: string }>('/endpoint-b', { identityEpoch: epoch, skipRateLimit: true }),
    ])

    expect(r1).toEqual({ data: 'first' })
    expect(r2).toEqual({ data: 'second' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('ten concurrent GETs all commit when epoch is stable throughout', async () => {
    const epoch = getIdentityEpoch()
    const COUNT = 10

    for (let i = 0; i < COUNT; i++) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ i }))
    }
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        apiFetch<{ i: number }>(`/items/${i}`, { identityEpoch: epoch, skipRateLimit: true })
      )
    )

    expect(results).toHaveLength(COUNT)
    results.forEach((r, i) => expect(r).toEqual({ i }))
    expect(fetchMock).toHaveBeenCalledTimes(COUNT)
  })
})

// ----------------------------------------------------------------------------
// Epoch mismatch mid-flight for one of two concurrent requests
// ----------------------------------------------------------------------------

describe('epoch mismatch mid-flight for one of two concurrent requests', () => {
  it('first commits, second rejects when epoch advances between responses', async () => {
    const epoch = getIdentityEpoch()

    let resolveFirst!: (r: Response) => void
    let resolveSecond!: (r: Response) => void

    fetchMock
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirst = resolve
        })
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveSecond = resolve
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const first = apiFetch<{ data: string }>('/a', { identityEpoch: epoch, skipRateLimit: true })
    const second = apiFetch<{ data: string }>('/b', { identityEpoch: epoch, skipRateLimit: true })

    // Let both requests dispatch
    await tick(0)

    // First response arrives before the epoch advances — commits
    resolveFirst(jsonResponse({ data: 'first' }))
    await expect(first).resolves.toEqual({ data: 'first' })

    // Epoch advances before the second response arrives
    advanceIdentityEpoch()

    resolveSecond(jsonResponse({ data: 'second' }))
    await expect(second).rejects.toMatchObject({
      name: 'ApiSessionConflictError',
      staleEpoch: epoch,
      currentEpoch: epoch + 1,
    } satisfies Partial<ApiSessionConflictError>)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ----------------------------------------------------------------------------
// Retry-after-conflict contract
// ----------------------------------------------------------------------------

describe('retry after conflict', () => {
  it('succeeds after advancing to a fresh epoch', async () => {
    const staleEpoch = getIdentityEpoch()

    // First attempt fails because epoch advances before dispatch
    advanceIdentityEpoch()
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds', { identityEpoch: staleEpoch })).rejects.toBeInstanceOf(
      ApiSessionConflictError
    )
    expect(fetchMock).not.toHaveBeenCalled()

    // Re-acquire fresh epoch and retry
    const freshEpoch = getIdentityEpoch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }))

    await expect(apiFetch('/bonds', { identityEpoch: freshEpoch })).resolves.toEqual({
      success: true,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// ----------------------------------------------------------------------------
// Disconnect / reconnect cycle
// ----------------------------------------------------------------------------

describe('disconnect / reconnect cycle', () => {
  it('invalidates in-flight requests at every session boundary', async () => {
    const epoch = getIdentityEpoch()

    let resolveResponse!: (r: Response) => void
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const inFlight = apiFetch('/protected', { identityEpoch: epoch, skipRateLimit: true })

    // Disconnect then reconnect
    advanceIdentityEpoch()
    advanceIdentityEpoch()

    resolveResponse(jsonResponse({ data: 'stale' }))

    await expect(inFlight).rejects.toBeInstanceOf(ApiSessionConflictError)
  })
})

// ----------------------------------------------------------------------------
// Multiple advances in quick succession
// ----------------------------------------------------------------------------

describe('multiple advances in quick succession', () => {
  it('keeps the epoch monotonic and consistent', () => {
    const seen: number[] = []
    for (let i = 0; i < 5; i++) {
      seen.push(advanceIdentityEpoch())
    }
    expect(seen).toEqual([1, 2, 3, 4, 5])
    expect(getIdentityEpoch()).toBe(5)
  })
})

// ----------------------------------------------------------------------------
// No epoch option — backward compatibility
// ----------------------------------------------------------------------------

describe('no epoch option — backward compatibility', () => {
  it('existing callers without identityEpoch are unaffected by epoch advances', async () => {
    advanceIdentityEpoch()
    advanceIdentityEpoch()

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/legacy')).resolves.toEqual({ data: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// ----------------------------------------------------------------------------
// ApiSessionConflictError extends ApiError — handler compatibility
// ----------------------------------------------------------------------------

describe('ApiSessionConflictError extends ApiError', () => {
  it('existing handlers that only check ApiError keep working', () => {
    const err = new ApiSessionConflictError(0, 1)
    expect(err).toBeInstanceOf(ApiError)
  })

  it('ApiRateLimitError is still an ApiError', () => {
    const err = new ApiRateLimitError(1000)
    expect(err).toBeInstanceOf(ApiError)
  })
})

// ----------------------------------------------------------------------------
// resetIdentityEpoch test helper isolation
// ----------------------------------------------------------------------------

describe('resetIdentityEpoch test helper', () => {
  it('returns the counter to zero for clean test isolation', () => {
    advanceIdentityEpoch()
    advanceIdentityEpoch()
    advanceIdentityEpoch()
    resetIdentityEpoch()
    expect(getIdentityEpoch()).toBe(0)
  })
})
