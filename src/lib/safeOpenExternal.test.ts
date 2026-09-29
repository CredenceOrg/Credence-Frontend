import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { safeOpenExternal } from './safeOpenExternal'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture every window.open call without actually opening a tab. */
function mockWindowOpen() {
  const spy = vi.fn().mockReturnValue({} as WindowProxy)
  vi.stubGlobal('open', spy)
  return spy
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('safeOpenExternal', () => {
  let openSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    openSpy = mockWindowOpen()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // -------------------------------------------------------------------------
  // Happy path — allowed protocols
  // -------------------------------------------------------------------------

  describe('allowed protocols', () => {
    it('opens an https URL and returns ok:true', () => {
      const result = safeOpenExternal('https://stellar.expert/explorer/public/tx/abc')
      expect(result.ok).toBe(true)
      expect(openSpy).toHaveBeenCalledOnce()
    })

    it('opens an http URL', () => {
      const result = safeOpenExternal('http://example.com')
      expect(result.ok).toBe(true)
      expect(openSpy).toHaveBeenCalledOnce()
    })

    it('opens a mailto URL', () => {
      const result = safeOpenExternal('mailto:support@credence.org')
      expect(result.ok).toBe(true)
      expect(openSpy).toHaveBeenCalledOnce()
    })

    it('passes the URL as the first argument to window.open', () => {
      const url = 'https://example.com/path?q=1'
      safeOpenExternal(url)
      expect(openSpy).toHaveBeenCalledWith(url, '_blank', expect.any(String))
    })

    it('always opens in _blank target', () => {
      safeOpenExternal('https://example.com')
      const [, target] = openSpy.mock.calls[0]
      expect(target).toBe('_blank')
    })
  })

  // -------------------------------------------------------------------------
  // Security: noopener / noreferrer enforcement
  // -------------------------------------------------------------------------

  describe('noopener and noreferrer enforcement', () => {
    it('injects noopener and noreferrer when no features are supplied', () => {
      safeOpenExternal('https://example.com')
      const [, , features] = openSpy.mock.calls[0]
      expect(features).toContain('noopener')
      expect(features).toContain('noreferrer')
    })

    it('injects noopener and noreferrer when the caller omits them', () => {
      safeOpenExternal('https://example.com', 'width=800,height=600')
      const [, , features] = openSpy.mock.calls[0]
      expect(features).toContain('noopener')
      expect(features).toContain('noreferrer')
    })

    it('does not duplicate noopener when caller already includes it', () => {
      safeOpenExternal('https://example.com', 'noopener')
      const [, , features] = openSpy.mock.calls[0]
      const count = features.split(',').filter((f: string) => f === 'noopener').length
      expect(count).toBe(1)
    })

    it('does not duplicate noreferrer when caller already includes it', () => {
      safeOpenExternal('https://example.com', 'noreferrer')
      const [, , features] = openSpy.mock.calls[0]
      const count = features.split(',').filter((f: string) => f === 'noreferrer').length
      expect(count).toBe(1)
    })

    it('preserves extra caller-supplied feature tokens alongside the security tokens', () => {
      safeOpenExternal('https://example.com', 'width=800,height=600')
      const [, , features] = openSpy.mock.calls[0]
      expect(features).toContain('width=800')
      expect(features).toContain('height=600')
    })
  })

  // -------------------------------------------------------------------------
  // Negative path — BLOCKED protocols (these tests fail without the fix)
  // -------------------------------------------------------------------------

  describe('blocked protocols — negative tests', () => {
    /**
     * NEGATIVE TEST: javascript: URI
     *
     * Without the protocol allowlist, `window.open('javascript:alert(1)')` would
     * execute arbitrary script in the opener's context, enabling credential theft
     * or DOM manipulation.  This test was written RED (failing) before the fix
     * and PASSES after the allowlist is in place.
     */
    it('NEGATIVE — blocks javascript: URI and does NOT call window.open', () => {
      const result = safeOpenExternal('javascript:alert(1)')
      expect(result.ok).toBe(false)
      expect(openSpy).not.toHaveBeenCalled()
    })

    it('returns blocked_protocol error kind for javascript:', () => {
      const result = safeOpenExternal('javascript:void(0)')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('blocked_protocol')
        expect(result.error.protocol).toBe('javascript:')
      }
    })

    it('NEGATIVE — blocks data: URI and does NOT call window.open', () => {
      const result = safeOpenExternal('data:text/html,<script>alert(1)</script>')
      expect(result.ok).toBe(false)
      expect(openSpy).not.toHaveBeenCalled()
    })

    it('returns blocked_protocol error kind for data:', () => {
      const result = safeOpenExternal('data:text/html,hello')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('blocked_protocol')
        expect(result.error.protocol).toBe('data:')
      }
    })

    it('NEGATIVE — blocks vbscript: URI', () => {
      const result = safeOpenExternal('vbscript:msgbox(1)')
      expect(result.ok).toBe(false)
      expect(openSpy).not.toHaveBeenCalled()
    })

    it('NEGATIVE — blocks blob: URI', () => {
      const result = safeOpenExternal('blob:https://example.com/fake')
      expect(result.ok).toBe(false)
      expect(openSpy).not.toHaveBeenCalled()
    })

    it('includes the original URL in the error object', () => {
      const url = 'javascript:alert(document.cookie)'
      const result = safeOpenExternal(url)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.url).toBe(url)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Invalid / malformed inputs
  // -------------------------------------------------------------------------

  describe('invalid or malformed inputs', () => {
    it('returns invalid_url for a non-URL string', () => {
      const result = safeOpenExternal('not a url at all!!')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_url')
      }
      expect(openSpy).not.toHaveBeenCalled()
    })

    it('returns invalid_url for an empty string', () => {
      const result = safeOpenExternal('')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.kind).toBe('invalid_url')
      }
      expect(openSpy).not.toHaveBeenCalled()
    })

    it('includes the invalid string in the error object', () => {
      const url = 'not-a-url'
      const result = safeOpenExternal(url)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.url).toBe(url)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------------

  describe('return value', () => {
    it('surfaces the WindowProxy handle on success', () => {
      const fakeHandle = { focus: vi.fn() } as unknown as WindowProxy
      openSpy.mockReturnValue(fakeHandle)
      const result = safeOpenExternal('https://example.com')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.handle).toBe(fakeHandle)
      }
    })

    it('surfaces null handle when window.open returns null (popup blocked)', () => {
      openSpy.mockReturnValue(null)
      const result = safeOpenExternal('https://example.com')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.handle).toBeNull()
      }
    })
  })
})
