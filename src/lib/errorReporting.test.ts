// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * `@sentry/browser` is replaced with spies. `factoryCalls` counts how many
 * times the replacement was actually evaluated, which is how we prove the SDK
 * is never imported when reporting is disabled.
 */
const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  factoryCalls: 0,
}))

vi.mock('@sentry/browser', () => {
  sentry.factoryCalls += 1
  return { init: sentry.init, captureException: sentry.captureException }
})

// 56-character StrKey-shaped identifiers: type prefix + 55 base-32 chars.
const WALLET = `G${'A'.repeat(55)}`
const CONTRACT = `C${'B'.repeat(55)}`

type ErrorReportingModule = typeof import('./errorReporting')

async function loadErrorReporting(env: Record<string, string> = {}): Promise<ErrorReportingModule> {
  vi.resetModules()
  vi.stubEnv('VITE_SENTRY_DSN', env.VITE_SENTRY_DSN ?? '')
  if (env.VITE_SENTRY_ENVIRONMENT !== undefined) {
    vi.stubEnv('VITE_SENTRY_ENVIRONMENT', env.VITE_SENTRY_ENVIRONMENT)
  }
  if (env.VITE_SENTRY_SAMPLE_RATE !== undefined) {
    vi.stubEnv('VITE_SENTRY_SAMPLE_RATE', env.VITE_SENTRY_SAMPLE_RATE)
  }
  if (env.VITE_SENTRY_TRACES_SAMPLE_RATE !== undefined) {
    vi.stubEnv('VITE_SENTRY_TRACES_SAMPLE_RATE', env.VITE_SENTRY_TRACES_SAMPLE_RATE)
  }
  return import('./errorReporting')
}

const DSN = 'https://publicKey@o1.ingest.sentry.io/42'

beforeEach(() => {
  sentry.init.mockClear()
  sentry.captureException.mockClear()
  sentry.factoryCalls = 0
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('initErrorReporting — reporting disabled', () => {
  it('never imports the SDK when the DSN is blank', async () => {
    const { initErrorReporting, isErrorReportingEnabled } = await loadErrorReporting()

    await initErrorReporting()
    await initErrorReporting()

    expect(isErrorReportingEnabled()).toBe(false)
    expect(sentry.factoryCalls).toBe(0)
    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('treats a whitespace-only DSN as disabled', async () => {
    const { initErrorReporting } = await loadErrorReporting({ VITE_SENTRY_DSN: '   ' })

    await initErrorReporting()

    expect(sentry.factoryCalls).toBe(0)
    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('captureException is a safe no-op', async () => {
    const { captureException } = await loadErrorReporting()

    await expect(captureException(new Error('boom'), { source: 'test' })).resolves.toBeUndefined()
    expect(sentry.factoryCalls).toBe(0)
    expect(sentry.captureException).not.toHaveBeenCalled()
  })
})

describe('initErrorReporting — reporting enabled', () => {
  it('initialises the SDK exactly once with the configured options', async () => {
    const { initErrorReporting } = await loadErrorReporting({
      VITE_SENTRY_DSN: DSN,
      VITE_SENTRY_ENVIRONMENT: 'staging',
      VITE_SENTRY_SAMPLE_RATE: '0.25',
      VITE_SENTRY_TRACES_SAMPLE_RATE: '0.1',
    })

    await initErrorReporting()
    await initErrorReporting()

    expect(sentry.init).toHaveBeenCalledTimes(1)
    const options = sentry.init.mock.calls[0]?.[0] as {
      dsn: string
      environment: string
      sampleRate: number
      tracesSampleRate: number
    }
    expect(options.dsn).toBe(DSN)
    expect(options.environment).toBe('staging')
    expect(options.sampleRate).toBe(0.25)
    expect(options.tracesSampleRate).toBe(0.1)
  })

  it('removes the SDK global handlers so events are reported once', async () => {
    const { initErrorReporting } = await loadErrorReporting({ VITE_SENTRY_DSN: DSN })

    await initErrorReporting()

    const options = sentry.init.mock.calls[0]?.[0] as {
      integrations: (integrations: { name: string }[]) => { name: string }[]
    }
    const remaining = options.integrations([{ name: 'GlobalHandlers' }, { name: 'Breadcrumbs' }])

    expect(remaining.map((i) => i.name)).toEqual(['Breadcrumbs'])
  })

  it('scrubs wallet addresses in beforeSend', async () => {
    const { initErrorReporting } = await loadErrorReporting({ VITE_SENTRY_DSN: DSN })

    await initErrorReporting()

    const options = sentry.init.mock.calls[0]?.[0] as {
      beforeSend: (event: Record<string, unknown>) => Record<string, unknown> | null
    }
    const scrubbed = options.beforeSend({
      message: `Bond transfer failed for ${WALLET}`,
      extra: { contract: CONTRACT, amount: '1500.00', note: 'ok' },
    })

    expect(scrubbed).not.toBeNull()
    expect(JSON.stringify(scrubbed)).not.toContain(WALLET)
    expect(JSON.stringify(scrubbed)).not.toContain(CONTRACT)
    expect(JSON.stringify(scrubbed)).not.toContain('1500.00')
  })
})

describe('captureException', () => {
  it('forwards the error with scrubbed context', async () => {
    const { captureException } = await loadErrorReporting({ VITE_SENTRY_DSN: DSN })

    await captureException(new Error(`failed for ${WALLET}`), {
      source: 'ErrorBoundary',
      wallet: WALLET,
      amount: '42',
    })

    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    const [error, hint] = sentry.captureException.mock.calls[0] as [
      Error,
      { extra: Record<string, unknown> },
    ]
    expect(error).toBeInstanceOf(Error)
    expect(hint.extra.source).toBe('ErrorBoundary')
    expect(hint.extra.wallet).toBe('[REDACTED]')
    expect(hint.extra.amount).toBe('[REDACTED]')
  })

  it('reports unhandled promise rejections exactly once', async () => {
    const { initErrorReporting } = await loadErrorReporting({ VITE_SENTRY_DSN: DSN })

    await initErrorReporting()

    const event = Object.assign(new Event('unhandledrejection'), {
      reason: new Error('async failure'),
    })
    window.dispatchEvent(event)
    await Promise.resolve()
    await Promise.resolve()

    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    const [error, hint] = sentry.captureException.mock.calls[0] as [
      Error,
      { extra: Record<string, unknown> },
    ]
    expect((error as Error).message).toBe('async failure')
    expect(hint.extra.source).toBe('unhandledrejection')
  })

  it('does not double-register the global listener across repeated init calls', async () => {
    const { initErrorReporting } = await loadErrorReporting({ VITE_SENTRY_DSN: DSN })

    await initErrorReporting()
    await initErrorReporting()

    window.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new Error('once') })
    )
    await Promise.resolve()
    await Promise.resolve()

    expect(sentry.captureException).toHaveBeenCalledTimes(1)
  })
})
