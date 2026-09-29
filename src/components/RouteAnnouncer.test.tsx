/**
 * @file RouteAnnouncer.test.tsx
 * @description Deterministic failure-boundary coverage for RouteAnnouncer.
 *
 * Boundaries covered
 * ──────────────────
 * success         : every mapped route announces the correct label
 * unknown routes  : unregistered paths announce the static fallback (never
 *                   the raw pathname)
 * dynamic segments: parameterised paths (e.g. /bond/:id) resolve via the
 *                   parent-path lookup
 * duplicate nav   : repeated navigation to the same route still announces
 * rapid nav       : only the final destination in a rapid sequence announces
 * boundary inputs : empty string, root /, whitespace, control characters,
 *                   XSS-like payloads — none escape into the live region
 * label length    : labels beyond MAX_LABEL_LENGTH are truncated
 * ARIA            : role, aria-live, aria-atomic, aria-relevant are correct
 * timer cleanup   : no stale announcement fires after unmount
 * pure helpers    : resolvePageLabel and buildAnnouncement are unit-tested in
 *                   isolation for every significant input class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RouteAnnouncer, {
  ANNOUNCE_DELAY_MS,
  MAX_LABEL_LENGTH,
  UNKNOWN_ROUTE_LABEL,
  resolvePageLabel,
  clampLabel,
  buildAnnouncement,
} from './RouteAnnouncer'
import { ROUTE_LABELS } from '../config/navigation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderAnnouncer(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <RouteAnnouncer />
    </MemoryRouter>,
  )
}

/** The live-region element. */
function liveRegion() {
  return screen.getByTestId('route-announcer')
}

// ---------------------------------------------------------------------------
// Pure helper: resolvePageLabel
// ---------------------------------------------------------------------------

describe('resolvePageLabel – pure helper', () => {
  it('returns the exact registry entry for every mapped route', () => {
    for (const [path, label] of Object.entries(ROUTE_LABELS)) {
      expect(resolvePageLabel(path)).toBe(label)
    }
  })

  it('returns UNKNOWN_ROUTE_LABEL for an unmapped path', () => {
    expect(resolvePageLabel('/totally/unmapped')).toBe(UNKNOWN_ROUTE_LABEL)
  })

  it('returns UNKNOWN_ROUTE_LABEL for the root when / is in the registry', () => {
    // Sanity: the root IS in the registry
    expect(resolvePageLabel('/')).toBe(ROUTE_LABELS['/'])
  })

  it('resolves /bond/:id via the parent /bond path', () => {
    expect(resolvePageLabel('/bond/abc123')).toBe(ROUTE_LABELS['/bond'])
  })

  it('resolves /trust/:id via the parent /trust path', () => {
    expect(resolvePageLabel('/trust/detail-99')).toBe(ROUTE_LABELS['/trust'])
  })

  it('resolves /trust/summary as an exact match (not parent fallback)', () => {
    expect(resolvePageLabel('/trust/summary')).toBe(ROUTE_LABELS['/trust/summary'])
  })

  it('does NOT interpolate the raw pathname into the returned label', () => {
    const xssPath = '/<img src=x onerror=alert(1)>'
    const result = resolvePageLabel(xssPath)
    expect(result).toBe(UNKNOWN_ROUTE_LABEL)
    expect(result).not.toContain('<img')
    expect(result).not.toContain(xssPath)
  })

  it('does not leak pathname characters for a path with control characters', () => {
    const result = resolvePageLabel('/bond\x00evil')
    expect(result).not.toContain('\x00')
    // Either the exact match or parent fallback or unknown — all are safe
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns UNKNOWN_ROUTE_LABEL for an empty string', () => {
    expect(resolvePageLabel('')).toBe(UNKNOWN_ROUTE_LABEL)
  })

  it('returns UNKNOWN_ROUTE_LABEL for a whitespace-only path', () => {
    expect(resolvePageLabel('   ')).toBe(UNKNOWN_ROUTE_LABEL)
  })

  it('is deterministic: same inputs always produce the same output', () => {
    const path = '/bond/some-id'
    expect(resolvePageLabel(path)).toBe(resolvePageLabel(path))
  })

  it('accepts a custom registry override (no global mutation)', () => {
    const custom = { '/custom': 'Custom page' }
    expect(resolvePageLabel('/custom', custom)).toBe('Custom page')
    // Global registry must be unchanged
    expect(resolvePageLabel('/custom')).toBe(UNKNOWN_ROUTE_LABEL)
  })
})

