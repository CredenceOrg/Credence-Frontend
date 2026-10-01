import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ROUTE_LABELS } from '../config/navigation'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Delay (ms) between the pathname change and the live-region text update.
 *
 * Rationale: screen readers observe the DOM *after* the browser has committed
 * the new render. Updating the text immediately (0 ms) races with the paint;
 * 100 ms is the established minimum that lets assistive technology cleanly
 * register the structural navigation change before the text update fires.
 *
 * Invariant: this is the *only* place the delay is defined. All tests must
 * import or reference this constant so the invariant is not silently broken
 * by a test that hardcodes a different value.
 */
export const ANNOUNCE_DELAY_MS = 100

/**
 * Maximum safe length for a page label injected into the live region.
 *
 * Invariant: labels beyond this length are truncated with an ellipsis before
 * being set on the live region. This bounds the size of the aria-live
 * announcement and prevents a hostile or accidentally long pathname from
 * bloating the announcement queue that assistive technologies maintain
 * internally.
 */
export const MAX_LABEL_LENGTH = 200

/**
 * Fallback label used when a pathname has no entry in the registry.
 *
 * Invariant: this is always a static string — it never contains user-supplied
 * pathname characters, so a path like `/<script>` can never be echoed into
 * the live region.
 */
export const UNKNOWN_ROUTE_LABEL = 'Page not found'

// ---------------------------------------------------------------------------
// Helpers — pure, side-effect-free, fully testable in isolation
// ---------------------------------------------------------------------------

/**
 * Returns the human-readable page label for a given pathname.
 *
 * Resolution order:
 * 1. Exact match in the label registry (e.g. `/bond`).
 * 2. Parameterised-route match: if the path contains a segment that looks
 *    like a record id (last segment is non-empty and not a known sub-path),
 *    try the parent path. For example `/bond/abc123` → try `/bond` →
 *    "Bond page".  This avoids announcing "Page not found" for known detail
 *    pages whose id is not and cannot be stored in a static registry.
 * 3. Static fallback: `UNKNOWN_ROUTE_LABEL`.
 *
 * Invariants:
 * - The return value is *always* a non-empty string.
 * - Pathname characters are never interpolated verbatim into the return value;
 *   the label always comes from the registry or the static fallback. This
 *   prevents a crafted pathname from injecting arbitrary text into the live
 *   region.
 * - The function is pure: the same inputs always produce the same outputs and
 *   no observable side effects occur.
 */
export function resolvePageLabel(
  pathname: string,
  registry: Record<string, string> = ROUTE_LABELS,
): string {
  // 1. Exact match
  const exact = registry[pathname]
  if (exact) return exact

  // 2. Parameterised-route match: strip the last path segment and retry.
  //    We only strip *once* (one level of nesting) to keep the resolution
  //    deterministic and to avoid silently swallowing deeply-nested unknown
  //    paths. The guard `lastSlash > 0` prevents stripping the root `/`.
  const lastSlash = pathname.lastIndexOf('/')
  if (lastSlash > 0) {
    const parent = pathname.slice(0, lastSlash)
    const parentLabel = registry[parent]
    if (parentLabel) return parentLabel
  }

  // 3. Static fallback — never contains user input
  return UNKNOWN_ROUTE_LABEL
}

/**
 * Clamps a label to `MAX_LABEL_LENGTH` with a trailing ellipsis.
 *
 * Invariant: the returned string is always ≤ `MAX_LABEL_LENGTH` characters.
 */
export function clampLabel(label: string): string {
  if (label.length <= MAX_LABEL_LENGTH) return label
  return label.slice(0, MAX_LABEL_LENGTH - 1) + '…'
}

/**
 * Builds the full announcement string from a page label.
 *
 * Separated from `resolvePageLabel` so the format can be tested and changed
 * independently without touching the resolution logic.
 */
