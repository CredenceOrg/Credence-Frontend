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
  readonly VITE_SENTRY_DSN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Runtime config injected by the server via <script> in index.html. */
interface RuntimeConfig {
  readonly VITE_SENTRY_DSN?: string
}

interface Window {
  __RUNTIME_CONFIG__?: RuntimeConfig
}
