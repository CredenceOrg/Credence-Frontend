import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BRAND,
  BRAND_SUFFIX,
  formatDocumentTitle,
  useDocumentTitle,
} from './useDocumentTitle'

describe('formatDocumentTitle', () => {
  it('appends the brand suffix by default', () => {
    expect(formatDocumentTitle('Bond')).toBe(`Bond ${BRAND_SUFFIX}`)
  })

  it('trims surrounding whitespace before branding', () => {
    expect(formatDocumentTitle('  Bond  ')).toBe(`Bond ${BRAND_SUFFIX}`)
  })

  it('does not double-suffix an already-branded title', () => {
    const branded = `Bond ${BRAND_SUFFIX}`
    expect(formatDocumentTitle(branded)).toBe(branded)
  })

  it('returns the bare brand for an empty title', () => {
    expect(formatDocumentTitle('')).toBe(BRAND)
    expect(formatDocumentTitle('   ')).toBe(BRAND)
  })

  it('returns the bare brand when the title already is the brand', () => {
    expect(formatDocumentTitle(BRAND)).toBe(BRAND)
  })

  it('omits the suffix when brandSuffix is false', () => {
    expect(formatDocumentTitle('Bond', false)).toBe('Bond')
  })

  it('falls back to the brand for an empty unbranded title', () => {
    expect(formatDocumentTitle('', false)).toBe(BRAND)
  })
})

describe('useDocumentTitle', () => {
  const initialTitle = 'Credence — Economic Trust'

  beforeEach(() => {
    document.title = initialTitle
  })

  afterEach(() => {
    document.title = initialTitle
  })

  it('sets a branded document title on mount', () => {
    renderHook(() => useDocumentTitle('Bond'))
    expect(document.title).toBe(`Bond ${BRAND_SUFFIX}`)
  })

  it('restores the previous title on unmount by default', () => {
    const { unmount } = renderHook(() => useDocumentTitle('Settings'))
    expect(document.title).toBe(`Settings ${BRAND_SUFFIX}`)

    unmount()
    expect(document.title).toBe(initialTitle)
  })

  it('updates the title when the title prop changes (route change)', () => {
    const { rerender } = renderHook(({ t }: { t: string }) => useDocumentTitle(t), {
      initialProps: { t: 'Home' },
    })
    expect(document.title).toBe(`Home ${BRAND_SUFFIX}`)

    rerender({ t: 'Trust Score' })
    expect(document.title).toBe(`Trust Score ${BRAND_SUFFIX}`)
  })

  it('leaves the title in place when restoreOnUnmount is false', () => {
    const { unmount } = renderHook(() =>
      useDocumentTitle('Settings', { restoreOnUnmount: false })
    )
    expect(document.title).toBe(`Settings ${BRAND_SUFFIX}`)

    unmount()
    expect(document.title).toBe(`Settings ${BRAND_SUFFIX}`)
  })

  it('respects brandSuffix: false', () => {
    renderHook(() => useDocumentTitle('Credence — Economic Trust', { brandSuffix: false }))
    expect(document.title).toBe('Credence — Economic Trust')
  })

  it('does not double-suffix an already-branded title', () => {
    renderHook(() => useDocumentTitle(`Bond ${BRAND_SUFFIX}`))
    expect(document.title).toBe(`Bond ${BRAND_SUFFIX}`)
  })
})
