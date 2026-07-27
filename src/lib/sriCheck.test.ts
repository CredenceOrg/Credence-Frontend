import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'
import { checkSri, isCrossOrigin, extractAttr } from './sriCheck'

// ---------------------------------------------------------------------------
// isCrossOrigin
// ---------------------------------------------------------------------------

describe('isCrossOrigin', () => {
  it('returns true for http:// URLs', () => {
    expect(isCrossOrigin('http://cdn.example.com/lib.js')).toBe(true)
  })

  it('returns true for https:// URLs', () => {
    expect(isCrossOrigin('https://cdn.jsdelivr.net/npm/react/umd/react.js')).toBe(true)
  })

  it('returns true for protocol-relative URLs', () => {
    expect(isCrossOrigin('//cdn.example.com/style.css')).toBe(true)
  })

  it('returns false for root-relative paths', () => {
    expect(isCrossOrigin('/assets/main.js')).toBe(false)
  })

  it('returns false for relative paths', () => {
    expect(isCrossOrigin('./src/main.tsx')).toBe(false)
  })

  it('returns false for bare filenames', () => {
    expect(isCrossOrigin('main.js')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// extractAttr
// ---------------------------------------------------------------------------

describe('extractAttr', () => {
  it('extracts double-quoted attribute value', () => {
    expect(extractAttr('src="https://cdn.example.com/a.js"', 'src')).toBe(
      'https://cdn.example.com/a.js'
    )
  })

  it('extracts single-quoted attribute value', () => {
    expect(extractAttr("src='https://cdn.example.com/a.js'", 'src')).toBe(
      'https://cdn.example.com/a.js'
    )
  })

  it('returns empty string for boolean attribute', () => {
    expect(extractAttr('crossorigin async', 'crossorigin')).toBe('')
  })

  it('returns null for absent attribute', () => {
    expect(extractAttr('src="https://cdn.example.com/a.js"', 'integrity')).toBeNull()
  })

  it('extracts integrity value containing "="', () => {
    const hash = 'sha384-abc123=='
    expect(extractAttr(`integrity="${hash}"`, 'integrity')).toBe(hash)
  })
})

// ---------------------------------------------------------------------------
// checkSri — negative tests (demonstrate the vulnerability)
// ---------------------------------------------------------------------------

describe('checkSri — NEGATIVE: CDN asset without SRI', () => {
  /**
   * This is the negative test required by the acceptance criteria.
   *
   * It represents the state BEFORE the fix: a <script> tag loading from a CDN
   * with no integrity or crossorigin attributes.  The check must report a
   * violation so that CI would block a PR that introduces such a tag.
   *
   * Threat: if this check were absent, a compromised CDN could silently replace
   * the bundled script with arbitrary code (key-logger, phishing overlay, etc.)
   * and the browser would execute it with no warning.
   */
  it('fails when a <script> loads from a CDN with no integrity and no crossorigin', () => {
    const html = `
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/some-lib@1.0/dist/lib.min.js"></script>
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations).toHaveLength(1)
      expect(result.violations[0].kind).toBe('missing-both')
      expect(result.violations[0].asset.tag).toBe('script')
      expect(result.violations[0].asset.url).toBe(
        'https://cdn.jsdelivr.net/npm/some-lib@1.0/dist/lib.min.js'
      )
    }
  })

  it('fails when a <link> stylesheet loads from a CDN with no integrity and no crossorigin', () => {
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations[0].kind).toBe('missing-both')
      expect(result.violations[0].asset.tag).toBe('link')
    }
  })

  it('fails when integrity is present but crossorigin is missing', () => {
    const html = `
      <html>
        <head>
          <script
            src="https://cdn.example.com/lib.js"
            integrity="sha384-abc123"
          ></script>
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations[0].kind).toBe('missing-crossorigin')
    }
  })

  it('fails when crossorigin is present but integrity is missing', () => {
    const html = `
      <html>
        <head>
          <script
            src="https://cdn.example.com/lib.js"
            crossorigin="anonymous"
          ></script>
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations[0].kind).toBe('missing-integrity')
    }
  })

  it('reports all violating assets, not just the first', () => {
    const html = `
      <html>
        <head>
          <script src="https://cdn.a.com/a.js"></script>
          <link href="https://cdn.b.com/b.css" rel="stylesheet">
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations).toHaveLength(2)
    }
  })

  it('includes a human-readable message in each violation', () => {
    const html = `<script src="https://cdn.example.com/bad.js"></script>`
    const result = checkSri(html)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.violations[0].message).toMatch(/integrity/)
      expect(result.violations[0].message).toMatch(/crossorigin/)
    }
  })
})

