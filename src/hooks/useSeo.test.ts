import { renderHook, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSeo } from './useSeo'
import { BRAND_SUFFIX } from './useDocumentTitle'

const INITIAL_TITLE = 'Test Page'

function getMetaDescription(): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>('meta[name="description"]')
}

beforeEach(() => {
  document.title = INITIAL_TITLE
  getMetaDescription()?.remove()
})

afterEach(() => {
  cleanup()
  document.title = INITIAL_TITLE
  getMetaDescription()?.remove()
})

describe('useSeo', () => {
  describe('title management', () => {
    it('sets document.title with the brand suffix by default', () => {
      renderHook(() => useSeo({ title: 'Bond' }))
      expect(document.title).toBe(`Bond ${BRAND_SUFFIX}`)
    })

    it('omits the brand suffix when brandSuffix=false', () => {
      renderHook(() => useSeo({ title: 'Bond', brandSuffix: false }))
      expect(document.title).toBe('Bond')
    })

    it('does not double-suffix an already-branded title', () => {
      renderHook(() => useSeo({ title: `Bond ${BRAND_SUFFIX}` }))
      expect(document.title).toBe(`Bond ${BRAND_SUFFIX}`)
    })

    it('restores the previous title on unmount', () => {
      document.title = 'Previous Page'
      const { unmount } = renderHook(() => useSeo({ title: 'Bond' }))
      unmount()
      expect(document.title).toBe('Previous Page')
    })

    it('leaves the title in place when restoreOnUnmount=false', () => {
      document.title = 'Previous Page'
      const { unmount } = renderHook(() => useSeo({ title: 'Bond', restoreOnUnmount: false }))
      unmount()
      expect(document.title).toBe(`Bond ${BRAND_SUFFIX}`)
    })

    it('updates document.title when the title prop changes', () => {
      const { rerender } = renderHook(({ title }: { title: string }) => useSeo({ title }), {
        initialProps: { title: 'Bond' },
      })
      expect(document.title).toBe(`Bond ${BRAND_SUFFIX}`)
      rerender({ title: 'Dashboard' })
      expect(document.title).toBe(`Dashboard ${BRAND_SUFFIX}`)
    })
  })

  describe('meta description management', () => {
    it('creates a <meta name="description"> element when none exists', () => {
      renderHook(() => useSeo({ title: 'Bond', description: 'Lock USDC on Stellar.' }))
      const meta = getMetaDescription()
      expect(meta).not.toBeNull()
      expect(meta!.getAttribute('content')).toBe('Lock USDC on Stellar.')
    })

    it('updates an existing meta description without creating a duplicate', () => {
      const existing = document.createElement('meta')
      existing.setAttribute('name', 'description')
      existing.setAttribute('content', 'Old description')
      document.head.appendChild(existing)

      renderHook(() => useSeo({ title: 'Bond', description: 'New description.' }))

      const metas = document.querySelectorAll('meta[name="description"]')
      expect(metas).toHaveLength(1)
      expect(metas[0].getAttribute('content')).toBe('New description.')
    })

    it('restores a pre-existing description on unmount', () => {
      const existing = document.createElement('meta')
      existing.setAttribute('name', 'description')
      existing.setAttribute('content', 'Original description')
      document.head.appendChild(existing)

      const { unmount } = renderHook(() =>
        useSeo({ title: 'Bond', description: 'Temporary description' })
      )
      unmount()

      expect(getMetaDescription()!.getAttribute('content')).toBe('Original description')
    })

    it('removes a created meta description on unmount', () => {
      const { unmount } = renderHook(() =>
        useSeo({ title: 'Bond', description: 'Ephemeral description' })
      )
      unmount()
      expect(getMetaDescription()).toBeNull()
    })

    it('does not create a meta description when description is undefined', () => {
      renderHook(() => useSeo({ title: 'Bond' }))
      expect(getMetaDescription()).toBeNull()
    })

    it('leaves the description in place when restoreOnUnmount=false', () => {
      const { unmount } = renderHook(() =>
        useSeo({ title: 'Bond', description: 'Permanent desc', restoreOnUnmount: false })
      )
      unmount()
      expect(getMetaDescription()!.getAttribute('content')).toBe('Permanent desc')
    })

    it('updates the description when the prop changes', () => {
      const { rerender } = renderHook(
        ({ description }: { description: string }) => useSeo({ title: 'Bond', description }),
        { initialProps: { description: 'First' } }
      )
      expect(getMetaDescription()!.getAttribute('content')).toBe('First')
      rerender({ description: 'Second' })
      expect(getMetaDescription()!.getAttribute('content')).toBe('Second')
    })
  })
})
