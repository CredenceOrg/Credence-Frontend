import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getPreviousLng,
  handleLanguageChanged,
  setPreviousLng,
} from './localeBreadcrumb'

afterEach(() => {
  setPreviousLng(null)
  vi.restoreAllMocks()
})

describe('localeBreadcrumb', () => {
  it('emits a key=value breadcrumb with from/to when the locale flips', () => {
    setPreviousLng('en')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    handleLanguageChanged('fr')

    expect(info).toHaveBeenCalledTimes(1)
    const line = (info.mock.calls[0]?.[0] as string) ?? ''
    expect(line).toMatch(/^ts=\d{4}-\d{2}-\d{2}T/)
    expect(line).toMatch(/level=info/)
    expect(line).toMatch(/event=language_changed/)
    expect(line).toMatch(/from=en/)
    expect(line).toMatch(/to=fr/)
    expect(getPreviousLng()).toBe('fr')
  })

  it('uses "none" as the from value on the first switch', () => {
    setPreviousLng(null)
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    handleLanguageChanged('en')

    const line = (info.mock.calls[0]?.[0] as string) ?? ''
    expect(line).toMatch(/from=none/)
    expect(line).toMatch(/to=en/)
  })

  it('does not throw on an unknown locale and still logs an INFO breadcrumb', () => {
    setPreviousLng('en')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => handleLanguageChanged('xx-XX', { reason: 'unknown_locale' })).not.toThrow()

    expect(info).toHaveBeenCalledTimes(1)
    const line = (info.mock.calls[0]?.[0] as string) ?? ''
    expect(line).toMatch(/event=language_changed/)
    expect(line).toMatch(/to=xx-XX/)
    expect(line).toMatch(/reason=unknown_locale/)
    expect(error).not.toHaveBeenCalled()
    expect(getPreviousLng()).toBe('xx-XX')
  })

  it('omits optional fields when they are not supplied', () => {
    setPreviousLng('en')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})

    handleLanguageChanged('fr')

    const line = (info.mock.calls[0]?.[0] as string) ?? ''
    expect(line).not.toMatch(/reason=/)
    expect(line).not.toMatch(/namespace=/)
  })
})
