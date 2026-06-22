import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('LINKS resolution precedence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  // Helper to set env variables
  const setEnv = (key: string, value: string | undefined) => {
    if (value === undefined) {
      vi.stubEnv(key, undefined as any)
    } else {
      vi.stubEnv(key, value)
    }
  }

  // Helper to get LINKS with fresh module import
  const getLinks = async () => {
    return (await vi.importActual('./links') as typeof import('./links')).LINKS
  }

  // Docs Link Tests
  it("should use VITE_DOCS_URL if present", async () => {
    setEnv("VITE_DOCS_URL", "/docs-url")
    setEnv("VITE_DOCS", "/docs-legacy")
    expect((await getLinks()).docs).toBe("/docs-url")
  })

  it("should use VITE_DOCS if VITE_DOCS_URL is absent", async () => {
    setEnv("VITE_DOCS_URL", undefined)
    setEnv("VITE_DOCS", "/docs-legacy")
    expect((await getLinks()).docs).toBe("/docs-legacy")
  })

  it("should use default docs link if both envs are absent", async () => {
    setEnv("VITE_DOCS_URL", undefined)
    setEnv("VITE_DOCS", undefined)
    expect((await getLinks()).docs).toBe("/docs")
  })

  // Terms Link Tests
  it("should use VITE_TERMS_URL if present", async () => {
    setEnv("VITE_TERMS_URL", "/terms-url")
    setEnv("VITE_TERMS", "/terms-legacy")
    expect((await getLinks()).terms).toBe("/terms-url")
  })

  it("should use VITE_TERMS if VITE_TERMS_URL is absent", async () => {
    setEnv("VITE_TERMS_URL", undefined)
    setEnv("VITE_TERMS", "/terms-legacy")
    expect((await getLinks()).terms).toBe("/terms-legacy")
  })

  it("should use default terms link if both envs are absent", async () => {
    setEnv("VITE_TERMS_URL", undefined)
    setEnv("VITE_TERMS", undefined)
    expect((await getLinks()).terms).toBe("/legal/terms")
  })

  // Privacy Link Tests
  it("should use VITE_PRIVACY_URL if present", async () => {
    setEnv("VITE_PRIVACY_URL", "/privacy-url")
    setEnv("VITE_PRIVACY", "/privacy-legacy")
    expect((await getLinks()).privacy).toBe("/privacy-url")
  })

  it("should use VITE_PRIVACY if VITE_PRIVACY_URL is absent", async () => {
    setEnv("VITE_PRIVACY_URL", undefined)
    setEnv("VITE_PRIVACY", "/privacy-legacy")
    expect((await getLinks()).privacy).toBe("/privacy-legacy")
  })

  it("should use default privacy link if both envs are absent", async () => {
    setEnv("VITE_PRIVACY_URL", undefined)
    setEnv("VITE_PRIVACY", undefined)
    expect((await getLinks()).privacy).toBe("/legal/privacy")
  })

  // Edge Cases
  it("should fallback when primary env is empty string", async () => {
    setEnv("VITE_DOCS_URL", "")
    setEnv("VITE_DOCS", "/docs-legacy")
    expect((await getLinks()).docs).toBe("/docs-legacy")
  })

  it("should fallback when primary env is whitespace", async () => {
    setEnv("VITE_DOCS_URL", "   ")
    setEnv("VITE_DOCS", "/docs-legacy")
    expect((await getLinks()).docs).toBe("/docs-legacy")
  })

  it("should fallback when legacy env is empty string", async () => {
    setEnv("VITE_DOCS_URL", undefined)
    setEnv("VITE_DOCS", "")
    expect((await getLinks()).docs).toBe("/docs")
  })

  it("should fallback when legacy env is whitespace", async () => {
    setEnv("VITE_DOCS_URL", undefined)
    setEnv("VITE_DOCS", " \t ")
    expect((await getLinks()).docs).toBe("/docs")
  })

  it("should use primary even if legacy is invalid", async () => {
    setEnv("VITE_DOCS_URL", "/docs-url")
    setEnv("VITE_DOCS", " ")
    expect((await getLinks()).docs).toBe("/docs-url")
  })

  it("should use legacy even if primary is invalid", async () => {
    setEnv("VITE_DOCS_URL", " ")
    setEnv("VITE_DOCS", "/docs-legacy")
    expect((await getLinks()).docs).toBe("/docs-legacy")
  })

  it("should handle all invalid values and fallback to default", async () => {
    setEnv("VITE_DOCS_URL", " \t ")
    setEnv("VITE_DOCS", "")
    expect((await getLinks()).docs).toBe("/docs")
  })
})


