/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { CSP } from './src/config/security'

const apiProxyTarget = process.env.VITE_API_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Credence',
        short_name: 'Credence',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Opt-in only (set by playwright.config.ts's webServer.env): swaps the real
      // Freighter extension SDK for a connectable stub so Playwright specs can
      // drive wallet-gated flows without a browser extension installed. Unset for
      // `npm run dev` and production builds, which always use the real package.
      ...(process.env.E2E_MOCK_WALLET === 'true'
        ? {
            '@stellar/freighter-api': path.resolve(
              __dirname,
              './tests/mocks/freighter-api.mock.ts'
            ),
          }
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
      '@stellar/freighter-api': path.resolve(
        __dirname,
        './src/test/__mocks__/freighter-api.stub.ts'
      ),
    },
    server: {
      deps: {
        inline: ['@exodus/bytes'],
      },
    },
    coverage: {
      provider: 'v8',
      include: [
        'src/api/client.ts',
        'src/components/AddressInput.tsx',
        'src/components/AmountInput.tsx',
        'src/components/Badge.tsx',
        'src/components/BackToTop.tsx',
        'src/components/controls/Select.tsx',
        'src/components/controls/Toggle.tsx',
        'src/components/CopyableHash.tsx',
        'src/hooks/useLocalStorage.ts',
        'src/hooks/useReducedMotion.ts',
        'src/lib/bondPenalty.ts',
        'src/lib/createBondFlowSteps.ts',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/api/client.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/components/AddressInput.tsx': { lines: 90, branches: 90 },
        // AmountInput owns the money-entry failure surface (loading / error /
        // stale / permission + retry) and its concurrency guard, so it is held at
        // full coverage to keep the state machine from silently losing a branch.
        'src/components/AmountInput.tsx': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        'src/components/Badge.tsx': { branches: 95 },
        // CopyableHash is the transaction/address copy failure boundary: every
        // rejection class (permission / stale / generic), the recovery window
        // that follows each one, and the success/failure timer slot it shares
        // with the 'Copied' confirmation must all stay reachable.
        'src/components/CopyableHash.tsx': {
          lines: 100,
          // Three defensive guards are unreachable through the rendered UI by
          // design: the unmount cleanup clears the recovery timer, every new
          // attempt cancels the pending one, and the copy button is disabled
          // while loading. The rest of the copy state machine stays at 100%.
          branches: 95,
          functions: 100,
          statements: 100,
        },
        // BackToTop guards every DOM/window call in its click handler, so each
        // catch arm is a reachable branch that must stay covered.
        'src/components/BackToTop.tsx': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        // Select owns the keyboard/pointer option-picking and its blur/close
        // recovery paths, so it is held at full coverage.
        'src/components/controls/Select.tsx': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        // Toggle owns its error/loading announcement surface and the id
        // derivation that keeps its error node from colliding with FormField's,
        // so it is held at full coverage.
        'src/components/controls/Toggle.tsx': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        'src/hooks/useLocalStorage.ts': { lines: 95, branches: 95 },
        'src/hooks/useReducedMotion.ts': { branches: 90 },
        'src/lib/bondPenalty.ts': { lines: 95, branches: 95, functions: 95 },
        'src/lib/createBondFlowSteps.ts': { lines: 100, branches: 100, functions: 100 },
      },
    },
  },
})
