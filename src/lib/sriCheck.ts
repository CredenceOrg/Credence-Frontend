/**
 * Subresource Integrity (SRI) validation for HTML entry points.
 *
 * Threat model
 * ------------
 * If a `<script src>` or `<link rel="stylesheet" href>` (or similar preload)
 * loads a resource from a CDN or any cross-origin host, a compromised CDN can
 * silently swap that resource for malicious code.  The browser will execute or
 * apply whatever bytes it receives with no indication that they differ from the
 * original.  For a wallet-adjacent application this means an attacker could:
 *   - Exfiltrate private keys or seed phrases entered by the user.
 *   - Replace the wallet-connect UI with a phishing variant.
 *   - Inject transaction-manipulation logic that operates silently.
 *
 * SRI (`integrity="sha384-…" crossorigin="anonymous"`) instructs the browser
 * to hash the received bytes and abort loading if the digest does not match.
 * The `crossorigin` attribute is required alongside `integrity` so the browser
 * performs the CORS request needed to inspect response bytes.
 *
 * This module provides a pure function that can be called from unit tests and
 * from a build-time check to ensure no CDN asset ever ships without an SRI hash.
 */

/** A `<script>` or `<link>` tag that loads from a cross-origin URL. */
export interface ExternalAsset {
  /** The element tag name, lower-cased. */
  tag: 'script' | 'link'
  /** The URL value of `src` (script) or `href` (link). */
  url: string
}

/** Returned when a cross-origin asset is missing `integrity` or `crossorigin`. */
export interface SriViolation {
  kind: 'missing-integrity' | 'missing-crossorigin' | 'missing-both'
  asset: ExternalAsset
  /** Human-readable description for display in test output / CI logs. */
  message: string
}

/** Successful result — no violations found. */
export interface SriOk {
  ok: true
  checkedAssets: ExternalAsset[]
}

/** Failed result — one or more SRI violations detected. */
export interface SriError {
  ok: false
  violations: SriViolation[]
}

export type SriResult = SriOk | SriError

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `url` is cross-origin relative to the application's own
 * origin (i.e. starts with `http://`, `https://`, or `//`).
 */
export function isCrossOrigin(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith('//')
}

/**
 * Extract the value of an attribute from a raw HTML tag string.
 * Returns `null` if the attribute is absent.
 *
 * Handles both `attr="value"` and `attr='value'` and bare `attr` (boolean).
 */
export function extractAttr(tagHtml: string, attr: string): string | null {
  // Boolean attribute (e.g. `crossorigin` with no value)
  const boolRe = new RegExp(`(?:^|\\s)${attr}(?=\\s|>|/)`, 'i')
  // Valued attribute: attr="…" or attr='…'
  const valuedRe = new RegExp(`(?:^|\\s)${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i')

  const valued = valuedRe.exec(tagHtml)
  if (valued) {
    return valued[1] ?? valued[2] ?? ''
  }

  if (boolRe.test(tagHtml)) {
    return '' // present but no value
  }

  return null
}

// ---------------------------------------------------------------------------
// Core validator
// ---------------------------------------------------------------------------

/**
 * Parse `htmlSource` and return an `SriResult`.
 *
 * - Scans all `<script src="…">` and `<link href="…">` tags (including
 *   `<link rel="preload">`, `<link rel="modulepreload">`, etc.).
 * - Tags whose URL is same-origin (relative paths, or matching the supplied
 *   `ownOrigin`) are skipped — SRI is only meaningful for cross-origin loads.
 * - Any cross-origin tag missing `integrity`, `crossorigin`, or both triggers
 *   an `SriViolation`.
 *
 * @param htmlSource  Raw HTML string (e.g. the contents of `index.html`).
 * @param ownOrigin   Optional origin to treat as same-origin (e.g. `https://app.example.com`).
 *                    Defaults to `''` (only relative paths are considered same-origin).
 */
export function checkSri(htmlSource: string, ownOrigin = ''): SriResult {
  const violations: SriViolation[] = []
  const checkedAssets: ExternalAsset[] = []

  // Match all <script …> and <link …> opening tags (self-closing or not).
  // We deliberately use a simple regex over a full HTML parser to keep this
  // dependency-free; the pattern is sufficient for well-formed entry HTML.
  const tagRe = /<(script|link)(\s[^>]*)?>/gi
  let match: RegExpExecArray | null

  while ((match = tagRe.exec(htmlSource)) !== null) {
    const tag = match[1].toLowerCase() as 'script' | 'link'
    const attrs = match[2] ?? ''

    // Determine the resource URL
    let url: string | null = null
    if (tag === 'script') {
      url = extractAttr(attrs, 'src')
    } else {
      url = extractAttr(attrs, 'href')
    }

    if (!url) continue // inline script or link without href — skip

    // Same-origin check
    const isExternal =
      isCrossOrigin(url) && (ownOrigin === '' || !url.startsWith(ownOrigin))

    if (!isExternal) continue // relative / same-origin — SRI not required

    const asset: ExternalAsset = { tag, url }
    checkedAssets.push(asset)

    const hasIntegrity = extractAttr(attrs, 'integrity') !== null
    const hasCrossorigin = extractAttr(attrs, 'crossorigin') !== null

    if (!hasIntegrity && !hasCrossorigin) {
      violations.push({
        kind: 'missing-both',
        asset,
        message:
          `<${tag}> loading "${url}" is missing both \`integrity\` and \`crossorigin\` attributes. ` +
          `Add an SRI hash (integrity="sha384-…") and crossorigin="anonymous".`,
      })
    } else if (!hasIntegrity) {
      violations.push({
        kind: 'missing-integrity',
        asset,
        message:
          `<${tag}> loading "${url}" has \`crossorigin\` but is missing the \`integrity\` attribute. ` +
          `Add an SRI hash (integrity="sha384-…").`,
      })
    } else if (!hasCrossorigin) {
      violations.push({
        kind: 'missing-crossorigin',
        asset,
        message:
          `<${tag}> loading "${url}" has \`integrity\` but is missing \`crossorigin="anonymous"\`. ` +
          `Without it the browser cannot verify the hash on a cross-origin response.`,
      })
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations }
  }

  return { ok: true, checkedAssets }
}
