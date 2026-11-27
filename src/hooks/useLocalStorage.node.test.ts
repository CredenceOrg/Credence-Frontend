// @vitest-environment node
//
// This file runs in a plain Node environment where `typeof window === 'undefined'`.
// It exercises the SSR branches of resolveStoredValue and writeToStorage that cannot
// be reached in a jsdom environment (because jsdom always provides window).

import { describe, expect, it } from 'vitest'
import { resolveStoredValue, writeToStorage } from './useLocalStorage'

describe('useLocalStorage helpers (SSR / Node environment)', () => {
  it('resolveStoredValue returns initialValue when window is undefined', () => {
    // In Node env, typeof window === 'undefined' — the SSR guard fires immediately.
    expect(resolveStoredValue('any-key', 'ssr-default')).toBe('ssr-default')
  })

  it('resolveStoredValue handles non-string initial values when window is undefined', () => {
    expect(resolveStoredValue('key', 42)).toBe(42)
    expect(resolveStoredValue('key', false)).toBe(false)
    expect(resolveStoredValue('key', null)).toBeNull()
  })

  it('writeToStorage does not throw when window is undefined', () => {
    // SSR setter path: typeof window === 'undefined' → early return, no write attempted.
    expect(() => writeToStorage('any-key', { value: 'data' })).not.toThrow()
  })
})
