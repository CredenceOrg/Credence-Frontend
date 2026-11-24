/**
 * Deterministic failure-boundary coverage for {@link normalizeBaseUrl}.
 *
 * Closes #1105 — Add deterministic failure-boundary coverage for
 * normalizeBaseUrl in ./src/api/client.ts
 *
 * This file is focused exclusively on normalizeBaseUrl. It supplements the
 * integration-level assertions already in client.test.ts by providing
 * exhaustive, labelled coverage of every branch, boundary condition, and
 * security invariant the function enforces.
 *
 * Implementation reference (src/api/client.ts):
 *
 *   1. Non-string input → typeof guard → trimmed = ''
 *   2. Empty / whitespace-only / bare '/' → return ''
 *   3. Starts with '//' or '/\' → rejectBaseUrl() → ''  (open-redirect guard)
 *   4. Starts with '/' and contains '?' or '#' → rejectBaseUrl() → ''
 *   5. Starts with '/' → strip trailing slashes → return
 *   6. Not /^https?:\/\//i → rejectBaseUrl() → ''
 *   7. new URL() throws → rejectBaseUrl() → ''
 *   8. Parsed URL has search/hash → rejectBaseUrl() → ''
 *   9. Otherwise → strip trailing slashes → return
 *
 * Test sections:
 *   §1  Same-origin fallback inputs (empty, whitespace, bare slash)
 *   §2  Valid relative-path bases
 *   §3  Valid absolute http(s) bases — including ports and sub-paths
 *   §4  Scheme-relative and backslash-relative rejection (open-redirect)
 *   §5  Dangerous / unsupported schemes
 *   §6  Absolute URLs carrying query strings or fragments
 *   §7  Relative paths carrying query strings or fragments
 *   §8  Unparseable absolute URLs (new URL() throws)
 *   §9  Non-string inputs — module-load safety
 *   §10 Idempotency — fixed-point property
 *   §11 Credential embedding — security / warning observability
 *   §12 Unicode hosts and percent-encoded sequences
 *   §13 Boundary-length values
 *   §14 Concurrency — no cross-contamination
 *   §15 Warning behaviour — dev-mode emission and value-redaction
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeBaseUrl } from './client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Silences and captures console.warn so assertions can inspect its calls
 * without polluting test output.
 */
function captureWarnings() {
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined)
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// §1  Same-origin fallback — inputs that should yield ''
// ---------------------------------------------------------------------------

