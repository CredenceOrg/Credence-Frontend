import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('SENTRY_CONFIG DSN resolution', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    // Clear any runtime config from previous tests
    delete (window as Record<string, unknown>).__RUNTIME_CONFIG__
  })

  const setEnv = (value: string | undefined) => {
    if (value === undefined) {
      vi.stubEnv('VITE_SENTRY_DSN', undefined as unknown as string)
    } else {
      vi.stubEnv('VITE_SENTRY_DSN', value)
    }
  }

  const getSentryConfig = async () => {
    return ((await vi.importActual('./sentry')) as typeof import('./sentry')).SENTRY_CONFIG
  }

  describe('build-time env (import.meta.env)', () => {
    it('should use VITE_SENTRY_DSN when set', async () => {
      setEnv('https://key@o1.ingest.sentry.io/123')
      expect((await getSentryConfig()).dsn).toBe('https://key@o1.ingest.sentry.io/123')
    })

    it('should fall back to empty string when env is absent', async () => {
      setEnv(undefined)
      expect((await getSentryConfig()).dsn).toBe('')
    })

    it('should fall back to empty string when env is empty', async () => {
      setEnv('')
      expect((await getSentryConfig()).dsn).toBe('')
    })

    it('should fall back to empty string when env is whitespace', async () => {
      setEnv('   ')
      expect((await getSentryConfig()).dsn).toBe('')
    })
  })

  describe('runtime config (window.__RUNTIME_CONFIG__)', () => {
    it('should prefer runtime config over build-time env', async () => {
      setEnv('https://buildtime@o1.ingest.sentry.io/0')
      ;(window as Record<string, unknown>).__RUNTIME_CONFIG__ = {
        VITE_SENTRY_DSN: 'https://runtime@o1.ingest.sentry.io/1',
      }
      expect((await getSentryConfig()).dsn).toBe('https://runtime@o1.ingest.sentry.io/1')
    })

    it('should fall back to build-time env when runtime config is absent', async () => {
      setEnv('https://buildtime@o1.ingest.sentry.io/0')
      expect((await getSentryConfig()).dsn).toBe('https://buildtime@o1.ingest.sentry.io/0')
    })

    it('should fall back to empty string when neither is set', async () => {
      setEnv(undefined)
      expect((await getSentryConfig()).dsn).toBe('')
    })

    it('should fall back to build-time env when runtime config is empty', async () => {
      setEnv('https://buildtime@o1.ingest.sentry.io/0')
      ;(window as Record<string, unknown>).__RUNTIME_CONFIG__ = {
        VITE_SENTRY_DSN: '',
      }
      expect((await getSentryConfig()).dsn).toBe('https://buildtime@o1.ingest.sentry.io/0')
    })
  })
})
