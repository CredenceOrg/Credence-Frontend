/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOCS_URL: string
  readonly VITE_DOCS: string
  readonly VITE_TERMS_URL: string
  readonly VITE_TERMS: string
  readonly VITE_PRIVACY_URL: string
  readonly VITE_PRIVACY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
