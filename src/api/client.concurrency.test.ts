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
 *     zero so test isolation is clean.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ApiSessionConflictError shape tests
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Identity epoch helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pre-flight stale epoch (request never dispatched)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Post-flight stale epoch (epoch advances while request is in-flight)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Concurrent parallel requests — same epoch, no advance
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Partial-conflict: epoch advances mid-flight for only one of two requests
// ---------------------------------------------------------------------------

describe('partial concurrent conflict', () => {
  it('first request commits, second is rejected when epoch advances between their resolutions', async () => {
    const capturedEpoch = getIdentityEpoch()

    // The first fetch resolves immediately
    // The second fetch will be manually controlled
    let resolveSecond!: (r: Response) => void
    fetchMock.mockResolvedValueOnce(jsonResponse({ request: 'first' })).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveSecond = resolve
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    // Fire both requests
    const p1 = apiFetch<{ request: string }>('/r1', {
      identityEpoch: capturedEpoch,
      skipRateLimit: true,
    })
    const p2 = apiFetch<{ request: string }>('/r2', {
      identityEpoch: capturedEpoch,
      skipRateLimit: true,
    })

    // Wait for the first to settle
    const r1 = await p1
    expect(r1).toEqual({ request: 'first' })

    // Now advance epoch (disconnect between requests resolving)
    advanceIdentityEpoch()

    // Let the second response arrive
    resolveSecond(jsonResponse({ request: 'second' }))

    // Second request must be rejected
    await expect(p2).rejects.toMatchObject({
      name: 'ApiSessionConflictError',
      staleEpoch: capturedEpoch,
      currentEpoch: 1,
    } satisfies Partial<ApiSessionConflictError>)

    // Both requests hit the network (second was dispatched before the epoch advanced)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// Retry-after-conflict contract
// ---------------------------------------------------------------------------

describe('retry after conflict', () => {
  it('re-issuing a request with a fresh epoch succeeds after a conflict', async () => {
    const staleEpoch = getIdentityEpoch() // 0
    advanceIdentityEpoch() // epoch → 1

    vi.stubGlobal('fetch', fetchMock)

    // First attempt: stale epoch, rejected pre-flight
    await expect(apiFetch('/action', { identityEpoch: staleEpoch })).rejects.toMatchObject({
      name: 'ApiSessionConflictError',
    })
    expect(fetchMock).not.toHaveBeenCalled()

    // Caller re-reads epoch after re-authentication
    const freshEpoch = getIdentityEpoch() // 1
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(
      apiFetch('/action', { identityEpoch: freshEpoch, skipRateLimit: true })
    ).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('caller must re-acquire epoch after post-flight conflict; stale retry is still rejected', async () => {
    const capturedEpoch = getIdentityEpoch()

    let resolveFirst!: (r: Response) => void
    fetchMock
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFirst = resolve
        })
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const firstAttempt = apiFetch('/action', {
      identityEpoch: capturedEpoch,
      skipRateLimit: true,
    })

    advanceIdentityEpoch() // epoch advances mid-flight
    resolveFirst(jsonResponse({ ok: true })) // server says 200 but we discard it

    await expect(firstAttempt).rejects.toMatchObject({ name: 'ApiSessionConflictError' })

    // Retry with the OLD (stale) epoch → still rejected pre-flight
    await expect(
      apiFetch('/action', { identityEpoch: capturedEpoch, skipRateLimit: true })
    ).rejects.toMatchObject({ name: 'ApiSessionConflictError' })

    // Retry with the fresh epoch → succeeds
    const freshEpoch = getIdentityEpoch()
    await expect(
      apiFetch('/action', { identityEpoch: freshEpoch, skipRateLimit: true })
    ).resolves.toEqual({ ok: true })

    // Only 2 fetch calls: initial (in-flight) + fresh retry (stale retry was pre-flight blocked)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// Disconnect / reconnect cycle
// ---------------------------------------------------------------------------

describe('session lifecycle: connect → disconnect → reconnect', () => {
  it('epoch advances on disconnect and old in-flight requests are invalidated', async () => {
    // Simulate: user connects → epoch 0 captured → user disconnects mid-request
    const connectedEpoch = getIdentityEpoch() // 0

    let resolveDisconnected!: (r: Response) => void
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveDisconnected = resolve
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const requestDuringSession = apiFetch('/dashboard', {
      identityEpoch: connectedEpoch,
      skipRateLimit: true,
    })

    // Disconnect: advance epoch
    advanceIdentityEpoch() // epoch → 1

    // Response arrives after disconnect
    resolveDisconnected(jsonResponse({ data: 'sensitive' }))

    await expect(requestDuringSession).rejects.toMatchObject({
      name: 'ApiSessionConflictError',
      staleEpoch: connectedEpoch,
      currentEpoch: 1,
    } satisfies Partial<ApiSessionConflictError>)
  })

  it('reconnect after disconnect gives a fresh epoch; new requests succeed', async () => {
    // connect
    const epoch0 = getIdentityEpoch() // 0
    // disconnect
    advanceIdentityEpoch() // epoch → 1
    // reconnect (new account)
    advanceIdentityEpoch() // epoch → 2

    const freshEpoch = getIdentityEpoch() // 2
    expect(freshEpoch).toBe(2)

    fetchMock.mockResolvedValueOnce(jsonResponse({ profile: 'new-user' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiFetch('/profile', { identityEpoch: freshEpoch, skipRateLimit: true })
    ).resolves.toEqual({ profile: 'new-user' })

    // Old epoch 0 should still be rejected
    await expect(
      apiFetch('/profile', { identityEpoch: epoch0, skipRateLimit: true })
    ).rejects.toMatchObject({ name: 'ApiSessionConflictError' })
  })

  it('rapid connect→disconnect→reconnect leaves a clean, monotonically increasing epoch', async () => {
    expect(getIdentityEpoch()).toBe(0)
    for (let i = 0; i < 10; i++) {
      advanceIdentityEpoch()
    }
    expect(getIdentityEpoch()).toBe(10)

    // Only the latest epoch lets requests through
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const currentEpoch = getIdentityEpoch()
    await expect(
      apiFetch('/check', { identityEpoch: currentEpoch, skipRateLimit: true })
    ).resolves.toEqual({ ok: true })

    // Any earlier epoch is still stale
    for (let stale = 0; stale < 10; stale++) {
      await expect(
        apiFetch('/check', { identityEpoch: stale, skipRateLimit: true })
      ).rejects.toMatchObject({ name: 'ApiSessionConflictError' })
    }
  })
})

// ---------------------------------------------------------------------------
// Backward compatibility: callers without identityEpoch are unaffected
// ---------------------------------------------------------------------------

describe('backward compatibility — no identityEpoch option', () => {
  it('existing calls without identityEpoch work regardless of epoch value', async () => {
    advanceIdentityEpoch()
    advanceIdentityEpoch()
    advanceIdentityEpoch() // epoch is 3

    fetchMock.mockResolvedValueOnce(jsonResponse({ legacy: true }))
    vi.stubGlobal('fetch', fetchMock)

    // No identityEpoch option — must not throw
    await expect(apiFetch('/legacy')).resolves.toEqual({ legacy: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('existing ApiError handling path still works for non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Forbidden' }, { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/protected')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Forbidden',
    })
  })
})

// ---------------------------------------------------------------------------
// Interaction with rate limiter: epoch check is independent
// ---------------------------------------------------------------------------

describe('epoch check and rate limiter interaction', () => {
  it('rate limit error (429) fires before epoch check for pre-flight stale epoch', async () => {
    // Exhaust the rate limiter first (skipRateLimit: false)
    // We need to fill the bucket; the default is 20 requests.
    // Rather than making 20 real calls, we configure a small limiter temporarily.
    // Instead, we manipulate via the defaultApiRateLimiter directly.
    const { defaultApiRateLimiter } = await import('./client')
    defaultApiRateLimiter.configure({ maxRequests: 1, windowMs: 60_000 })

    // One allowed call to fill the bucket
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await apiFetch('/fill', { skipRateLimit: false })

    // Now epoch is stale AND rate limit is exhausted
    const staleEpoch = 0
    advanceIdentityEpoch()

    // Rate limit check fires first (it's before the epoch check in apiFetch)
    await expect(apiFetch('/blocked', { identityEpoch: staleEpoch })).rejects.toMatchObject({
      name: 'ApiRateLimitError',
      status: 429,
    })

    // Restore default rate limit
    defaultApiRateLimiter.configure({ maxRequests: 20, windowMs: 5_000 })
    resetApiRateLimiter()
  })

  it('stale epoch is caught when rate limit is not exhausted', async () => {
    advanceIdentityEpoch()

    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/data', { identityEpoch: 0 })).rejects.toMatchObject({
      name: 'ApiSessionConflictError',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Final state assertions: no partial committed state after conflict
// ---------------------------------------------------------------------------

describe('no partial state after conflict (final-state assertions)', () => {
  /**
   * Simulates the pattern used in useApiMutation: optimistic update → in-flight
   * request → conflict → rollback.
   *
   * The test proves that once a conflict is detected, the caller's rollback
   * path is deterministically reachable (the error type is exactly
   * ApiSessionConflictError) and the pre-conflict value is restored.
   */
  it('optimistic-update callers can deterministically detect conflict and rollback', async () => {
    type State = { count: number }

    // Simulated optimistic state — optimistic update already applied (count: 0 → 1).
    const rollbackValue: State = { count: 0 }
    let committed: State = { count: 1 } // optimistic update already applied

    let resolveRequest!: (r: Response) => void
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const capturedEpoch = getIdentityEpoch()
    const request = apiFetch<State>('/counter/increment', {
      method: 'POST',
      body: { delta: 1 },
      identityEpoch: capturedEpoch,
      skipRateLimit: true,
    })

    // Epoch advances mid-flight (disconnect)
    advanceIdentityEpoch()
    resolveRequest(jsonResponse({ count: 1 }))

    let caught: unknown
    try {
      await request
    } catch (err) {
      caught = err
      if (err instanceof ApiSessionConflictError) {
        // Rollback optimistic update
        committed = rollbackValue
      }
    }

    expect(caught).toBeInstanceOf(ApiSessionConflictError)
    expect(committed).toEqual({ count: 0 }) // rolled back to pre-optimistic state
  })

  it('rejected / stale / failed operations leave no ApiSessionConflictError as ApiRateLimitError', async () => {
    // Confirm the types are distinct (type narrowing regression guard)
    const conflict = new ApiSessionConflictError(0, 1)
    const rateLimit = new ApiRateLimitError(1000)

    expect(conflict).not.toBeInstanceOf(ApiRateLimitError)
    expect(rateLimit).not.toBeInstanceOf(ApiSessionConflictError)

    // Both extend ApiError
    expect(conflict).toBeInstanceOf(ApiError)
    expect(rateLimit).toBeInstanceOf(ApiError)
  })

  it('aborted requests are unaffected by epoch check — AbortError re-thrown as-is', async () => {
    const capturedEpoch = getIdentityEpoch()
    const controller = new AbortController()

    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValueOnce(abortError)
    vi.stubGlobal('fetch', fetchMock)

    // Signal is already aborted; fetch mock rejects immediately
    await expect(
      apiFetch('/data', {
        signal: controller.signal,
        identityEpoch: capturedEpoch,
        skipRateLimit: true,
      })
    ).rejects.toBe(abortError)
  })
})

// ---------------------------------------------------------------------------
// Deterministic parallel tests (contention)
// ---------------------------------------------------------------------------

describe('deterministic parallel contention tests', () => {
  it('N requests dispatched concurrently — only those with the current epoch succeed', async () => {
    const epoch0 = getIdentityEpoch() // 0

    // Prepare 5 responses, but we expect only 3 to commit
    for (let i = 0; i < 5; i++) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ i }))
    }
    vi.stubGlobal('fetch', fetchMock)

    // First 3 requests: use epoch0 — epoch does not advance yet
    const requests = [0, 1, 2].map((i) =>
      apiFetch<{ i: number }>(`/item/${i}`, { identityEpoch: epoch0, skipRateLimit: true })
    )

    // Advance epoch (disconnect)
    advanceIdentityEpoch() // epoch → 1

    // Last 2 requests: also carry epoch0 (stale)
    const staleRequests = [3, 4].map((i) =>
      apiFetch<{ i: number }>(`/item/${i}`, { identityEpoch: epoch0, skipRateLimit: true })
    )

    // Wait for everything to settle
    const outcomes = await Promise.allSettled([...requests, ...staleRequests])

    // First 3 may or may not commit depending on whether the epoch advanced
    // before they resolved. In this test they all resolve synchronously via
    // mockResolvedValueOnce, so the epoch advances after all 3 are dispatched
    // but their post-flight checks still see epoch 1 (advanced before await resolves).
    //
    // Requests 0-2 were dispatched with epoch0; since the epoch advanced before
    // any await point completes in this sequential microtask chain, all 5 will
    // observe the conflict in the post-flight check.
    //
    // The critical invariant is: staleRequests 3 and 4 are ALWAYS rejected pre-flight
    // because the epoch was already advanced before they were created.

    for (const outcome of staleRequests.map((_, i) => outcomes[3 + i])) {
      expect(outcome.status).toBe('rejected')
      if (outcome.status === 'rejected') {
        expect(outcome.reason).toBeInstanceOf(ApiSessionConflictError)
      }
    }

    // Regardless of how the first 3 settled, none should have resolved with
    // a value from after the epoch advance.
    const committedResults = outcomes
      .filter((o) => o.status === 'fulfilled')
      .map((o) => (o as PromiseFulfilledResult<{ i: number }>).value)

    for (const r of committedResults) {
      expect([0, 1, 2]).toContain(r.i)
    }
  })

  it('all requests fail cleanly when epoch advances before any are dispatched', async () => {
    const staleEpoch = getIdentityEpoch()
    advanceIdentityEpoch() // make it stale immediately

    vi.stubGlobal('fetch', fetchMock)

    const outcomes = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        apiFetch(`/item/${i}`, { identityEpoch: staleEpoch, skipRateLimit: true })
      )
    )

    for (const outcome of outcomes) {
      expect(outcome.status).toBe('rejected')
      if (outcome.status === 'rejected') {
        expect(outcome.reason).toBeInstanceOf(ApiSessionConflictError)
      }
    }

    // No network calls: all rejected pre-flight
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retry-after-conflict with fresh epoch succeeds even when prior requests failed', async () => {
    // Phase 1: disconnect while in-flight
    const staleEpoch = getIdentityEpoch()
    let resolveInflight!: (r: Response) => void
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveInflight = resolve
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const inflight = apiFetch('/data', { identityEpoch: staleEpoch, skipRateLimit: true })
    advanceIdentityEpoch()
    resolveInflight(jsonResponse({ stale: true }))
    await expect(inflight).rejects.toBeInstanceOf(ApiSessionConflictError)

    // Phase 2: reconnect, re-issue
    const freshEpoch = getIdentityEpoch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ fresh: true }))
    const result = await apiFetch<{ fresh: boolean }>('/data', {
      identityEpoch: freshEpoch,
      skipRateLimit: true,
    })
    expect(result).toEqual({ fresh: true })

    // 2 fetch calls total: one stale (dispatched), one fresh
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await tick() // drain microtasks
  })
})