export function buildAnnouncement(label: string): string {
  return `${clampLabel(label)} loaded`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * RouteAnnouncer renders a visually-hidden aria-live region that announces
 * client-side SPA route transitions to screen readers.
 *
 * ## Failure boundaries
 *
 * ### Stale timer / rapid navigation
 * A 100 ms debounce is used so the announcement fires *after* the browser
 * paint. The `useEffect` cleanup cancels any in-flight timer before the next
 * pathname change fires a new one. This means only the *last* navigation in a
 * rapid sequence is announced — the correct behaviour, because the user has
 * already moved past intermediate routes. The `pendingPathnameRef` tracks the
 * pathname that was current when the timer was scheduled; if the timer fires
 * after an unmount, `setState` is a no-op on an unmounted component (React
 * silently drops it). No sentinel ref is needed to guard against post-unmount
 * state updates in React 18+.
 *
 * ### Repeated navigation to the same route
 * React batches state updates; calling `setAnnouncement` with the *same*
 * string as the current state does not trigger a re-render, so the live region
 * content does not change and assistive technology does not re-announce it.
 * To guarantee re-announcement on repeated navigation to the *same* path (e.g.
 * clicking the active nav link), the component first clears the announcement
 * to an empty string, then sets it to the new label after the debounce delay.
 * The clear is synchronous (zero-delay) so it happens on the same React
 * render frame as the pathname change; the re-announce fires 100 ms later.
 *
 * ### Unknown / unmapped routes
 * Unregistered pathnames (including all catch-all routes like `/404` or
 * arbitrary deep paths) resolve to the static `UNKNOWN_ROUTE_LABEL` string.
 * User-supplied pathname characters are *never* interpolated into the
 * announcement, so a crafted path cannot inject arbitrary text into the live
 * region.
 *
 * ### Dynamic route segments (e.g. `/bond/:id`)
 * The `resolvePageLabel` helper attempts a parent-path lookup when an exact
 * match is not found. `/bond/abc123` → `/bond` → "Bond page loaded". This
 * keeps detail-page announcements useful without storing every possible id in
 * the registry.
 *
 * ### ARIA role correctness
 * The container uses `role="status"` (an implicit live region with
 * `aria-live="polite"`) rather than `role="none"`. Applying `role="none"` to
 * a live region is invalid per the ARIA specification and causes some screen
 * readers to silently ignore the live region entirely.
 *
 * ### Label length cap
 * Labels are clamped to `MAX_LABEL_LENGTH` characters before being written to
 * the live region. This bounds the cost of screen-reader announcements and
 * prevents a hostile or accidentally long pathname from bloating the internal
 * announcement queue that assistive technologies maintain.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation()
  const [announcement, setAnnouncement] = React.useState('')
  const lastAnnouncedLabelRef = React.useRef<string | null>(null)

  /**
   * Tracks the pathname that was current when the pending debounce timer was
   * scheduled. Used only for diagnostics — the timer cleanup alone is
   * sufficient to prevent stale announcements, but the ref makes the
   * invariant explicit and self-documenting.
   */
  const pendingPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    // Clear synchronously so that a repeated navigation to the same path
    // (same label → same string → React skips re-render → no live-region
    // change → assistive technology does not re-announce) is reliably
    // re-announced. Clearing first forces the DOM to reflect an empty live
    // region, then the debounced update sets the new text.
    setAnnouncement('')
    pendingPathnameRef.current = pathname

    const timer = setTimeout(() => {
      // By the time the timer fires, `pendingPathnameRef.current` must equal
      // `pathname` (captured in the closure). If a newer effect ran first, its
      // cleanup would have cancelled this timer, so this branch is only reached
      // when pathname is still the most-recently-seen value.
      const label = resolvePageLabel(pathname)
      setAnnouncement(buildAnnouncement(label))
      pendingPathnameRef.current = null
    }, ANNOUNCE_DELAY_MS)

    return () => {
      clearTimeout(timer)
      // The pending announcement has been superseded; reset the tracker so
      // post-cleanup inspection can distinguish "cancelled" from "fired".
      if (pendingPathnameRef.current === pathname) {
        pendingPathnameRef.current = null
      }
    }
  }, [pathname])

  return (
    /*
     * role="status" is an implicit live region role (aria-live="polite",
     * aria-atomic="true"). We keep both the explicit `aria-live` and
     * `aria-atomic` attributes as belt-and-suspenders for assistive
     * technologies that rely on the explicit attributes rather than the
     * implicit role semantics.
     *
     * `aria-relevant="additions text"` limits re-announcements to insertions
     * only, which is the correct behaviour for a route announcer — we do not
     * want removals (e.g. the synchronous clear to '') announced.
     */
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-relevant="additions text"
      className="sr-only"
      data-testid="route-announcer"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {announcement}
    </div>
  )
}
