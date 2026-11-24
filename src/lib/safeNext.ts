import { DEFAULT_FALLBACK_ROUTE } from '../config/navigation'

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }
  return false
}

/**
 * Validates and sanitizes a `next` redirect target so it is guaranteed to be a
 * safe, same-origin relative path.
 *
 * Rejects:
 * - missing / empty values
 * - external URLs (`https://evil.com`, `javascript:...`, `data:...`)
 * - protocol-relative URLs (`//evil.com`)
 * - backslash tricks (`/\evil.com`)
 * - control characters
 * - redirect loops targeting `/signin`
 */
export function safeNext(
  raw: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK_ROUTE
): string {
  if (typeof raw !== 'string') return fallback

  const trimmed = raw.trim()
  if (!trimmed) return fallback
  if (!trimmed.startsWith('/')) return fallback
  if (trimmed.startsWith('//')) return fallback
  if (trimmed.includes('\\')) return fallback
  if (hasControlChars(trimmed)) return fallback

  try {
    const parsed = new URL(trimmed, 'http://localhost')
    if (parsed.origin !== 'http://localhost') return fallback
    if (parsed.pathname === '/signin' || parsed.pathname === '/signin/') {
      return fallback
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
