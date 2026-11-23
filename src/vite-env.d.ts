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
  readonly VITE_SETTINGS_SYNC_ENABLED: string
  readonly VITE_BOND_CONTRACT_ID_PUBLIC?: string
  readonly VITE_BOND_CONTRACT_ID_TEST?: string
  readonly VITE_SOROBAN_RPC_URL_PUBLIC?: string
  readonly VITE_SOROBAN_RPC_URL_TEST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