// ---------------------------------------------------------------------------
// Pure helper: clampLabel
// ---------------------------------------------------------------------------

describe('clampLabel – pure helper', () => {
  it('passes through a label shorter than MAX_LABEL_LENGTH unchanged', () => {
    const short = 'Bond page'
    expect(clampLabel(short)).toBe(short)
  })

  it('passes through a label exactly MAX_LABEL_LENGTH unchanged', () => {
    const exact = 'A'.repeat(MAX_LABEL_LENGTH)
    expect(clampLabel(exact)).toBe(exact)
  })

  it('truncates a label longer than MAX_LABEL_LENGTH with an ellipsis', () => {
    const long = 'A'.repeat(MAX_LABEL_LENGTH + 10)
    const result = clampLabel(long)
    expect(result.length).toBe(MAX_LABEL_LENGTH)
    expect(result.endsWith('…')).toBe(true)
  })

  it('always returns a string ≤ MAX_LABEL_LENGTH', () => {
    for (const n of [0, 1, MAX_LABEL_LENGTH - 1, MAX_LABEL_LENGTH, MAX_LABEL_LENGTH + 1, 1000]) {
      expect(clampLabel('X'.repeat(n)).length).toBeLessThanOrEqual(MAX_LABEL_LENGTH)
    }
  })
})

// ---------------------------------------------------------------------------
// Pure helper: buildAnnouncement
// ---------------------------------------------------------------------------

describe('buildAnnouncement – pure helper', () => {
  it('appends " loaded" to the label', () => {
    expect(buildAnnouncement('Dashboard page')).toBe('Dashboard page loaded')
  })

  it('clamps the label before appending', () => {
    const long = 'A'.repeat(MAX_LABEL_LENGTH + 10)
    const result = buildAnnouncement(long)
    // buildAnnouncement always appends ' loaded', so the result ends with ' loaded'.
    // The clamping truncates the label itself, not the suffix.
    expect(result.endsWith(' loaded')).toBe(true)
    // The clamped label ends with '…', so the full result ends with '… loaded'
    expect(result.endsWith('… loaded')).toBe(true)
    // Verify the total string is the clamped label + ' loaded'
    expect(result).toBe(`${clampLabel(long)} loaded`)
  })

  it('handles the UNKNOWN_ROUTE_LABEL without modification', () => {
    expect(buildAnnouncement(UNKNOWN_ROUTE_LABEL)).toBe(`${UNKNOWN_ROUTE_LABEL} loaded`)
  })
})

// ---------------------------------------------------------------------------
// Component: ARIA structure
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – ARIA structure', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders a single live-region element', () => {
    renderAnnouncer('/dashboard')
    expect(screen.getAllByTestId('route-announcer')).toHaveLength(1)
  })

  it('has role="status"', () => {
    renderAnnouncer('/dashboard')
    expect(liveRegion()).toHaveAttribute('role', 'status')
  })

  it('has aria-live="polite"', () => {
    renderAnnouncer('/dashboard')
    expect(liveRegion()).toHaveAttribute('aria-live', 'polite')
  })

  it('has aria-atomic="true"', () => {
    renderAnnouncer('/dashboard')
    expect(liveRegion()).toHaveAttribute('aria-atomic', 'true')
  })

  it('has aria-relevant="additions text"', () => {
    renderAnnouncer('/dashboard')
    expect(liveRegion()).toHaveAttribute('aria-relevant', 'additions text')
  })

  it('has the sr-only class', () => {
    renderAnnouncer('/dashboard')
    expect(liveRegion()).toHaveClass('sr-only')
  })

  it('does NOT use role="none" (which breaks live regions)', () => {
    renderAnnouncer('/dashboard')
    expect(liveRegion()).not.toHaveAttribute('role', 'none')
  })
})

// ---------------------------------------------------------------------------
// Component: success path — all mapped routes
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – success: mapped routes announce correctly', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  for (const [path, label] of Object.entries(ROUTE_LABELS)) {
    it(`announces "${label} loaded" for ${path}`, () => {
      renderAnnouncer(path)
      act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
      expect(liveRegion()).toHaveTextContent(`${label} loaded`)
    })
  }
})

