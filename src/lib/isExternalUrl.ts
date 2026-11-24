/**
 * Checks if a given URL is external (off-origin) or a safe non-HTTP scheme.
 *
 * Returns `true` for:
 * - Absolute HTTP/HTTPS URLs whose origin differs from the current page origin.
 * - `mailto:` URLs (safe, opens the system mail client).
 *
 * Returns `false` for:
 * - Relative paths (`/docs`, `./relative`).
 * - Same-origin absolute URLs.
 * - Placeholder `#` or empty/undefined values.
 * - `javascript:` and any other non-allow-listed scheme (blocked for security).
 * - Malformed strings that cannot be parsed as a URL.
 *
 * @param href The URL string to check.
 * @returns `true` if the URL should be treated as external / leaving the app.
 */
export function isExternalUrl(href: string | undefined): boolean {
  if (!href || href === '#') return false
  if (href.startsWith('/') || href.startsWith('.')) return false

  // Allow mailto: links — they open the system mail client, not the browser.
  if (href.startsWith('mailto:')) return true

  try {
    const url = new URL(href, window.location.href)
    return (
      url.origin !== window.location.origin &&
      (url.protocol === 'http:' || url.protocol === 'https:')
    )
  } catch {
    // If URL parsing fails, err on the side of it not being a standard external URL
    return false
  }
}
