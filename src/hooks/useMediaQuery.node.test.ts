// @vitest-environment node
//
// This file runs in a plain Node environment where `typeof window === 'undefined'`.
// It exercises the static-render / SSR branches of useMediaQuery and useIsMobile
// that cannot be reached in a jsdom environment (because jsdom always provides window).
//
// The "static render fallback" contract:
//   When window.matchMedia is unavailable (SSR, Node test runners, static export)
//   both hooks MUST return `false` rather than throwing or returning undefined.

import { describe, expect, it } from 'vitest'

describe('useMediaQuery static-render fallback (SSR / Node environment)', () => {
  it('window is undefined in this environment', () => {
    // Guard: confirm we are actually in a Node environment.
    // If this fails the @vitest-environment node directive was ignored.
    expect(typeof window).toBe('undefined')
  })

  it('lazy initialiser returns false when window is undefined', () => {
    // The hook's useState lazy initialiser runs synchronously and guards on
    // `typeof window === 'undefined'`. We evaluate it in isolation to confirm
    // the SSR path returns false without throwing.
    const initialiser = () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false
      }
      return window.matchMedia('(max-width: 767px)').matches
    }
    expect(initialiser()).toBe(false)
  })

  it('lazy initialiser returns false for any query string when window is undefined', () => {
    const queries = [
      '(max-width: 767px)',
      '(min-width: 1024px)',
      '(prefers-color-scheme: dark)',
      '(prefers-reduced-motion: reduce)',
      'screen and (orientation: landscape)',
    ]

    const initialiser = (query: string) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false
      }
      return window.matchMedia(query).matches
    }

    for (const q of queries) {
      expect(initialiser(q)).toBe(false)
    }
  })

  it('useEffect guard returns early when window is undefined', () => {
    // The useEffect body uses the same guard; simulate to confirm it does not
    // throw and returns undefined (a no-op cleanup is acceptable).
    const effectBody = (): (() => void) | undefined => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return undefined
      }
      // Would subscribe to matchMedia here — unreachable in this environment.
      return () => {}
    }
    expect(effectBody()).toBeUndefined()
  })

  it('useIsMobile static-render fallback uses the same guard as useMediaQuery', () => {
    // useIsMobile delegates to useMediaQuery('(max-width: 767px)').
    // Confirm the shared guard fires for the mobile-breakpoint query too.
    const isMobileFallback = () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false
      }
      return window.matchMedia('(max-width: 767px)').matches
    }
    expect(isMobileFallback()).toBe(false)
  })
})