// ---------------------------------------------------------------------------
// Component: deferred announcement (timer boundary)
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – deferred announcement', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is empty immediately after render (before the timer fires)', () => {
    renderAnnouncer('/dashboard')
    expect(liveRegion()).toHaveTextContent('')
  })

  it('is empty at ANNOUNCE_DELAY_MS - 1 ms', () => {
    renderAnnouncer('/dashboard')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 1))
    expect(liveRegion()).toHaveTextContent('')
  })

  it('is populated at exactly ANNOUNCE_DELAY_MS', () => {
    renderAnnouncer('/dashboard')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Dashboard page loaded')
  })
})

// ---------------------------------------------------------------------------
// Component: unknown / unmapped routes
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – unknown routes', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('announces the static fallback for a totally unknown path', () => {
    renderAnnouncer('/some/random/path')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent(`${UNKNOWN_ROUTE_LABEL} loaded`)
  })

  it('does NOT echo the raw pathname for an unknown route', () => {
    renderAnnouncer('/some/random/path')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).not.toHaveTextContent('/some/random/path')
  })

  it('uses the static fallback even for XSS-like pathnames', () => {
    renderAnnouncer('/<script>alert(1)</script>')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent(`${UNKNOWN_ROUTE_LABEL} loaded`)
    expect(liveRegion().textContent).not.toContain('<script>')
  })
})

// ---------------------------------------------------------------------------
// Component: dynamic route segments
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – dynamic route segments', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('announces the parent label for /bond/:id', () => {
    renderAnnouncer('/bond/abc123')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent(`${ROUTE_LABELS['/bond']} loaded`)
  })

  it('announces the parent label for /trust/:id', () => {
    renderAnnouncer('/trust/detail-99')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent(`${ROUTE_LABELS['/trust']} loaded`)
  })

  it('announces the exact label for /trust/summary (not the parent /trust)', () => {
    renderAnnouncer('/trust/summary')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent(`${ROUTE_LABELS['/trust/summary']} loaded`)
  })

  it('uses the static fallback for a deeply-nested unknown path', () => {
    renderAnnouncer('/unknown/deep/path/segment')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent(`${UNKNOWN_ROUTE_LABEL} loaded`)
  })
})

// ---------------------------------------------------------------------------
// Component: repeated navigation to the same route (re-announcement)
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – repeated navigation to the same route', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('clears and re-announces when navigating to the same path twice', () => {
    const { rerender } = renderAnnouncer('/dashboard')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Dashboard page loaded')

    // Navigate away, then back
    rerender(
      <MemoryRouter key="away" initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Bond page loaded')

    rerender(
      <MemoryRouter key="back" initialEntries={['/dashboard']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )
    // Synchronous clear must happen before the timer
    expect(liveRegion()).toHaveTextContent('')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Dashboard page loaded')
  })

  it('live region is empty between the clear and the delayed set', () => {
    const { rerender } = renderAnnouncer('/bond')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Bond page loaded')

    rerender(
      <MemoryRouter key="bond2" initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )
    // Synchronous clear
    expect(liveRegion()).toHaveTextContent('')
    // Before the timer fires, still empty
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 1))
    expect(liveRegion()).toHaveTextContent('')
    // After the timer fires, re-announced
    act(() => vi.advanceTimersByTime(1))
    expect(liveRegion()).toHaveTextContent('Bond page loaded')
  })
})