// ---------------------------------------------------------------------------
// checkSri — positive tests (fix in place)
// ---------------------------------------------------------------------------

describe('checkSri — POSITIVE: compliant CDN assets pass', () => {
  it('passes when a <script> has both integrity and crossorigin', () => {
    const html = `
      <html>
        <head>
          <script
            src="https://cdn.jsdelivr.net/npm/some-lib@1.0/dist/lib.min.js"
            integrity="sha384-abc123=="
            crossorigin="anonymous"
          ></script>
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.checkedAssets).toHaveLength(1)
      expect(result.checkedAssets[0].tag).toBe('script')
    }
  })

  it('passes when a <link> has both integrity and crossorigin', () => {
    const html = `
      <html>
        <head>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter"
            integrity="sha384-xyz789=="
            crossorigin="anonymous"
          >
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(true)
  })

  it('skips same-origin relative paths — no SRI needed', () => {
    const html = `
      <html>
        <head>
          <script type="module" src="/src/main.tsx"></script>
          <link rel="stylesheet" href="/assets/main.css">
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Relative assets are not counted as external
      expect(result.checkedAssets).toHaveLength(0)
    }
  })

  it('skips inline <script> tags with no src', () => {
    const html = `<script>console.log('inline')</script>`
    const result = checkSri(html)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.checkedAssets).toHaveLength(0)
    }
  })

  it('passes when a CDN asset matches the supplied ownOrigin', () => {
    const html = `
      <html>
        <head>
          <script src="https://app.credence.org/assets/main.js"></script>
        </head>
      </html>
    `
    // Treat the app's own CDN origin as same-origin → no SRI needed
    const result = checkSri(html, 'https://app.credence.org')
    expect(result.ok).toBe(true)
  })

  it('passes when multiple compliant CDN assets are present', () => {
    const html = `
      <html>
        <head>
          <script
            src="https://cdn.a.com/a.js"
            integrity="sha384-aaa=="
            crossorigin="anonymous"
          ></script>
          <link
            rel="stylesheet"
            href="https://cdn.b.com/b.css"
            integrity="sha384-bbb=="
            crossorigin="anonymous"
          >
        </head>
      </html>
    `
    const result = checkSri(html)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.checkedAssets).toHaveLength(2)
    }
  })
})

// ---------------------------------------------------------------------------
// Regression: current index.html must pass the check
// ---------------------------------------------------------------------------

describe('checkSri — regression: project index.html', () => {
  /**
   * This test reads the actual index.html at the project root and asserts it
   * contains no SRI violations.  It acts as a continuous regression guard: if
   * a future PR adds a CDN tag without an SRI hash this test will fail in CI.
   */
  it('index.html contains no cross-origin assets without SRI hashes', () => {
    const htmlPath = resolve(__dirname, '../../index.html')
    const html = readFileSync(htmlPath, 'utf-8')
    const result = checkSri(html)

    if (!result.ok) {
      const msgs = result.violations.map((v) => `  • ${v.message}`).join('\n')
      throw new Error(
        `index.html has ${result.violations.length} SRI violation(s):\n${msgs}\n\n` +
          `Add integrity="sha384-…" and crossorigin="anonymous" to each listed tag.`
      )
    }

    expect(result.ok).toBe(true)
  })
})
