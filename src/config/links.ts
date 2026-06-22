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

const getLink = (primaryEnv: string | undefined, legacyEnv: string | undefined, defaultPath: string): string => {
  const trimAndValidate = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim()
    return trimmed === '' ? undefined : trimmed
  }

  return trimAndValidate(primaryEnv) || trimAndValidate(legacyEnv) || defaultPath
}

const envDocs = getLink(import.meta.env.VITE_DOCS_URL, import.meta.env.VITE_DOCS, defaults.docs)
const envTerms = getLink(import.meta.env.VITE_TERMS_URL, import.meta.env.VITE_TERMS, defaults.terms)
const envPrivacy = getLink(import.meta.env.VITE_PRIVACY_URL, import.meta.env.VITE_PRIVACY, defaults.privacy)

export const LINKS = {
  docs: envDocs || defaults.docs,
  terms: envTerms || defaults.terms,
  privacy: envPrivacy || defaults.privacy,
} as const

export type Links = typeof LINKS

export default LINKS
