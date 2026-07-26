/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOCS_URL: string
  readonly VITE_DOCS: string
  readonly VITE_TERMS_URL: string
  readonly VITE_TERMS: string
  readonly VITE_PRIVACY_URL: string
  readonly VITE_PRIVACY: string
  readonly VITE_QUERY_CACHE_DEFAULT_TTL_MS?: string
  readonly VITE_QUERY_CACHE_STALE_TIME_MS?: string
  readonly VITE_QUERY_CACHE_GC_TIME_MS?: string
  readonly VITE_QUERY_CACHE_ISSUER_TTL_MS?: string
  readonly VITE_QUERY_CACHE_VERIFIER_TTL_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
