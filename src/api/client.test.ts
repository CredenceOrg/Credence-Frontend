import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, ApiError, apiFetch, buildUrl, normalizeBaseUrl } from './client'

const fetchMock = vi.fn<typeof fetch>()

/** Origin every relative URL in these tests is resolved against. */
const ORIGIN = 'https://app.credence.example'

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', ...init.headers },
    ...init,
  })
}

/** Silences and captures the dev-only base-URL rejection warning. */
function captureWarnings() {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined)
}

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

  it('classifies transport failures as retryable network errors', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      code: 'network_error',
    } satisfies Partial<ApiError>)
  })

  it('classifies non-2xx responses as http errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Nope' }, { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds')).rejects.toMatchObject({
      status: 403,
      code: 'http_error',
    } satisfies Partial<ApiError>)
  })

  it('leaves code undefined on ApiErrors built by legacy three-argument callers', () => {
    const error = new ApiError(500, 'boom')

    expect(error.code).toBeUndefined()
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
  })
})

describe('buildUrl', () => {
  describe('valid paths', () => {
    it('prefixes the API base and guarantees a single separator', () => {
      expect(buildUrl('/bonds', '/api')).toBe('/api/bonds')
    })

    it('adds the missing leading slash', () => {
      expect(buildUrl('bonds', '/api')).toBe('/api/bonds')
    })

    it('trims surrounding whitespace instead of encoding it into the request', () => {
      expect(buildUrl('  /bonds  ', '/api')).toBe('/api/bonds')
    })

    it('preserves query strings verbatim', () => {
      expect(buildUrl('/bonds?status=active&page=2', '/api')).toBe(
        '/api/bonds?status=active&page=2'
      )
    })

    it('preserves a trailing slash, which addresses collection roots', () => {
      expect(buildUrl('/bonds/', '/api')).toBe('/api/bonds/')
    })

    it('resolves the API root when the path is only a slash', () => {
      expect(buildUrl('/', '/api')).toBe('/api/')
    })

    it('preserves interior duplicate slashes because some resources treat them as significant', () => {
      expect(buildUrl('/bonds//children', '/api')).toBe('/api/bonds//children')
    })

    it('preserves percent-encoded and non-ASCII path segments verbatim', () => {
      expect(buildUrl('/bonds/%2Fid', '/api')).toBe('/api/bonds/%2Fid')
      expect(buildUrl('/bonds/ünïcode', '/api')).toBe('/api/bonds/ünïcode')
    })

    it('preserves URL template braces used by route params', () => {
      expect(buildUrl('/bonds/{id}/attestations', '/api')).toBe('/api/bonds/{id}/attestations')
    })
  })

  describe('base URL boundaries', () => {
    it('treats an empty base as same-origin with no prefix', () => {
      expect(buildUrl('/bonds', '')).toBe('/bonds')
    })

    it('treats a bare slash base as same-origin with no prefix', () => {
      expect(buildUrl('/bonds', '/')).toBe('/bonds')
    })

    it('strips trailing slashes from the base so only one separator remains', () => {
      expect(buildUrl('/bonds', '/api/')).toBe('/api/bonds')
      expect(buildUrl('/bonds', '/api///')).toBe('/api/bonds')
    })

    it('trims surrounding whitespace from the base', () => {
      expect(buildUrl('/bonds', '  /api  ')).toBe('/api/bonds')
    })

    it('supports an absolute base that carries its own path prefix', () => {
      expect(buildUrl('/bonds', 'https://api.credence.example/v1/')).toBe(
        'https://api.credence.example/v1/bonds'
      )
    })

    it('supports a plain http origin', () => {
      expect(buildUrl('/bonds', 'http://localhost:3000')).toBe('http://localhost:3000/bonds')
    })
  })

  describe('hostile or malformed bases fail closed', () => {
    it('falls back to same-origin for a scheme-relative base instead of leaking every request', () => {
      const warn = captureWarnings()

      expect(buildUrl('/bonds', '//evil.example')).toBe('/bonds')
      expect(warn).toHaveBeenCalledTimes(1)
    })

    it('falls back to same-origin for a backslash scheme-relative base', () => {
      captureWarnings()

      expect(buildUrl('/bonds', '/\\evil.example')).toBe('/bonds')
    })

    it('falls back to same-origin for a scheme-less base that fetch would resolve as a path', () => {
      captureWarnings()

      expect(buildUrl('/bonds', 'api.credence.example')).toBe('/bonds')
    })

    it.each([
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      'blob:https://x/y',
      '\\\\evil.example',
    ])('falls back to same-origin for the non-http scheme %s', (base) => {
      captureWarnings()

      expect(buildUrl('/bonds', base)).toBe('/bonds')
    })

    it('falls back to same-origin when the base carries a query string', () => {
      captureWarnings()

      expect(buildUrl('/bonds', '/api?token=secret')).toBe('/bonds')
    })

    it('falls back to same-origin when the base carries a fragment', () => {
      captureWarnings()

      expect(buildUrl('/bonds', '/api#frag')).toBe('/bonds')
    })

    it('falls back to same-origin when an absolute base carries a query string', () => {
      captureWarnings()

      expect(buildUrl('/bonds', 'https://api.credence.example/?token=secret')).toBe('/bonds')
    })

    it('never echoes the offending base value, which may embed credentials', () => {
      const warn = captureWarnings()

      buildUrl('/bonds', 'https://user:sup3rsecret@api.credence.example')

      expect(warn).toHaveBeenCalledTimes(0)
    })
  })

  describe('rejected paths', () => {
    it('rejects an empty path', () => {
      expect(() => buildUrl('')).toThrowError(
        expect.objectContaining({
          code: 'invalid_request_url',
          status: 0,
          message: 'Invalid API request path: path must not be empty',
        } satisfies Partial<ApiError>)
      )
    })

    it('rejects a whitespace-only path', () => {
      expect(() => buildUrl('   \t  ')).toThrowError(/path must not be empty/)
    })

    it('rejects an origin-relative path that would become a cross-origin request', () => {
      expect(() => buildUrl('//evil.example/steal')).toThrowError(
        /path must be relative, not origin-relative/
      )
    })

    it.each(['///bonds', '////bonds', '//', '///'])(
      'rejects %j, which the URL parser would read as an origin rather than a path',
      (path) => {
        expect(() => buildUrl(path, '/api')).toThrowError(
          /path must be relative, not origin-relative/
        )
      }
    )

    it('rejects a backslash-led path that the URL parser treats as protocol-relative', () => {
      expect(() => buildUrl('/\\evil.example/steal')).toThrowError(
        /path must not contain backslashes/
      )
    })

    it('rejects dot-segment traversal written with backslashes', () => {
      expect(() => buildUrl('/bonds\\..\\..\\admin')).toThrowError(
        /path must not contain backslashes/
      )
    })

    it.each([
      ['newline', '/bonds\nx'],
      ['carriage return', '/bonds\rx'],
      ['tab', '/bonds\tx'],
      ['null byte', '/bonds\u0000'],
      ['C1 control', '/bonds\u0085'],
      ['DEL', '/bonds\u007f'],
    ])('rejects a path containing a %s that the URL parser would silently drop', (_label, path) => {
      expect(() => buildUrl(path)).toThrowError(/path must not contain control characters/)
    })

    it('rejects a fragment that would silently fetch a different resource', () => {
      expect(() => buildUrl('/bonds#other-resource')).toThrowError(
        /path must not contain a URL fragment/
      )
    })

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a number', 42],
      ['an object', {}],
    ])('rejects %s passed where a path string is required', (_label, value) => {
      expect(() => buildUrl(value as unknown as string)).toThrowError(/path must be a string/)
    })

    it('rejects an empty path even when an explicit base is supplied', () => {
      expect(() => buildUrl('', 'https://api.credence.example')).toThrowError(
        /path must not be empty/
      )
    })
  })

  describe('diagnostics', () => {
    it('strips the query string so tokens never reach logs or the error UI', () => {
      expect(() => buildUrl('/bonds?token=sup3rsecret#frag')).toThrowError(
        expect.objectContaining({
          payload: {
            code: 'invalid_request_url',
            reason: 'path must not contain a URL fragment',
            path: '/bonds?<redacted>',
          },
        } satisfies Partial<ApiError>)
      )
    })

    it('replaces control characters so a path cannot smuggle a newline into a log line', () => {
      let payload: { path: string } | undefined
      try {
        buildUrl('/bo\nnds')
      } catch (error) {
        payload = (error as ApiError).payload as { path: string }
      }

      expect(payload?.path).toBe('/bo?nds')
    })

    it('truncates very long paths so diagnostics stay bounded', () => {
      let payload: { path: string } | undefined
      try {
        buildUrl(`/${'a'.repeat(500)}#frag`)
      } catch (error) {
        payload = (error as ApiError).payload as { path: string }
      }

      expect(payload?.path).toHaveLength(81)
      expect(payload?.path.endsWith('…')).toBe(true)
    })

    it('reports the type instead of the value for non-string input', () => {
      let payload: { path: string } | undefined
      try {
        buildUrl({ secret: 'value' } as unknown as string)
      } catch (error) {
        payload = (error as ApiError).payload as { path: string }
      }

      expect(payload?.path).toBe('object')
    })
  })

  describe('determinism', () => {
    it('is idempotent, so a retry produces a byte-identical URL', () => {
      const first = buildUrl('/bonds?page=2', '/api')
      const second = buildUrl('/bonds?page=2', '/api')

      expect(second).toBe(first)
    })

    it('is idempotent on the base, so re-normalizing an already-normalized base is a no-op', () => {
      const bases = ['', '/', '/api', '/api/', 'https://api.credence.example', 'https://x.dev/v1/']

      for (const base of bases) {
        captureWarnings()
        expect(buildUrl('/bonds', normalizeBaseUrl(base))).toBe(buildUrl('/bonds', base))
      }
    })

    it('does not leak state between calls, so a hostile base cannot affect later calls', () => {
      const warn = captureWarnings()

      expect(buildUrl('/bonds', '//evil.example')).toBe('/bonds')
      expect(buildUrl('/bonds', '/api')).toBe('/api/bonds')
      expect(warn).toHaveBeenCalledTimes(1)
    })

    it('rejects the same invalid input with the same error every time', () => {
      const capture = () => {
        try {
          buildUrl('//evil.example/steal')
          return null
        } catch (error) {
          return error as ApiError
        }
      }
      const first = capture()
      const second = capture()

      expect(first?.message).toBe(second?.message)
      expect(first?.code).toBe('invalid_request_url')
      expect(first?.payload).toEqual(second?.payload)
    })
  })

  describe('origin containment', () => {
    const bases = [
      '',
      '/',
      '/api',
      '/api/',
      '//evil.example',
      '/\\evil.example',
      'api.credence.example',
      'https://api.credence.example',
      'https://api.credence.example/',
      'javascript:alert(1)',
    ]
    const paths = [
      '/bonds',
      'bonds',
      '///bonds',
      '//evil.example/steal',
      '/\\evil.example/steal',
      '/bonds\\..\\..\\admin',
      '/bonds\nx',
      '/bonds#frag',
      'https://evil.example/steal',
      '/bonds?next=https://evil.example',
      '',
      '   ',
    ]

    it.each(bases.flatMap((base) => paths.map((path) => [base, path] as const)))(
      'never escapes the origin resolved for base %j and path %j',
      (base, path) => {
        captureWarnings()
        // The API root is always a valid path, so it pins the origin this base
        // is allowed to reach. Every other path must either reject or land on
        // exactly that origin.
        const expectedOrigin = new URL(buildUrl('/', base), ORIGIN).origin

        let url: string
        try {
          url = buildUrl(path, base)
        } catch (error) {
          expect(error).toBeInstanceOf(ApiError)
          expect((error as ApiError).code).toBe('invalid_request_url')
          return
        }

        expect(new URL(url, ORIGIN).origin).toBe(expectedOrigin)
      }
    )
  })
})

