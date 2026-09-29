import { readFileSync, readdirSync } from 'fs'
import { resolve, join } from 'path'
import { describe, it, expect } from 'vitest'
import { checkNoFontCdn, KNOWN_FONT_CDN_HOSTS } from './fontCdnCheck'

// ---------------------------------------------------------------------------
// checkNoFontCdn — negative tests (demonstrate the check catches a CDN font)
// ---------------------------------------------------------------------------

describe('checkNoFontCdn — NEGATIVE: font served from a CDN', () => {
  /**
   * These are the negative tests required by the acceptance criteria: they
   * fail against the check's own logic if the CDN-host list or the URL
   * matcher regresses, and they demonstrate the exact violation CI is meant
   * to block.
   *
   * Threat: without this check, a future PR could add a Google Fonts <link>
   * (or an @font-face pointing at one) and nothing would flag that every
   * visitor's IP and User-Agent are now sent to a third party on every load.
   */
  it('fails on a <link> that loads a Google Fonts stylesheet', () => {
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
        </head>
      </html>
    `
    const result = checkNoFontCdn(html)
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].host).toBe('fonts.googleapis.com')
  })

  it('fails on an @font-face referencing fonts.gstatic.com', () => {
    const css = `
      @font-face {
        font-family: 'Inter';
        src: url(https://fonts.gstatic.com/s/inter/v12/xxx.woff2) format('woff2');
      }
    `
    const result = checkNoFontCdn(css)
    expect(result.ok).toBe(false)
    expect(result.violations[0].host).toBe('fonts.gstatic.com')
  })

  it('fails on a CSS @import of a font CDN stylesheet', () => {
    const css = `@import url('https://fonts.bunny.net/css?family=inter');`
    const result = checkNoFontCdn(css)
    expect(result.ok).toBe(false)
    expect(result.violations[0].host).toBe('fonts.bunny.net')
  })

  it('fails on Adobe Fonts / Typekit', () => {
    const html = `<link rel="stylesheet" href="https://use.typekit.net/abc1234.css">`
    const result = checkNoFontCdn(html)
    expect(result.ok).toBe(false)
    expect(result.violations[0].host).toBe('use.typekit.net')
  })

  it('reports every violating reference, not just the first', () => {
    const html = `
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
      <link rel="stylesheet" href="https://use.typekit.net/abc1234.css">
    `
    const result = checkNoFontCdn(html)
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(2)
  })

  it('includes an actionable, human-readable message', () => {
    const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">`
    const result = checkNoFontCdn(html)
    expect(result.violations[0].message).toMatch(/self-host/i)
  })
})

// ---------------------------------------------------------------------------
// checkNoFontCdn — positive tests (self-hosted fonts pass)
// ---------------------------------------------------------------------------

describe('checkNoFontCdn — POSITIVE: self-hosted / system fonts pass', () => {
  it('passes for a system-font stack with no url() at all', () => {
    const css = `
      :root {
        --font-family-base: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
    `
    const result = checkNoFontCdn(css)
    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('passes for an @font-face served from the same origin', () => {
    const css = `
      @font-face {
        font-family: 'Inter';
        src: url(/fonts/inter.woff2) format('woff2');
      }
    `
    const result = checkNoFontCdn(css)
    expect(result.ok).toBe(true)
  })

  it('passes for an unrelated third-party asset (not a font host)', () => {
    const html = `<script src="https://cdn.jsdelivr.net/npm/some-lib@1.0/dist/lib.min.js"></script>`
    const result = checkNoFontCdn(html)
    expect(result.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Regression: the actual project source contains no font-CDN references
// ---------------------------------------------------------------------------

describe('checkNoFontCdn — regression: project source', () => {
  /**
   * Scans the real entry HTML and every stylesheet under src/ so that a
   * future PR reintroducing a font-CDN reference fails CI immediately,
   * rather than relying on manual review to catch it.
   */
  function readAllCssFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
      .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf-8'))
  }

  it('index.html contains no font-CDN references', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8')
    const result = checkNoFontCdn(html)

    if (!result.ok) {
      const msgs = result.violations.map((v) => `  • ${v.message}`).join('\n')
      throw new Error(`index.html loads fonts from a CDN:\n${msgs}`)
    }
    expect(result.ok).toBe(true)
  })

  it('no stylesheet under src/ contains a font-CDN reference', () => {
    const cssSources = readAllCssFiles(resolve(__dirname, '..'))
    expect(cssSources.length).toBeGreaterThan(0)

    const violations = cssSources.flatMap((css) => checkNoFontCdn(css).violations)

    if (violations.length > 0) {
      const msgs = violations.map((v) => `  • ${v.message}`).join('\n')
      throw new Error(`Found font-CDN reference(s) in src/**/*.css:\n${msgs}`)
    }
    expect(violations).toHaveLength(0)
  })

  it('documents the full list of hosts CI treats as font CDNs', () => {
    // Guard against an accidental empty list silently turning this whole
    // check into a no-op.
    expect(KNOWN_FONT_CDN_HOSTS.length).toBeGreaterThan(0)
  })
})
