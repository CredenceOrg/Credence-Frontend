import { describe, it, expect } from 'vitest'
import { CSP, CSP_DIRECTIVES } from './security'

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
