import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('SENTRY_CONFIG DSN resolution', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
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