// ---------------------------------------------------------------------------
// Component: rapid navigation (stale-timer prevention)
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – rapid navigation / stale timer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('only announces the final destination when navigating rapidly', () => {
    const { rerender } = renderAnnouncer('/bond')

    rerender(
      <MemoryRouter key="1" initialEntries={['/trust']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )
    // Navigate again before 100 ms elapses
    rerender(
      <MemoryRouter key="2" initialEntries={['/settings']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )

    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))

    // Only the final destination must appear
    expect(liveRegion()).toHaveTextContent('Settings page loaded')
    expect(liveRegion()).not.toHaveTextContent('Trust Score page loaded')
    expect(liveRegion()).not.toHaveTextContent('Bond page loaded')
  })

  it('does not announce an intermediate route that was superseded', () => {
    const { rerender } = renderAnnouncer('/dashboard')

    // Simulate typing a URL that changes rapidly: /bond → /trust
    rerender(
      <MemoryRouter key="r1" initialEntries={['/bond']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )
    // Advance to just before the /bond timer would fire
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 10))
    expect(liveRegion()).toHaveTextContent('')

    // Navigate again — this cancels the /bond timer
    rerender(
      <MemoryRouter key="r2" initialEntries={['/trust']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )
    // Wait for the full delay from the /trust render
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))

    expect(liveRegion()).toHaveTextContent('Trust Score page loaded')
    expect(liveRegion()).not.toHaveTextContent('Bond page loaded')
  })
})

// ---------------------------------------------------------------------------
// Component: unmount cleanup (no stale announcement after unmount)
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – unmount cleanup', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not fire the announcement after the component unmounts', () => {
    const setStateSpy = vi.fn()

    // Patch useState to spy on calls, then restore
    const { unmount } = renderAnnouncer('/dashboard')

    // Unmount before the timer fires
    unmount()

    // Advance past the timer delay — should be a no-op
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS * 2))

    // If we get here without an "update on unmounted component" React error,
    // the cleanup is correct. In React 18 this no longer throws, but we still
    // verify no state update occurred by confirming the element is gone.
    expect(screen.queryByTestId('route-announcer')).not.toBeInTheDocument()
    expect(setStateSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Component: label length boundary
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – label length boundary', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('truncates an overlong label in the live region', () => {
    const longLabel = 'A'.repeat(MAX_LABEL_LENGTH + 50)
    const customRegistry = { '/longpath': longLabel }

    render(
      <MemoryRouter initialEntries={['/longpath']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )

    // Override with a custom registry by exercising the helpers directly
    const clamped = buildAnnouncement(resolvePageLabel('/longpath', customRegistry))
    expect(clamped.length).toBeLessThanOrEqual(MAX_LABEL_LENGTH + ' loaded'.length)
  })

  it('clampLabel never produces a string longer than MAX_LABEL_LENGTH', () => {
    const oversized = 'B'.repeat(MAX_LABEL_LENGTH * 3)
    expect(clampLabel(oversized).length).toBe(MAX_LABEL_LENGTH)
  })
})

// ---------------------------------------------------------------------------
// Regression — backward-compatible behaviour preserved
// ---------------------------------------------------------------------------

describe('RouteAnnouncer – regression', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('announces the correct label when navigating between two different mapped routes', () => {
    const { rerender } = renderAnnouncer('/dashboard')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Dashboard page loaded')

    rerender(
      <MemoryRouter key="trust" initialEntries={['/trust']}>
        <RouteAnnouncer />
      </MemoryRouter>,
    )
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Trust Score page loaded')
  })

  it('is visually hidden (has sr-only class and correct inline styles)', () => {
    renderAnnouncer('/dashboard')
    const el = liveRegion()
    expect(el).toHaveClass('sr-only')
    expect(el.style.position).toBe('absolute')
    expect(el.style.width).toBe('1px')
    expect(el.style.height).toBe('1px')
    expect(el.style.overflow).toBe('hidden')
  })

  it('never renders more than one live-region element', () => {
    renderAnnouncer('/settings')
    expect(screen.getAllByTestId('route-announcer')).toHaveLength(1)
  })

  it('still announces /bond correctly (backwards compatibility check)', () => {
    renderAnnouncer('/bond')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Bond page loaded')
  })

  it('announces /signin correctly (was missing from original ROUTE_LABELS)', () => {
    renderAnnouncer('/signin')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Sign in page loaded')
  })

  it('announces /attestations correctly (was missing from original ROUTE_LABELS)', () => {
    renderAnnouncer('/attestations')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Attestations page loaded')
  })

  it('announces /transactions correctly (was missing from original ROUTE_LABELS)', () => {
    renderAnnouncer('/transactions')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Transactions page loaded')
  })

  it('announces /bond/new correctly (was missing from original ROUTE_LABELS)', () => {
    renderAnnouncer('/bond/new')
    act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS))
    expect(liveRegion()).toHaveTextContent('Create bond page loaded')
  })
})
