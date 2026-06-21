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
    setupFiles: ['./src/test-setup.ts'],
    server: {
      deps: {
        inline: ['@exodus/bytes'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/components/AddressInput.tsx', 'src/components/Badge.tsx'],
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/components/AddressInput.tsx': { lines: 90, branches: 90 },
        'src/components/Badge.tsx': { branches: 95 },
      },
    },
  },
})
