import { renderHook, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSeo } from './useSeo'
import { BRAND, BRAND_SUFFIX } from './useDocumentTitle'

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
  // ─── Title management ──────────────────────────────────────────────────────

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

    it('renders the bare brand name when an empty title is supplied', () => {
      // formatDocumentTitle('') returns BRAND — useSeo should expose the same behaviour
      renderHook(() => useSeo({ title: '' }))
      expect(document.title).toBe(BRAND)
    })

    it('renders the bare brand name when a whitespace-only title is supplied', () => {
      renderHook(() => useSeo({ title: '   ' }))
      expect(document.title).toBe(BRAND)
    })

    it('updates the title when brandSuffix toggles from true to false', () => {
      const { rerender } = renderHook(
        ({ brandSuffix }: { brandSuffix: boolean }) => useSeo({ title: 'Bond', brandSuffix }),
        { initialProps: { brandSuffix: true } },
      )
      expect(document.title).toBe(`Bond ${BRAND_SUFFIX}`)

      rerender({ brandSuffix: false })
      expect(document.title).toBe('Bond')
    })

    it('restores the title captured at mount, not the title at unmount time', () => {
      // The effect captures previousTitle when it first runs. A later external
      // mutation to document.title must not affect what gets restored.
      document.title = 'Captured Title'
      const { unmount } = renderHook(() => useSeo({ title: 'Bond' }))

      // Externally overwrite the title after the hook has already run
      document.title = 'Externally Overwritten'

      unmount()
      expect(document.title).toBe('Captured Title')
    })
  })

  // ─── Meta description management ──────────────────────────────────────────

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
        useSeo({ title: 'Bond', description: 'Temporary description' }),
      )
      unmount()

      expect(getMetaDescription()!.getAttribute('content')).toBe('Original description')
    })

    it('removes a created meta description on unmount', () => {
      const { unmount } = renderHook(() =>
        useSeo({ title: 'Bond', description: 'Ephemeral description' }),
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
        useSeo({ title: 'Bond', description: 'Permanent desc', restoreOnUnmount: false }),
      )
      unmount()
      expect(getMetaDescription()!.getAttribute('content')).toBe('Permanent desc')
    })

    it('updates the description when the prop changes', () => {
      const { rerender } = renderHook(
        ({ description }: { description: string }) => useSeo({ title: 'Bond', description }),
        { initialProps: { description: 'First' } },
      )
      expect(getMetaDescription()!.getAttribute('content')).toBe('First')
      rerender({ description: 'Second' })
      expect(getMetaDescription()!.getAttribute('content')).toBe('Second')
    })

    it('sets content to an empty string when description is an empty string', () => {
      // Empty string is distinct from undefined — the hook should still write the
      // attribute rather than silently skipping it.
      renderHook(() => useSeo({ title: 'Bond', description: '' }))
      const meta = getMetaDescription()
      expect(meta).not.toBeNull()
      expect(meta!.getAttribute('content')).toBe('')
    })

    it('removes the meta tag when description transitions from defined to undefined', () => {
      // On rerender, the description effect's cleanup runs for the previous
      // value.  Because the hook created the element (wasCreated=true), it
      // should remove it when the description dep changes to undefined.
      const { rerender } = renderHook(
        ({ description }: { description: string | undefined }) =>
          useSeo({ title: 'Bond', description }),
        { initialProps: { description: 'Initial desc' as string | undefined } },
      )
      expect(getMetaDescription()).not.toBeNull()

      rerender({ description: undefined })
      expect(getMetaDescription()).toBeNull()
    })

    it('restores a pre-existing meta tag when description transitions from defined to undefined', () => {
      // The pre-existing element should be restored to its original content
      // when description is later dropped.
      const existing = document.createElement('meta')
      existing.setAttribute('name', 'description')
      existing.setAttribute('content', 'Site-wide fallback')
      document.head.appendChild(existing)

      const { rerender } = renderHook(
        ({ description }: { description: string | undefined }) =>
          useSeo({ title: 'Bond', description }),
        { initialProps: { description: 'Route description' as string | undefined } },
      )
      expect(getMetaDescription()!.getAttribute('content')).toBe('Route description')

      rerender({ description: undefined })
      expect(getMetaDescription()!.getAttribute('content')).toBe('Site-wide fallback')
    })
  })

  // ─── Combined title + description lifecycle ────────────────────────────────

  describe('combined title and description lifecycle', () => {
    it('sets both document.title and meta description on mount', () => {
      renderHook(() =>
        useSeo({
          title: 'Trust Score',
          description: 'View your on-chain Credence trust score.',
        }),
      )
      expect(document.title).toBe(`Trust Score ${BRAND_SUFFIX}`)
      expect(getMetaDescription()!.getAttribute('content')).toBe(
        'View your on-chain Credence trust score.',
      )
    })

    it('restores both document.title and meta description on unmount', () => {
      document.title = 'Previous Title'
      const existingMeta = document.createElement('meta')
      existingMeta.setAttribute('name', 'description')
      existingMeta.setAttribute('content', 'Previous description')
      document.head.appendChild(existingMeta)

      const { unmount } = renderHook(() =>
        useSeo({
          title: 'Trust Score',
          description: 'Route-specific description',
        }),
      )

      expect(document.title).toBe(`Trust Score ${BRAND_SUFFIX}`)
      expect(getMetaDescription()!.getAttribute('content')).toBe('Route-specific description')

      unmount()

      expect(document.title).toBe('Previous Title')
      expect(getMetaDescription()!.getAttribute('content')).toBe('Previous description')
    })

    it('cleans up both title and a created meta description on unmount', () => {
      document.title = 'App Shell'

      const { unmount } = renderHook(() =>
        useSeo({
          title: 'Bond',
          description: 'Bond description',
        }),
      )

      unmount()

      expect(document.title).toBe('App Shell')
      expect(getMetaDescription()).toBeNull()
    })

    it('restoreOnUnmount=false leaves both title and description in place', () => {
      document.title = 'App Shell'

      const { unmount } = renderHook(() =>
        useSeo({
          title: 'Bond',
          description: 'Persistent description',
          restoreOnUnmount: false,
        }),
      )

      unmount()

      expect(document.title).toBe(`Bond ${BRAND_SUFFIX}`)
      expect(getMetaDescription()!.getAttribute('content')).toBe('Persistent description')
    })
  })
})
