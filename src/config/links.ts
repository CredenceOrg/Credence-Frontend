// Centralized link manifest for footer / legal / docs
// Values can be overridden at build/runtime via Vite env vars:
// - VITE_DOCS_URL  (preferred)  /  VITE_DOCS (legacy)
// - VITE_TERMS_URL (preferred)  /  VITE_TERMS (legacy)
// - VITE_PRIVACY_URL (preferred) / VITE_PRIVACY (legacy)
//
// Resolution contract (pinned by links.test.ts):
// 1. A non-empty (after trimming) primary env var wins.
// 2. Otherwise the legacy env var is used when it is non-empty after trimming.
// 3. Otherwise the built-in same-origin fallback applies.
const defaults = {
  docs: '/docs',
  terms: '/legal/terms',
  privacy: '/legal/privacy',
} as const

/** Returns the trimmed env value, or undefined when empty/whitespace/absent. */
function readEnv(key: string): string | undefined {
  const raw = (import.meta.env as Record<string, string | undefined> | undefined)?.[key]
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed || undefined
}

function resolve(preferred: string, legacy: string, fallback: string): string {
  return readEnv(preferred) ?? readEnv(legacy) ?? fallback
}

export const LINKS = {
  docs: resolve('VITE_DOCS_URL', 'VITE_DOCS', defaults.docs),
  terms: resolve('VITE_TERMS_URL', 'VITE_TERMS', defaults.terms),
  privacy: resolve('VITE_PRIVACY_URL', 'VITE_PRIVACY', defaults.privacy),
} as const

export type Links = typeof LINKS

export default LINKS
