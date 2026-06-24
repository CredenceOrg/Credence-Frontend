/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const apiProxyTarget = process.env.VITE_API_BASE_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
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
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/components/AddressInput.tsx': { lines: 90, branches: 90 },
        'src/components/Badge.tsx': { branches: 95 },
        'src/hooks/useLocalStorage.ts': { lines: 95, branches: 95 },
      },
    },
  },
})
