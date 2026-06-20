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
    exclude: ['**/node_modules/**', '**/AmountInput.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/components/AddressInput.tsx',
        'src/components/ConfirmDialog.tsx',
        'src/components/ThemeToggle.tsx',
        'src/hooks/useFocusTrap.ts',
        'src/hooks/useDocumentTitle.ts',
        'src/context/SettingsContext.tsx',
        'src/components/ToastProvider.tsx',
        'src/components/TrustGauge.tsx',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/components/AddressInput.tsx': { lines: 90, branches: 90 },
        'src/components/AmountInput.tsx': { lines: 80, branches: 80 },
        'src/components/ConfirmDialog.tsx': { branches: 90 },
        'src/components/ThemeToggle.tsx': { lines: 85, branches: 85 },
        'src/hooks/useFocusTrap.ts': { branches: 85 },
        'src/hooks/useDocumentTitle.ts': { lines: 90, branches: 90 },
        'src/context/SettingsContext.tsx': { lines: 80, branches: 80 },
        'src/components/ToastProvider.tsx': { lines: 80, branches: 80 },
        'src/components/TrustGauge.tsx': { lines: 90, branches: 90 },
      },
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