describe('§1 same-origin fallback inputs', () => {
  /**
   * An empty result means "use same-origin requests, no prefix". These inputs
   * are all valid sentinels for that state and must never trigger a warning.
   */
  it.each([
    ['empty string', ''],
    ['single space', ' '],
    ['multiple spaces', '   '],
    ['tab character', '\t'],
    ['newline character', '\n'],
    ['mixed whitespace', ' \t\n\r '],
    ['bare forward slash', '/'],
    ['forward slash with surrounding whitespace', ' / '],
  ])('returns "" for %s without a warning', (_label, value) => {
    const warn = captureWarnings()
    expect(normalizeBaseUrl(value)).toBe('')
    expect(warn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// §2  Valid relative-path bases
// ---------------------------------------------------------------------------

describe('§2 valid relative-path bases', () => {
  it.each([
    // canonical
    ['/api', '/api'],
    ['/api/', '/api'],
    ['/api/v1', '/api/v1'],
    ['/api/v1/', '/api/v1'],
    // multiple trailing slashes stripped
    ['/api///', '/api'],
    ['/api/v2///', '/api/v2'],
    // leading/trailing whitespace trimmed before processing
    ['  /api  ', '/api'],
    ['  /api/v1  ', '/api/v1'],
    // deep paths preserved verbatim
    ['/services/api/v3', '/services/api/v3'],
    // single-segment path
    ['/x', '/x'],
  ])('normalizes %j to %j without a warning', (value, expected) => {
    const warn = captureWarnings()
    expect(normalizeBaseUrl(value)).toBe(expected)
    expect(warn).not.toHaveBeenCalled()
  })

  it('preserves an interior double slash — it is not a scheme-relative prefix', () => {
    // '/api//internal' starts with a single '/', so the scheme-relative guard
    // (which checks for a leading '//') does NOT fire. Interior '//' is kept.
    const warn = captureWarnings()
    expect(normalizeBaseUrl('/api//internal')).toBe('/api//internal')
    expect(warn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// §3  Valid absolute http(s) bases — including ports and sub-paths
// ---------------------------------------------------------------------------

describe('§3 valid absolute http(s) bases', () => {
  it.each([
    // plain https
    ['https://api.credence.example', 'https://api.credence.example'],
    ['https://api.credence.example/', 'https://api.credence.example'],
    ['https://api.credence.example/v1', 'https://api.credence.example/v1'],
    ['https://api.credence.example/v1/', 'https://api.credence.example/v1'],
    // plain http
    ['http://localhost:3000', 'http://localhost:3000'],
    ['http://localhost:3000/', 'http://localhost:3000'],
    ['http://localhost:3000/api', 'http://localhost:3000/api'],
    // case-insensitive scheme prefix accepted
    ['HTTPS://API.CREDENCE.EXAMPLE', 'HTTPS://API.CREDENCE.EXAMPLE'],
    ['Http://localhost:3000', 'Http://localhost:3000'],
    // explicit non-default ports
    ['https://api.credence.example:8443', 'https://api.credence.example:8443'],
    ['https://api.credence.example:8443/v2', 'https://api.credence.example:8443/v2'],
    ['https://api.credence.example:8443/v2/', 'https://api.credence.example:8443/v2'],
    // IP addresses
    ['http://127.0.0.1:3000', 'http://127.0.0.1:3000'],
    ['http://192.168.1.1/api', 'http://192.168.1.1/api'],
    // multi-segment sub-path
    ['https://api.example.com/services/credence/v3', 'https://api.example.com/services/credence/v3'],
    ['https://api.example.com/services/credence/v3/', 'https://api.example.com/services/credence/v3'],
    // whitespace around absolute URL trimmed
    ['  https://api.credence.example  ', 'https://api.credence.example'],
  ])('normalizes %j to %j without a warning', (value, expected) => {
    const warn = captureWarnings()
    expect(normalizeBaseUrl(value)).toBe(expected)
    expect(warn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// §4  Scheme-relative and backslash-relative rejection
// ---------------------------------------------------------------------------

describe('§4 scheme-relative and backslash-relative rejection (open-redirect guard)', () => {
  /**
   * Security invariant: '//host' and '/\host' are protocol-relative URLs per
   * the WHATWG fetch spec. Accepting them would forward every API request —
   * including Authorization headers — to an attacker-controlled origin.
   * Every such input MUST fail closed to ''.
   */
  it.each([
    // classic scheme-relative
    '//evil.example',
    '//evil.example/steal',
    '///tripled-slash',
    '// evil.example',
    '//user:token@evil.example',
    '//evil.example:443',
    // WHATWG backslash variant — URL parser treats \\ as / for special schemes
    '/\\evil.example',
    '/\\evil.example/steal',
  ])('fails closed for %j', (value) => {
    captureWarnings()
    expect(normalizeBaseUrl(value)).toBe('')
  })

  it('emits a warning for every scheme-relative rejection', () => {
    const warn = captureWarnings()
    normalizeBaseUrl('//evil.example')
    normalizeBaseUrl('/\\evil.example')
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('does not echo the rejected value in the warning (credential safety)', () => {
    const warn = captureWarnings()
    normalizeBaseUrl('//user:s3cr3t@evil.example')
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0][0])
    expect(message).not.toContain('s3cr3t')
    expect(message).not.toContain('//user:s3cr3t@evil.example')
  })
})

// ---------------------------------------------------------------------------
// §5  Dangerous / unsupported schemes
// ---------------------------------------------------------------------------

describe('§5 dangerous and unsupported schemes', () => {
  /**
   * Only http(s) is permitted. Every other scheme must fail closed to ''.
   * This prevents XSS via javascript:, data-URI injection, and scheme-less
   * host typos that fetch would silently misroute as same-origin paths.
   */
  it.each([
    // XSS / code-execution
    'javascript:alert(1)',
    'javascript:void(0)',
    'JAVASCRIPT:alert(1)',
    // data URI injection
    'data:text/html,<script>alert(1)</script>',
    'data:application/octet-stream;base64,AAAA',
    // blob and file
    'blob:https://app.example/uuid',
    'file:///etc/passwd',
    'file://C:/Windows/System32',
    // scheme-less hostname typo — fetch would treat as a same-origin path
    'api.credence.example',
    'api.credence.example/v1',
    // other non-http(s) schemes
    'ftp://files.example.com',
    'ws://realtime.example.com',
    'wss://realtime.example.com',
  ])('fails closed for dangerous/unsupported scheme %j', (value) => {
    captureWarnings()
    expect(normalizeBaseUrl(value)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// §6  Absolute URLs carrying query strings or fragments
// ---------------------------------------------------------------------------

describe('§6 absolute URLs with query strings or fragments', () => {
  /**
   * A query string or fragment in the base URL would swallow the request
   * path. The path appended after '?' is sent to the server as a query
   * parameter; the fragment is stripped entirely. Both are silent wrong-
   * resource fetches and must be rejected.
   */
  it.each([
    // query string only
    'https://api.credence.example?env=prod',
    'https://api.credence.example/?env=prod',
    'https://api.credence.example/v1?debug=1',
    'https://api.credence.example/v1?a=1&b=2',
    // fragment only
    'https://api.credence.example#section',
    'https://api.credence.example/#section',
    'https://api.credence.example/v1#anchor',
    // both
    'https://api.credence.example?a=1#b',
  ])('fails closed for absolute base with query/fragment %j', (value) => {
    captureWarnings()
    expect(normalizeBaseUrl(value)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// §7  Relative paths carrying query strings or fragments
// ---------------------------------------------------------------------------

describe('§7 relative paths with query strings or fragments', () => {
  /**
   * Same invariant as §6 applied to root-relative bases.
   */
  it.each([
    '/api?token=secret',
    '/api?env=prod',
    '/api/v1?debug=1&trace=true',
    '/api#docs',
    '/api/v1#section',
    '/api?a=1#frag',
    '/#root',
  ])('fails closed for relative base with query/fragment %j', (value) => {
    captureWarnings()
    expect(normalizeBaseUrl(value)).toBe('')
  })

  it('does not echo the rejected value in the warning (token safety)', () => {
    const warn = captureWarnings()
    normalizeBaseUrl('/api?token=supersecret')
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0][0])
    expect(message).not.toContain('supersecret')
    expect(message).not.toContain('/api?token=supersecret')
  })
})

// ---------------------------------------------------------------------------
// §8  Unparseable absolute URLs (new URL() throws)
// ---------------------------------------------------------------------------

describe('§8 unparseable absolute URLs', () => {
  /**
   * If a value passes the /^https?:\/\//i scheme check but new URL() still
   * throws, the function must fail closed. This catches malformed hosts,
   * invalid percent-encoding, bad ports, and other URL-level errors the
   * regex cannot anticipate.
   */
  it.each([
    // bare scheme with nothing after
    'http://',
    'https://',
    // invalid host characters (space)
    'http://a b/api',
    'https://api .example.com',
    // missing host, port only
    'http://:80',
    // invalid percent-encoding — lone '%' is not a valid escape sequence
    'https://api.%credence.example',
    'https://%zz.example.com',
  ])('fails closed for unparseable absolute URL %j', (value) => {
    captureWarnings()
    expect(normalizeBaseUrl(value)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// §9  Non-string inputs — module-load safety
// ---------------------------------------------------------------------------

describe('§9 non-string inputs', () => {
  /**
   * Invariant: the function must never throw regardless of input type.
   * VITE_* env values are always strings at runtime, but TypeScript callers
   * can pass a typed undefined. A throw during module evaluation would abort
   * app boot entirely, which is worse than silently falling back to same-origin.
   */
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number 0', 0],
    ['number 42', 42],
    ['boolean true', true],
    ['boolean false', false],
    ['empty object', {}],
    ['empty array', []],
    ['Symbol', Symbol('test')],
  ])('returns "" without throwing for %s input', (_label, value) => {
    captureWarnings()
    expect(() => normalizeBaseUrl(value as unknown as string)).not.toThrow()
    expect(normalizeBaseUrl(value as unknown as string)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// §10  Idempotency — fixed-point property
// ---------------------------------------------------------------------------

describe('§10 idempotency', () => {
  /**
   * Invariant: normalizeBaseUrl(normalizeBaseUrl(x)) === normalizeBaseUrl(x)
   * for every input x, including invalid ones.
   *
   * This guarantees that buildUrl is safe to call with an already-normalised
   * base (the default) and that re-running normalisation never diverges.
   * It also means the rejection path ('' → '') is a fixed point, so a
   * hostile value can be applied multiple times without side-effects.
   */
  const cases: Array<[string, unknown]> = [
    // accepted → normalised forms are already fixed points
    ['empty string', ''],
    ['bare slash', '/'],
    ['relative path', '/api'],
    ['relative path with trailing slash', '/api/'],
    ['relative deep path with trailing slash', '/api/v1/'],
    ['https origin', 'https://api.credence.example'],
    ['https origin with trailing slash', 'https://api.credence.example/'],
    ['https with path and trailing slash', 'https://api.credence.example/v1/'],
    ['http localhost', 'http://localhost:3000'],
    // rejected → all collapse to '' which is itself a fixed point
    ['scheme-relative', '//evil.example'],
    ['backslash-relative', '/\\evil.example'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['relative with query', '/api?token=secret'],
    ['absolute with fragment', 'https://api.credence.example#section'],
    ['scheme-less hostname', 'api.credence.example'],
    // non-string inputs → '' fixed point
    ['null', null],
    ['undefined', undefined],
  ]

  it.each(cases)('is idempotent for %s', (_label, value) => {
    captureWarnings()
    const once = normalizeBaseUrl(value as unknown as string)
    // Re-applying on an already-normalised value must be a no-op.
    const warn = captureWarnings()
    const twice = normalizeBaseUrl(once)
    expect(twice).toBe(once)
    // A valid normalised value must not trigger a spurious warning on re-entry.
    if (once !== '') {
      expect(warn).not.toHaveBeenCalled()
    }
  })
})

// ---------------------------------------------------------------------------
// §11  Credential embedding — security / warning observability
// ---------------------------------------------------------------------------

describe('§11 credential embedding in absolute URLs', () => {
  /**
   * https://user:pass@host credentials form a valid http(s) URL and are
   * forwarded to the server by the browser fetch. The function accepts such
   * values (they are valid origins), but rejectBaseUrl() MUST NOT echo the
   * value in any log so credentials cannot leak into telemetry or the
   * browser console.
   */

  it('accepts an https URL with embedded credentials without a warning', () => {
    const warn = captureWarnings()
    const result = normalizeBaseUrl('https://user:pass@api.credence.example')
    // Valid http(s) URL — accepted unchanged.
    expect(result).toBe('https://user:pass@api.credence.example')
    expect(warn).not.toHaveBeenCalled()
  })

  it('trailing-slash is stripped even when credentials are present', () => {
    expect(normalizeBaseUrl('https://user:pass@api.credence.example/')).toBe(
      'https://user:pass@api.credence.example',
    )
  })

  it('never echoes credentials in any warning for a rejected credential-bearing value', () => {
    const warn = captureWarnings()
    // Scheme-relative with credentials — must reject and not echo the secret.
    normalizeBaseUrl('//user:s3cr3t@evil.example')
    if (warn.mock.calls.length > 0) {
      const allWarnings = warn.mock.calls.map((c) => String(c[0])).join('\n')
      expect(allWarnings).not.toContain('s3cr3t')
      expect(allWarnings).not.toContain('//user:s3cr3t@evil.example')
    }
  })
})

// ---------------------------------------------------------------------------
// §12  Unicode hosts and percent-encoded sequences
// ---------------------------------------------------------------------------

describe('§12 Unicode hosts and percent-encoded sequences', () => {
  it('accepts a valid https URL with a punycode/ACE-encoded IDN host', () => {
    // Punycode is a plain ASCII label — new URL() parses it without issue.
    const warn = captureWarnings()
    expect(normalizeBaseUrl('https://xn--p1ai.example.com')).toBe(
      'https://xn--p1ai.example.com',
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('accepts a valid https URL with a percent-encoded path segment', () => {
    const warn = captureWarnings()
    expect(normalizeBaseUrl('https://api.example.com/v1%2Fbeta')).toBe(
      'https://api.example.com/v1%2Fbeta',
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('fails closed for a URL with an invalid lone percent sign in the host', () => {
    captureWarnings()
    // '%' not followed by two hex digits is invalid — new URL() throws.
    expect(normalizeBaseUrl('https://api.%example.com')).toBe('')
  })

  it('accepts a valid relative path that contains percent-encoded characters', () => {
    const warn = captureWarnings()
    expect(normalizeBaseUrl('/api%2Fv1')).toBe('/api%2Fv1')
    expect(warn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// §13  Boundary-length values
// ---------------------------------------------------------------------------

describe('§13 boundary-length values', () => {
  it('does not throw for an extremely long valid relative path', () => {
    const longPath = '/api/' + 'x'.repeat(9_994)
    expect(() => normalizeBaseUrl(longPath)).not.toThrow()
    // Result must be a string (either normalised path or '' fail-closed).
    expect(typeof normalizeBaseUrl(longPath)).toBe('string')
  })

  it('does not throw for an extremely long valid absolute URL', () => {
    const longUrl = 'https://api.credence.example/' + 'segment/'.repeat(500)
    expect(() => normalizeBaseUrl(longUrl)).not.toThrow()
    expect(typeof normalizeBaseUrl(longUrl)).toBe('string')
  })

  it('does not throw for 100 000 characters of whitespace (collapses to "")', () => {
    const value = ' '.repeat(100_000)
    expect(() => normalizeBaseUrl(value)).not.toThrow()
    expect(normalizeBaseUrl(value)).toBe('')
  })

  it('does not throw for a very long hostile javascript: URI', () => {
    captureWarnings()
    const hostile = 'javascript:' + 'A'.repeat(50_000)
    expect(() => normalizeBaseUrl(hostile)).not.toThrow()
    expect(normalizeBaseUrl(hostile)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// §14  Concurrency — no cross-contamination
// ---------------------------------------------------------------------------

describe('§14 concurrency — no cross-contamination', () => {
  /**
   * normalizeBaseUrl is a pure function with no mutable module state of its
   * own. Issuing calls concurrently (via Promise.all) must produce results
   * identical to sequential calls in the same order.
   */
  it('produces the same result whether called sequentially or concurrently', async () => {
    captureWarnings()

    const inputs = [
      '/api',
      '/api/v1/',
      'https://api.credence.example',
      '//evil.example',
      'javascript:alert(1)',
      '',
      '/api?token=secret',
      'http://localhost:3000/',
      null as unknown as string,
      undefined as unknown as string,
    ]

    const sequential = inputs.map((v) => normalizeBaseUrl(v))
    const concurrent = await Promise.all(
      inputs.map((v) => Promise.resolve(normalizeBaseUrl(v))),
    )

    expect(concurrent).toEqual(sequential)
  })

  it('returns independent results for different values called in a tight synchronous loop', () => {
    captureWarnings()

    const pairs: Array<[string, string]> = [
      ['/api', '/api'],
      ['/v2/', '/v2'],
      ['https://a.example', 'https://a.example'],
      ['//evil', ''],
      ['', ''],
    ]

    const results = pairs.map(([input]) => normalizeBaseUrl(input))

    pairs.forEach(([, expected], index) => {
      expect(results[index]).toBe(expected)
    })
  })
})

// ---------------------------------------------------------------------------
// §15  Warning behaviour — dev-mode emission and value-redaction
// ---------------------------------------------------------------------------

describe('§15 warning behaviour', () => {
  /**
   * The dev-mode warning is the only diagnostic surface for a bad
   * VITE_API_BASE_URL. These tests pin the observable contract:
   *
   *   a) A warning IS emitted for every rejected value in dev/test mode.
   *   b) The warning text NEVER contains the offending value (credential /
   *      token safety).
   *   c) No warning is emitted for accepted / same-origin values.
   *   d) Each rejection emits exactly one warning (no double-firing).
   */

  it('emits exactly one warning per rejected call', () => {
    const warn = captureWarnings()
    normalizeBaseUrl('//evil.example')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('emits one warning per rejected call for multiple distinct rejected inputs', () => {
    const warn = captureWarnings()
    const rejected = [
      '//evil.example',
      'javascript:alert(1)',
      '/api?secret=1',
      'ftp://files.example',
    ]
    rejected.forEach((v) => normalizeBaseUrl(v))
    expect(warn).toHaveBeenCalledTimes(rejected.length)
  })

  it('does NOT emit a warning for valid accepted values', () => {
    const warn = captureWarnings()
    const valid = ['/api', '/api/v1/', 'https://api.credence.example', '', '/', '  ']
    valid.forEach((v) => normalizeBaseUrl(v))
    expect(warn).not.toHaveBeenCalled()
  })

  it('warning message contains diagnostic guidance', () => {
    const warn = captureWarnings()
    normalizeBaseUrl('//evil.example')
    const message = String(warn.mock.calls[0][0])
    // Must contain the [api] namespace tag so operators can grep it.
    expect(message).toContain('[api]')
  })

  it('warning message mentions the same-origin fallback so the operator understands the impact', () => {
    const warn = captureWarnings()
    normalizeBaseUrl('//evil.example')
    const message = String(warn.mock.calls[0][0])
    expect(message.toLowerCase()).toMatch(/fall.?back|same.?origin/i)
  })

  it('warning message never contains the offending value for any rejected input', () => {
    const sensitiveInputs = [
      '//user:password123@evil.example',
      '/api?token=bearer_abc123',
      'https://api.credence.example?key=s3cr3t#frag',
    ]

    sensitiveInputs.forEach((offending) => {
      const warn = captureWarnings()
      normalizeBaseUrl(offending)
      if (warn.mock.calls.length > 0) {
        const message = String(warn.mock.calls[0][0])
        expect(message).not.toContain(offending)
      }
      vi.restoreAllMocks()
    })
  })
})
