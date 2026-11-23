import { useScrollToTop } from '../hooks/useScrollToTop'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { logDebug } from '../lib/log'
import './BackToTop.css'

/**
 * BackToTop is a purely presentational + imperative control: no network, no
 * async work, no internal state beyond the two hooks it reads. Its failure
 * surface is therefore the set of environment faults in B1–B4 rather than the
 * loading/error/retry/stale/permission states the originating issue template
 * assumes; each real fault is exercised instead of being simulated.
 *
 * Invariants, each enforced by `BackToTop.failure-boundary.test.tsx`:
 *
 * B1. **A click never throws.** Every DOM and window call the handler makes is
 *     individually guarded, so a hostile or partially-implemented environment
 *     degrades the control rather than producing an unhandled error.
 * B2. **Scrolling is best-effort; focus is not.** The two steps are
 *     independent. A `scrollTo` failure must never cost the user their focus
 *     placement, because focus is the accessibility-critical half of the
 *     control — it is what moves the next Tab from the top of the document.
 * B3. **Focus always lands somewhere reachable when `#main-content` exists.**
 *     The preferred target is its first `h1`; if the main region has no `h1`,
 *     the main region itself is focused instead. Without this fallback a page
 *     whose main region holds no heading left focus stranded on a control that
 *     had just moved the viewport, with no predictable next stop.
 * B4. **Focus does not scroll.** `preventScroll` keeps the focus move from
 *     fighting the explicit scroll; a bare `focus()` retry is the documented
 *     fallback for engines that reject the options object.
 * B5. **No attribute is clobbered.** `tabindex` is only ever *added* when
 *     absent, so an author-provided tab order survives repeated clicks.
 * B6. **No sensitive data reaches the log.** Only the event name and the
 *     *class* of a thrown value are recorded — never its message, which for a
 *     DOM exception can echo page content or selectors. Success is logged only
 *     when a `focus()` call actually completed, so the log never claims a focus
 *     move the environment refused. The logger also scrubs secret-like fields
 *     independently.
 */

const MAIN_CONTENT_ID: string = 'main-content'
const HEADING_SELECTOR: string = 'h1'
const FALLBACK_TABINDEX: string = '-1'

/** Which element a given click focused, for diagnostics only. */
type FocusTargetKind = 'heading' | 'main'

/**
 * Reduces a thrown value to a non-sensitive label.
 *
 * `String(err)` would be more informative but can carry selector text, page
 * content or URL fragments, which is exactly what must not be logged. The
 * constructor name is enough to tell a `TypeError` apart from a `DOMException`.
 */
function errorKind(err: unknown): string {
  if (err instanceof Error) return err.name
  if (typeof err === 'string') return 'string'
  if (err === null) return 'null'
  return typeof err
}

function getMainContent(): HTMLElement | null {
  try {
    return document.getElementById(MAIN_CONTENT_ID)
  } catch (err: unknown) {
    logDebug('back-to-top.main-lookup-failed', { kind: errorKind(err) })
    return null
  }
}

function getHeading(main: HTMLElement): HTMLElement | null {
  try {
    return main.querySelector<HTMLElement>(HEADING_SELECTOR)
  } catch (err: unknown) {
    logDebug('back-to-top.heading-lookup-failed', { kind: errorKind(err) })
    return null
  }
}

function scrollToTop(behavior: ScrollBehavior): void {
  try {
    window.scrollTo({ top: 0, behavior: behavior })
  } catch (err: unknown) {
    // Never let a scroll failure break the click handler (B1), and never let it
    // abort the focus move (B2).
    logDebug('back-to-top.scroll-failed', { kind: errorKind(err) })
  }
}

/**
 * Makes a target focusable, additively.
 *
 * `setAttribute` is guarded like every other DOM call here: in a hardened or
 * locked-down document it can throw, and that must not escape the click handler
 * (B1). An author-provided tabindex is never touched (B5).
 */
function ensureFocusable(target: HTMLElement): void {
  if (target.hasAttribute('tabindex')) return
  try {
    target.setAttribute('tabindex', FALLBACK_TABINDEX)
  } catch (err: unknown) {
    // Focus may still succeed (many elements are focusable programmatically),
    // so record the fault and continue rather than abandoning the focus move.
    logDebug('back-to-top.tabindex-failed', { kind: errorKind(err) })
  }
}

/**
 * Attempts the focus move, reporting whether it actually landed.
 *
 * Returns `true` only when a `focus()` call completed without throwing, so the
 * caller can log success honestly instead of claiming a focus move that the
 * environment refused (observability requirement: every failure path leaves a
 * trace, and success is only reported when it happened).
 */
function focusHeading(target: HTMLElement): boolean {
  ensureFocusable(target)
  try {
    target.focus({ preventScroll: true })
    return true
  } catch {
    // Some test environments / browsers may not support the options object.
    // Fall back to a plain focus so the accessibility goal is still met (B4).
    try {
      target.focus()
      return true
    } catch (err: unknown) {
      // Focus is entirely unsupported: give up quietly but leave a trace.
      logDebug('back-to-top.focus-failed', { kind: errorKind(err) })
      return false
    }
  }
}

/**
 * Picks the element focus should land on: the main region's first `h1`, or the
 * main region itself when it has none (B3). Returns `null` only when the main
 * region is absent, which is the one case where there is nothing to focus.
 */
function resolveFocusTarget(): { el: HTMLElement | null; kind: FocusTargetKind } {
  const main = getMainContent()
  if (!main) return { el: null, kind: 'main' }
  const heading = getHeading(main)
  if (heading) return { el: heading, kind: 'heading' }
  return { el: main, kind: 'main' }
}

export default function BackToTop() {
  const visible = useScrollToTop()
  const reducedMotion = useReducedMotion()

  if (!visible) return null

  const handleClick = () => {
    scrollToTop(reducedMotion ? 'auto' : 'smooth')

    const { el, kind } = resolveFocusTarget()
    if (!el) {
      logDebug('back-to-top.focus-skipped', { reason: 'main-content-missing' })
      return
    }
    if (focusHeading(el)) logDebug('back-to-top.focus-applied', { target: kind })
  }

  return (
    <button type="button" className="back-to-top" aria-label="Back to top" onClick={handleClick}>
      <svg
        className="back-to-top__icon"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 4L4 12M12 4L20 12M12 4V20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="back-to-top__label">Back to top</span>
    </button>
  )
}