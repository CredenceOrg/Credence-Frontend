// Centralized link manifest for footer / legal / docs
// Values can be overridden at build/runtime via Vite env vars:
// - VITE_DOCS_URL
// - VITE_TERMS_URL
// - VITE_PRIVACY_URL
const defaults = {
  docs: '/docs',
  terms: '/legal/terms',
  privacy: '/legal/privacy',
} as const

const envDocs = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_DOCS_URL || (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_DOCS
const envTerms = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_TERMS_URL || (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_TERMS
const envPrivacy = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PRIVACY_URL || (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_PRIVACY

export const LINKS = {
  docs: envDocs || defaults.docs,
  terms: envTerms || defaults.terms,
  privacy: envPrivacy || defaults.privacy,
} as const

export type Links = typeof LINKS

export default LINKS
