import { afterEach, describe, expect, it, vi } from 'vitest'
import { logError, logInfo, logWarn } from './log'

afterEach(() => {
  vi.restoreAllMocks()
})

const captureInfo = () => {
  const lines: string[] = []
  vi.spyOn(console, 'info').mockImplementation((line: string) => {
    lines.push(line)
  })
  return lines
}

describe('structured logger', () => {
  it('emits a single key=value line for an info event', () => {
    const lines = captureInfo()

    logInfo('boot_ready', { scope: 'test', ok: true })

    expect(lines.length).toBe(1)
    const line = lines[0] ?? ''
    expect(line).toMatch(/^ts=\d{4}-\d{2}-\d{2}T/)
    expect(line).toMatch(/level=info/)
    expect(line).toMatch(/event=boot_ready/)
    expect(line).toMatch(/scope=test/)
    expect(line).toMatch(/ok=true/)
  })

  it('routes warn and error to the correct sinks', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    logWarn('cache_stale', { scope: 'test' })
    logError('fatal', { code: 7 })

    expect(info).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(err).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toMatch(/event=cache_stale/)
    expect(err.mock.calls[0]?.[0]).toMatch(/event=fatal code=7/)
  })

  it('drops fields whose key looks like a secret', () => {
    const lines = captureInfo()

    logInfo('attempt', { token: 'ghp_abc', scope: 'test', authorization: 'Bearer x' })

    expect(lines.length).toBe(1)
    const line = lines[0] ?? ''
    expect(line).not.toMatch(/ghp_abc/)
    expect(line).not.toMatch(/Bearer x/)
    expect(line).toMatch(/scope=test/)
  })

  it('renders empty or null fields as a dash', () => {
    const lines = captureInfo()

    logInfo('attempt', { empty: '', missing: null as unknown as string, ok: true })

    const line = lines[0] ?? ''
    expect(line).toMatch(/empty=-/)
    expect(line).toMatch(/missing=-/)
    expect(line).toMatch(/ok=true/)
  })
})