describe('normalizeBaseUrl', () => {
  it.each([
    ['an empty string', ''],
    ['whitespace only', '   '],
    ['a bare slash', '/'],
  ])('resolves %s to the same-origin fallback', (_label, value) => {
    expect(normalizeBaseUrl(value)).toBe('')
  })

  it('resolves a repeated slash to the same-origin fallback', () => {
    captureWarnings()

    expect(normalizeBaseUrl('///')).toBe('')
  })

  it.each([
    ['/api', '/api'],
    ['/api/', '/api'],
    ['/api///', '/api'],
    ['  /api/v1  ', '/api/v1'],
    ['https://api.credence.example', 'https://api.credence.example'],
    ['https://api.credence.example/', 'https://api.credence.example'],
    ['https://api.credence.example/v1/', 'https://api.credence.example/v1'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['HTTPS://API.CREDENCE.EXAMPLE', 'HTTPS://API.CREDENCE.EXAMPLE'],
  ])('normalizes %s to %s', (value, expected) => {
    captureWarnings()

    expect(normalizeBaseUrl(value)).toBe(expected)
  })

  it.each(['http://', 'https://', 'https://%', 'http://:80', 'http://a b'])(
    'fails closed for the unparseable absolute base %j',
    (value) => {
      captureWarnings()

      expect(normalizeBaseUrl(value)).toBe('')
    }
  )

  it('is idempotent for every accepted shape', () => {
    const values = [
      '',
      '/',
      '/api/',
      'https://api.credence.example/v1/',
      'http://localhost:3000',
      '//evil.example',
      'javascript:alert(1)',
      '/api?token=secret',
    ]

    for (const value of values) {
      captureWarnings()
      const once = normalizeBaseUrl(value)
      expect(normalizeBaseUrl(once)).toBe(once)
    }
  })

  it('tolerates a non-string value without throwing, so module load cannot break', () => {
    captureWarnings()

    expect(normalizeBaseUrl(undefined as unknown as string)).toBe('')
    expect(normalizeBaseUrl(null as unknown as string)).toBe('')
  })
})

describe('API_BASE_URL', () => {
  it('falls back to /api when VITE_API_BASE_URL is unset', () => {
    expect(API_BASE_URL).toBe('/api')
  })

  it('is already normalized, so passing it back through the normalizer changes nothing', () => {
    captureWarnings()

    expect(normalizeBaseUrl(API_BASE_URL)).toBe(API_BASE_URL)
  })
})

describe('apiFetch pre-flight failure boundaries', () => {
  it('never reaches the network for an origin-relative path', async () => {
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('//evil.example/steal')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      code: 'invalid_request_url',
    } satisfies Partial<ApiError>)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never reaches the network for an empty path', async () => {
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('')).rejects.toMatchObject({ code: 'invalid_request_url' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces a circular-body serialization fault as a TypeError, not as a network error', async () => {
    vi.stubGlobal('fetch', fetchMock)
    const circular: Record<string, unknown> = {}
    circular.self = circular

    await expect(apiFetch('/bonds', { method: 'POST', body: circular })).rejects.toThrow(TypeError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces an invalid header as a TypeError rather than misreporting it as a network error', async () => {
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiFetch('/bonds', { headers: { 'bad header name': 'value' } })).rejects.toThrow(
      TypeError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps concurrent requests on their own URLs', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(jsonResponse({ url }, { status: 200 }))
    )
    vi.stubGlobal('fetch', fetchMock)

    const [a, b, c] = await Promise.all([
      apiFetch<{ url: string }>('/bonds/1'),
      apiFetch<{ url: string }>('/bonds/2'),
      apiFetch<{ url: string }>('/bonds/3'),
    ])

    expect(a.url).toBe('/api/bonds/1')
    expect(b.url).toBe('/api/bonds/2')
    expect(c.url).toBe('/api/bonds/3')
  })

  it('resolves retries of the same valid request to the same URL', async () => {
    fetchMock.mockImplementation((url: string) => Promise.resolve(jsonResponse({ url })))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/bonds?page=1')
    await apiFetch('/bonds?page=1')

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/bonds?page=1',
      '/api/bonds?page=1',
    ])
  })

  it('fails a retried invalid request identically without touching the network', async () => {
    vi.stubGlobal('fetch', fetchMock)

    const first = await apiFetch('//evil.example/steal').catch((error: ApiError) => error)
    const second = await apiFetch('//evil.example/steal').catch((error: ApiError) => error)

    expect(first).toBeInstanceOf(ApiError)
    expect(second).toMatchObject({
      code: 'invalid_request_url',
      message: (first as ApiError).message,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
