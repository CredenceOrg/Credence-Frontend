/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { CSP } from './src/config/security'

const apiProxyTarget = process.env.VITE_API_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Opt-in only (set by playwright.config.ts's webServer.env): swaps the real
      // Freighter extension SDK for a connectable stub so Playwright specs can
      // drive wallet-gated flows without a browser extension installed. Unset for
      // `npm run dev` and production builds, which always use the real package.
      ...(process.env.E2E_MOCK_WALLET === 'true'
        ? { '@stellar/freighter-api': path.resolve(__dirname, './tests/mocks/freighter-api.mock.ts') }
        : {}),
    },
  },
  server: {
    port: 5173,
    headers: {
      'Content-Security-Policy': CSP,
    },
    proxy: {
      '/api': { target: apiProxyTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    pool: 'forks',
    setupFiles: ['./src/test-setup.ts'],
    alias: {
      '@stellar/freighter-api': path.resolve(__dirname, './src/test/__mocks__/freighter-api.stub.ts'),
    },
    server: {
      deps: {
        inline: ['@exodus/bytes'],
      },
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/components/AddressInput.tsx',
        'src/components/Badge.tsx',
        'src/hooks/useLocalStorage.ts',
        'src/hooks/useReducedMotion.ts',
        'src/lib/bondPenalty.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/components/AddressInput.tsx': { lines: 90, branches: 90 },
        'src/components/Badge.tsx': { branches: 95 },
        'src/hooks/useLocalStorage.ts': { lines: 95, branches: 95 },
        'src/hooks/useReducedMotion.ts': { branches: 90 },
        'src/lib/bondPenalty.ts': { lines: 95, branches: 95, functions: 95 },
      },
    },
  },
})
