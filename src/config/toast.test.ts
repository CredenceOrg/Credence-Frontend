import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('TOAST_CONFIG', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  const setEnv = (key: string, value: string | undefined) => {
    if (value === undefined) {
      vi.stubEnv(key, undefined as unknown as string)
    } else {
      vi.stubEnv(key, value)
    }
  }

  const getToastConfig = async () => {
    return ((await vi.importActual('./toast')) as typeof import('./toast')).TOAST_CONFIG
  }

  it('should use default timeouts when no env vars are set', async () => {
    const config = await getToastConfig()
    expect(config.timeouts.info).toBe(5000)
    expect(config.timeouts.success).toBe(5000)
    expect(config.timeouts.warning).toBe(8000)
    expect(config.timeouts.danger).toBe(0)
  })

  it('should use VITE_TOAST_TIMEOUT for info/success when set', async () => {
    setEnv('VITE_TOAST_TIMEOUT', '10000')
    const config = await getToastConfig()
    expect(config.timeouts.info).toBe(10000)
    expect(config.timeouts.success).toBe(10000)
    expect(config.timeouts.warning).toBe(8000) // unaffected
    expect(config.timeouts.danger).toBe(0) // unaffected
  })

  it('should use VITE_TOAST_TIMEOUT_WARNING for warning when set', async () => {
    setEnv('VITE_TOAST_TIMEOUT_WARNING', '15000')
    const config = await getToastConfig()
    expect(config.timeouts.info).toBe(5000) // default
    expect(config.timeouts.warning).toBe(15000)
  })

  it('should fall back to defaults when env var is empty string', async () => {
    setEnv('VITE_TOAST_TIMEOUT', '')
    const config = await getToastConfig()
    expect(config.timeouts.info).toBe(5000)
    expect(config.timeouts.success).toBe(5000)
  })

  it('should fall back to defaults when env var is whitespace', async () => {
    setEnv('VITE_TOAST_TIMEOUT', '   ')
    const config = await getToastConfig()
    expect(config.timeouts.info).toBe(5000)
  })

  it('should fall back to defaults when env var is negative', async () => {
    setEnv('VITE_TOAST_TIMEOUT', '-100')
    const config = await getToastConfig()
    expect(config.timeouts.info).toBe(5000)
  })

  it('should fall back to defaults when env var is NaN', async () => {
    setEnv('VITE_TOAST_TIMEOUT', 'not-a-number')
    const config = await getToastConfig()
    expect(config.timeouts.info).toBe(5000)
  })

  it('should accept zero as a valid timeout (no auto-dismiss)', async () => {
    setEnv('VITE_TOAST_TIMEOUT', '0')
    const config = await getToastConfig()
    expect(config.timeouts.info).toBe(0)
    expect(config.timeouts.success).toBe(0)
  })

  it('should export maxToasts constant', async () => {
    const config = await getToastConfig()
    expect(config.maxToasts).toBe(3)
  })
})