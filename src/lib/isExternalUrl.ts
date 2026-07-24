/**
 * Checks if a given URL is external (off-origin).
 * It returns true for valid absolute HTTP/HTTPS URLs that do not match the current origin.
 * Relative URLs, in-app links (like /docs), and same-origin absolute URLs are considered internal.
 * It also handles malformed URLs safely by returning false or true depending on the strictness,
 * but typical requirement: if it can't be parsed, it's not a valid external URL, return false.
 * Placeholder '#' should return false.
 *
 * @param href The URL string to check.
 * @returns boolean True if the URL is external, false otherwise.
 */
export function isExternalUrl(href: string | undefined): boolean {
  if (!href || href === '#') return false;
  if (href.startsWith('/') || href.startsWith('.')) return false;

  try {
    const url = new URL(href, window.location.href);
    return url.origin !== window.location.origin && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    // If URL parsing fails, err on the side of it not being a standard external URL
    return false;
  }
}
