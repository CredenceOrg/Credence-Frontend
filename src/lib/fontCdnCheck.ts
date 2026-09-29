/**
 * Font-CDN dependency guard.
 *
 * Threat model
 * ------------
 * Serving fonts from a third-party host (Google Fonts, Adobe Fonts/Typekit,
 * Bunny Fonts, cdnfonts.com, …) means every page load sends the visitor's IP
 * address, User-Agent, and Referer header to that third party before a single
 * glyph renders — a passive tracking channel that exists independent of any
 * script on the page and that a wallet-adjacent app should not open. This is
 * true even if the tag also carries a valid SRI hash: `integrity` only makes
 * the browser reject *tampered* bytes after the request has already leaked to
 * the CDN, it does not stop the request itself (see sriCheck.ts, which
 * defends against a different threat — a compromised CDN serving malicious
 * bytes — and is complementary to this check, not a substitute for it).
 *
 * A font CDN is also an availability dependency: corporate proxies,
 * ad-blockers, and region-blocks routinely block font-CDN hosts, degrading to
 * invisible (FOIT) or unstyled text, and it silently grows the set of origins
 * `font-src` must trust in the CSP (src/config/security.ts).
 *
 * This module scans HTML/CSS source for `<link>`, `@import`, and `@font-face`
 * references to known font-CDN hosts so that CI catches a future PR that
 * reintroduces one, rather than relying on someone remembering that fonts
 * must stay self-hosted.
 */

/** Hostnames of well-known third-party font delivery services. */
export const KNOWN_FONT_CDN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'p.typekit.net',
  'fonts.bunny.net',
  'cdnfonts.com',
  'fast.fonts.net',
] as const

export interface FontCdnViolation {
  /** The font-CDN host that was matched. */
  host: string
  /** The full URL the reference was found in. */
  url: string
  /** Human-readable description for display in test output / CI logs. */
  message: string
}

export interface FontCdnResult {
  ok: boolean
  violations: FontCdnViolation[]
}

// Matches CSS `url(...)` (bare, single- or double-quoted) and HTML
// `href="…"` / `src="…"` attribute values.
const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)|(?:href|src)\s*=\s*(['"])([^'"]+)\3/gi

/**
 * Scan `source` (HTML or CSS text) for references to a known font-CDN host.
 *
 * @param source  Raw HTML or CSS source.
 */
export function checkNoFontCdn(source: string): FontCdnResult {
  const violations: FontCdnViolation[] = []

  let match: RegExpExecArray | null
  while ((match = URL_RE.exec(source)) !== null) {
    const url = match[2] ?? match[4]
    if (!url) continue

    const host = KNOWN_FONT_CDN_HOSTS.find((candidate) => url.includes(candidate))
    if (host) {
      violations.push({
        host,
        url,
        message:
          `Found a reference to font CDN "${host}" ("${url}"). ` +
          `Self-host the font file instead (e.g. under public/fonts) and serve it ` +
          `same-origin via @font-face, so the CSP font-src can stay 'self'.`,
      })
    }
  }

  return { ok: violations.length === 0, violations }
}
