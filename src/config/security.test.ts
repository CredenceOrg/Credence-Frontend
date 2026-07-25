import { describe, it, expect } from 'vitest'
import { CSP, CSP_DIRECTIVES, validateCSP, CSPValidationError } from './security'

describe('CSP string', () => {
  it("contains script-src 'self'", () => {
    expect(CSP).toContain("script-src 'self'")
  })

  it("does not allow 'unsafe-eval' in script-src", () => {
    const scriptSrcMatch = CSP.match(/script-src([^;]*)/)
    expect(scriptSrcMatch).not.toBeNull()
    expect(scriptSrcMatch![1]).not.toContain("'unsafe-eval'")
  })

  it("does not allow 'unsafe-inline' in script-src", () => {
    const scriptSrcMatch = CSP.match(/script-src([^;]*)/)
    expect(scriptSrcMatch).not.toBeNull()
    expect(scriptSrcMatch![1]).not.toContain("'unsafe-inline'")
  })

  it("contains style-src 'self' 'unsafe-inline'", () => {
    expect(CSP).toContain("style-src 'self' 'unsafe-inline'")
  })

  it("contains frame-ancestors 'none'", () => {
    expect(CSP).toContain("frame-ancestors 'none'")
  })

  it("contains base-uri 'self'", () => {
    expect(CSP).toContain("base-uri 'self'")
  })

  it("contains form-action 'self'", () => {
    expect(CSP).toContain("form-action 'self'")
  })

  it('has no dangling semicolons or empty directives', () => {
    // No double semicolons and no leading/trailing semicolons
    expect(CSP).not.toMatch(/;;/)
    expect(CSP.trim()).not.toMatch(/^;/)
    expect(CSP.trim()).not.toMatch(/;$/)
  })

  it('contains default-src', () => {
    expect(CSP).toContain('default-src')
  })
})

describe('CSP_DIRECTIVES object', () => {
  it("scriptSrc contains only 'self'", () => {
    expect(CSP_DIRECTIVES.scriptSrc).toEqual(["'self'"])
  })

  it("frameAncestors is 'none'", () => {
    expect(CSP_DIRECTIVES.frameAncestors).toEqual(["'none'"])
  })

  it('styleSrc allows unsafe-inline (required for Vite CSS modules)', () => {
    expect(CSP_DIRECTIVES.styleSrc).toContain("'unsafe-inline'")
  })
})

describe('validateCSP', () => {
  describe('negative tests - should fail validation', () => {
    it('returns error when CSP header is missing', () => {
      const result = validateCSP(undefined)
      expect(result).toBeInstanceOf(CSPValidationError)
      expect(result?.type).toBe('MISSING_HEADER')
      expect(result?.message).toBe('Content-Security-Policy header is missing')
    })

    it('returns error when CSP header is null', () => {
      const result = validateCSP(null)
      expect(result).toBeInstanceOf(CSPValidationError)
      expect(result?.type).toBe('MISSING_HEADER')
    })

    it('returns error when CSP header is empty string', () => {
      const result = validateCSP('')
      expect(result).toBeInstanceOf(CSPValidationError)
      expect(result?.type).toBe('MISSING_HEADER')
    })

    it('returns error when script-src contains unsafe-inline', () => {
      const csp = "script-src 'self' 'unsafe-inline'; style-src 'self'"
      const result = validateCSP(csp)
      expect(result).toBeInstanceOf(CSPValidationError)
      expect(result?.type).toBe('UNSAFE_INLINE_SCRIPT')
      expect(result?.message).toBe("script-src must not contain 'unsafe-inline'")
    })

    it('returns error when style-src contains unsafe-inline without nonce', () => {
      const csp = "script-src 'self'; style-src 'self' 'unsafe-inline'"
      const result = validateCSP(csp)
      expect(result).toBeInstanceOf(CSPValidationError)
      expect(result?.type).toBe('UNSAFE_INLINE_STYLE_WITHOUT_NONCE')
      expect(result?.message).toBe("style-src 'unsafe-inline' is only allowed with nonce")
    })

    it('returns error when other directive contains unsafe-inline', () => {
      const csp = "script-src 'self'; default-src 'self' 'unsafe-inline'"
      const result = validateCSP(csp)
      expect(result).toBeInstanceOf(CSPValidationError)
      expect(result?.type).toBe('UNSAFE_INLINE_OTHER')
      expect(result?.message).toContain('default-src')
    })

    it('is case-insensitive when detecting unsafe-inline', () => {
      const csp = "script-src 'self' 'UNSAFE-INLINE'"
      const result = validateCSP(csp)
      expect(result).toBeInstanceOf(CSPValidationError)
      expect(result?.type).toBe('UNSAFE_INLINE_SCRIPT')
    })
  })

  describe('positive tests - should pass validation', () => {
    it('returns null for valid CSP without unsafe-inline', () => {
      const csp = "script-src 'self'; style-src 'self'"
      const result = validateCSP(csp)
      expect(result).toBeNull()
    })

    it('returns null for style-src with nonce and unsafe-inline', () => {
      const csp = "script-src 'self'; style-src 'self' 'unsafe-inline' 'nonce-abc123'"
      const result = validateCSP(csp)
      expect(result).toBeNull()
    })

    it('returns null for style-src with nonce only (no unsafe-inline)', () => {
      const csp = "script-src 'self'; style-src 'self' 'nonce-abc123'"
      const result = validateCSP(csp)
      expect(result).toBeNull()
    })

    it('returns null for complex valid CSP', () => {
      const csp =
        "default-src 'self'; script-src 'self'; style-src 'self' 'nonce-abc123'; img-src 'self' data:; connect-src 'self'"
      const result = validateCSP(csp)
      expect(result).toBeNull()
    })

    it('handles multiple directives correctly', () => {
      const csp =
        "default-src 'self'; script-src 'self'; style-src 'self' 'nonce-xyz'; img-src 'self' data:; font-src 'self'; connect-src 'self'"
      const result = validateCSP(csp)
      expect(result).toBeNull()
    })

    it('handles extra whitespace gracefully', () => {
      const csp = "  script-src  'self'  ;  style-src  'self'  'nonce-abc'  "
      const result = validateCSP(csp)
      expect(result).toBeNull()
    })
  })
})
