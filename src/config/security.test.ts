import { describe, it, expect } from 'vitest'
import { CSP, CSP_DIRECTIVES } from './security'

describe('Content Security Policy', () => {
  it('includes script-src with self only (no unsafe-inline or unsafe-eval)', () => {
    const scriptMatch = CSP.match(/script-src\s+(.+?)(?:;|$)/)
    expect(scriptMatch).not.toBeNull()
    const scriptValue = scriptMatch![1]
    expect(scriptValue.trim()).toBe("'self'")
    expect(scriptValue).not.toContain("'unsafe-inline'")
    expect(scriptValue).not.toContain("'unsafe-eval'")
  })

  it('includes style-src with self and unsafe-inline (required by Vite/React)', () => {
    const styleMatch = CSP.match(/style-src\s+(.+?)(?:;|$)/)
    expect(styleMatch).not.toBeNull()
    const styleValue = styleMatch![1]
    expect(styleValue.trim()).toBe("'self' 'unsafe-inline'")
  })

  it('restricts form-action to self', () => {
    expect(CSP).toContain("form-action 'self'")
  })

  it('restricts frame-ancestors to none', () => {
    expect(CSP).toContain("frame-ancestors 'none'")
  })

  it('does not allow unsafe-eval in any directive', () => {
    expect(CSP).not.toContain("'unsafe-eval'")
  })

  it('does not allow unsafe-inline in script-src', () => {
    const scriptSrc = CSP_DIRECTIVES.scriptSrc
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })
})
