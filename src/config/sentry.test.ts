import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

describe('SENTRY_CONFIG options', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const loadConfig = async (
    env: Partial<
      Record<
        | 'VITE_SENTRY_DSN'
        | 'VITE_SENTRY_ENVIRONMENT'
        | 'VITE_SENTRY_RELEASE'
        | 'VITE_SENTRY_SAMPLE_RATE'
        | 'VITE_SENTRY_TRACES_SAMPLE_RATE',
        string
      >
    >
  ) => {
    vi.resetModules()
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value as string)
    }
    return ((await vi.importActual('./sentry')) as typeof import('./sentry')).SENTRY_CONFIG
  }

  it('is disabled without a DSN', async () => {
    const config = await loadConfig({ VITE_SENTRY_DSN: '' })

    expect(config.enabled).toBe(false)
  })

  it('is enabled once a DSN is configured', async () => {
    const config = await loadConfig({ VITE_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1' })

    expect(config.enabled).toBe(true)
  })

  it('defaults to sending every error and no traces', async () => {
    const config = await loadConfig({})

    expect(config.sampleRate).toBe(1)
    expect(config.tracesSampleRate).toBe(0)
  })

  it('reads sample-rate overrides from the environment', async () => {
    const config = await loadConfig({
      VITE_SENTRY_SAMPLE_RATE: '0.5',
      VITE_SENTRY_TRACES_SAMPLE_RATE: '0.2',
    })

    expect(config.sampleRate).toBe(0.5)
    expect(config.tracesSampleRate).toBe(0.2)
  })

  it('clamps out-of-range rates into [0, 1]', async () => {
    const high = await loadConfig({
      VITE_SENTRY_SAMPLE_RATE: '5',
      VITE_SENTRY_TRACES_SAMPLE_RATE: '1.5',
    })
    expect(high.sampleRate).toBe(1)
    expect(high.tracesSampleRate).toBe(1)

    const low = await loadConfig({
      VITE_SENTRY_SAMPLE_RATE: '-3',
      VITE_SENTRY_TRACES_SAMPLE_RATE: '-0.1',
    })
    expect(low.sampleRate).toBe(0)
    expect(low.tracesSampleRate).toBe(0)
  })

  it('falls back to defaults for non-numeric rates', async () => {
    const config = await loadConfig({
      VITE_SENTRY_SAMPLE_RATE: 'abc',
      VITE_SENTRY_TRACES_SAMPLE_RATE: '  ',
    })

    expect(config.sampleRate).toBe(1)
    expect(config.tracesSampleRate).toBe(0)
  })

  it('uses the environment tag and release when provided', async () => {
    const config = await loadConfig({
      VITE_SENTRY_ENVIRONMENT: 'staging',
      VITE_SENTRY_RELEASE: 'credence@1.2.3',
    })

    expect(config.environment).toBe('staging')
    expect(config.release).toBe('credence@1.2.3')
  })
})
