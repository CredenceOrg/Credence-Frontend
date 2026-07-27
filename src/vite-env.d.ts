/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOCS_URL: string
  readonly VITE_DOCS: string
  readonly VITE_TERMS_URL: string
  readonly VITE_TERMS: string
  readonly VITE_PRIVACY_URL: string
  readonly VITE_PRIVACY: string
  readonly VITE_API_RATE_LIMIT_MAX: string
  readonly VITE_API_RATE_LIMIT_WINDOW_MS: string
  readonly VITE_API_RATE_LIMIT_ENABLED: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
