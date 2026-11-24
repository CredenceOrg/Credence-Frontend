import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from './config'
import { getPreviousLng, setPreviousLng } from './localeBreadcrumb'

const loadTranslation = (): void => {
  i18n.addResourceBundle('fr-FR', 'translation', { hello: 'Bonjour' }, true, true)
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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import i18n, { loadLocale, isSupportedLocale, SUPPORTED_LOCALES } from './config'
import en from './locales/en.json'
import es from './locales/es.json'
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Collect all leaf-node dotted key paths from a nested object. */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return collectKeys(v as Record<string, unknown>, path)
    return [path]
const EN_KEYS = collectKeys(en as unknown as Record<string, unknown>)
const ES_KEYS = collectKeys(es as unknown as Record<string, unknown>)
// ---------------------------------------------------------------------------
// Key-parity test
// ---------------------------------------------------------------------------
describe('es.json key parity', () => {
  it('contains every key that en.json contains', () => {
    const missing = EN_KEYS.filter((k) => !ES_KEYS.includes(k))
    expect(missing, `es.json is missing keys:\n${missing.join('\n')}`).toHaveLength(0)
  it('does not contain keys absent from en.json (no extra keys)', () => {
    const extra = ES_KEYS.filter((k) => !EN_KEYS.includes(k))
    expect(extra, `es.json has extra keys not in en.json:\n${extra.join('\n')}`).toHaveLength(0)
// ---------------------------------------------------------------------------
// isSupportedLocale guard
// ---------------------------------------------------------------------------
describe('isSupportedLocale', () => {
  it('returns true for every entry in SUPPORTED_LOCALES', () => {
    SUPPORTED_LOCALES.forEach((l) => {
      expect(isSupportedLocale(l)).toBe(true)
  it('returns false for unknown strings', () => {
    expect(isSupportedLocale('fr')).toBe(false)
    expect(isSupportedLocale('EN')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
  it('returns false for non-string values', () => {
    expect(isSupportedLocale(null)).toBe(false)
    expect(isSupportedLocale(undefined)).toBe(false)
    expect(isSupportedLocale(42)).toBe(false)
// ---------------------------------------------------------------------------
// loadLocale
// ---------------------------------------------------------------------------
describe('loadLocale', () => {
  beforeEach(() => {
    // Remove the es bundle so each test starts clean
    i18n.removeResourceBundle('es', 'translation')
  it('resolves immediately for "en" without registering a bundle', async () => {
    const spy = vi.spyOn(i18n, 'addResourceBundle')
    await loadLocale('en')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  it('registers the es bundle on first call', async () => {
    expect(i18n.hasResourceBundle('es', 'translation')).toBe(false)
    await loadLocale('es')
    expect(i18n.hasResourceBundle('es', 'translation')).toBe(true)
  it('does not call addResourceBundle a second time if bundle is already loaded', async () => {
    await loadLocale('es') // first load
    const spy = vi.spyOn(i18n, 'addResourceBundle')
    await loadLocale('es') // second call — should be a no-op
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
// ---------------------------------------------------------------------------
// Language-switch integration
// ---------------------------------------------------------------------------
describe('i18n language switch', () => {
  afterEach(async () => {
    // Reset to English after each test
    await i18n.changeLanguage('en')
  it('translates a known key after switching to es', async () => {
    await loadLocale('es')
    await i18n.changeLanguage('es')
    expect(i18n.t('common.save')).toBe('Guardar')
  it('restores English translation after switching back', async () => {
    await loadLocale('es')
    await i18n.changeLanguage('es')
    await i18n.changeLanguage('en')
    expect(i18n.t('common.save')).toBe('Save')
  it('falls back to en for a key that only exists in en', async () => {
    await loadLocale('es')
    await i18n.changeLanguage('es')
    // Both locales have this key — verify it is overridden by es
    expect(i18n.t('nav.settings')).toBe('Ajustes')
