import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from './config'
import { getPreviousLng, setPreviousLng } from './localeBreadcrumb'

const loadTranslation = (): void => {
  i18n.addResourceBundle(
    'fr-FR',
    'translation',
    { hello: 'Bonjour' },
    true,
    true,
  )
}

afterEach(async () => {
  setPreviousLng(null)
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('i18n locale breadcrumb on locale switch', () => {
  it('emits a structured breadcrumb when changeLanguage is called (happy path)', async () => {
    loadTranslation()

    const lines: string[] = []
    vi.spyOn(console, 'info').mockImplementation((line: string) => {
      lines.push(line)
    })

    const before = getPreviousLng()
    await i18n.changeLanguage('fr-FR')

    expect(lines.length).toBeGreaterThanOrEqual(1)
    const last = lines[lines.length - 1] ?? ''
    expect(last).toMatch(/event=language_changed/)
    expect(last).toMatch(/to=fr-FR/)
    if (before !== null) {
      expect(last).toMatch(new RegExp(`from=${before.replace(/[-/\\]/g, '\\$&')}`))
    }
    expect(getPreviousLng()).toBe('fr-FR')
    expect(document.documentElement.lang).toBe('fr-FR')
  })

  it('does not throw when switching to an unknown locale and still logs an INFO breadcrumb (failure mode)', async () => {
    setPreviousLng(i18n.language || 'en')
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      void i18n.changeLanguage('xx-XX')
    }).not.toThrow()

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(info).toHaveBeenCalled()
    const lines = info.mock.calls.map((call) => String(call[0]))
    const last = lines[lines.length - 1] ?? ''
    expect(last).toMatch(/event=language_changed/)
    expect(error).not.toHaveBeenCalled()
  })
})
