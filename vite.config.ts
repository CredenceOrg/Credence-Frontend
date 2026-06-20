/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['node_modules', 'dist', '.git', '.cache', 'src/components/AmountInput.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/components/AddressInput.tsx',
        'src/components/ConfirmDialog.tsx',
        'src/hooks/useFocusTrap.ts',
        'src/components/forms/FormField.tsx',
      ],
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/components/AddressInput.tsx': { lines: 90, branches: 90 },
        'src/components/ConfirmDialog.tsx': { branches: 90 },
        'src/hooks/useFocusTrap.ts': { branches: 85 },
        'src/components/forms/FormField.tsx': { lines: 95, branches: 95 },
      },
    },
  },
})
