import { describe, it, expect } from 'vitest'
import { validateAndNormalize, defaultSettings, type SettingsBlob } from './settingsSchema'

describe('validateAndNormalize', () => {
  it('accepts a valid full settings object', () => {
    const input: SettingsBlob = {
      themeMode: 'dark',
      network: 'test',
      addressDisplay: 'full',
      toastsEnabled: false,
      autoDismiss: '3s',
    }
    const result = validateAndNormalize(input)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual(input)
    }
  })

  it('returns defaults for empty / missing fields', () => {
    const result = validateAndNormalize({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual(defaultSettings())
    }
  })

  it('fills missing fields with defaults', () => {
    const result = validateAndNormalize({ themeMode: 'dark' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.themeMode).toBe('dark')
      expect(result.data.network).toBe('public')
      expect(result.data.addressDisplay).toBe('short')
      expect(result.data.toastsEnabled).toBe(true)
      expect(result.data.autoDismiss).toBe('5s')
    }
  })

  it('rejects non-object input (array)', () => {
    const result = validateAndNormalize([])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toContain('Imported value must be a JSON object')
    }
  })

  it('rejects non-object input (string)', () => {
    const result = validateAndNormalize('bad')
    expect(result.ok).toBe(false)
  })

  it('rejects non-object input (null)', () => {
    const result = validateAndNormalize(null)
    expect(result.ok).toBe(false)
  })

  it('rejects non-object input (number)', () => {
    const result = validateAndNormalize(42)
    expect(result.ok).toBe(false)
  })

  it('rejects non-object input (boolean)', () => {
    const result = validateAndNormalize(true)
    expect(result.ok).toBe(false)
  })

  describe('themeMode validation', () => {
    it.each(['light', 'dark', 'system'] as const)('accepts "%s"', (value) => {
      const result = validateAndNormalize({ themeMode: value })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.themeMode).toBe(value)
    })

    it('rejects invalid themeMode', () => {
      const result = validateAndNormalize({ themeMode: 'neon' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors[0]).toMatch(/themeMode/)
      }
    })
  })

  describe('network validation', () => {
    it.each(['public', 'test'] as const)('accepts "%s"', (value) => {
      const result = validateAndNormalize({ network: value })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.network).toBe(value)
    })

    it('rejects invalid network', () => {
      const result = validateAndNormalize({ network: 'private' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors[0]).toMatch(/network/)
      }
    })
  })

  describe('addressDisplay validation', () => {
    it.each(['full', 'short', 'friendly'] as const)('accepts "%s"', (value) => {
      const result = validateAndNormalize({ addressDisplay: value })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.addressDisplay).toBe(value)
    })

    it('rejects invalid addressDisplay', () => {
      const result = validateAndNormalize({ addressDisplay: 'long' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors[0]).toMatch(/addressDisplay/)
      }
    })
  })

  describe('toastsEnabled coercion', () => {
    it('coerces truthy values to true', () => {
      const r1 = validateAndNormalize({ toastsEnabled: 1 })
      if (r1.ok) expect(r1.data.toastsEnabled).toBe(true)

      const r2 = validateAndNormalize({ toastsEnabled: 'true' })
      if (r2.ok) expect(r2.data.toastsEnabled).toBe(true)
    })

    it('coerces falsy values to false', () => {
      const r1 = validateAndNormalize({ toastsEnabled: 0 })
      if (r1.ok) expect(r1.data.toastsEnabled).toBe(false)

      const r2 = validateAndNormalize({ toastsEnabled: '' })
      if (r2.ok) expect(r2.data.toastsEnabled).toBe(false)

      const r3 = validateAndNormalize({ toastsEnabled: null })
      if (r3.ok) expect(r3.data.toastsEnabled).toBe(false)
    })
  })

  describe('autoDismiss validation', () => {
    it.each(['off', '3s', '5s', '8s'] as const)('accepts "%s"', (value) => {
      const result = validateAndNormalize({ autoDismiss: value })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.data.autoDismiss).toBe(value)
    })

    it('rejects invalid autoDismiss', () => {
      const result = validateAndNormalize({ autoDismiss: '10s' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors[0]).toMatch(/autoDismiss/)
      }
    })
  })

  it('collects multiple errors at once', () => {
    const result = validateAndNormalize({
      themeMode: 'bad',
      network: 'bad',
      addressDisplay: 'bad',
      autoDismiss: 'bad',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toHaveLength(4)
    }
  })

  it('ignores unknown extra properties', () => {
    const result = validateAndNormalize({
      themeMode: 'dark',
      extraField: 'should be ignored',
      nested: { a: 1 },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.themeMode).toBe('dark')
      expect((result.data as unknown as Record<string, unknown>).extraField).toBeUndefined()
    }
  })
})

describe('defaultSettings', () => {
  it('returns a fresh object each call', () => {
    const a = defaultSettings()
    const b = defaultSettings()
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })

  it('contains all default values', () => {
    const d = defaultSettings()
    expect(d.themeMode).toBe('system')
    expect(d.network).toBe('public')
    expect(d.addressDisplay).toBe('short')
    expect(d.toastsEnabled).toBe(true)
    expect(d.autoDismiss).toBe('5s')
  })
})
