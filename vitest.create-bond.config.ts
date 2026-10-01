import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// These component suites mock wallet, balance and toast boundaries. They do not
// use the API client, so they need no process-wide API rate-limiter setup.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/createBondFlow.setup.ts'],
    include: ['src/components/CreateBondFlow*.test.tsx', 'src/lib/createBondFlowSteps.test.ts'],
    minWorkers: 1,
    maxWorkers: 2,
  },
})
