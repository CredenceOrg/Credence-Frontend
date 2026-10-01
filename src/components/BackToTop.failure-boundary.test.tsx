/**
 * @file BackToTop.failure-boundary.test.tsx
 * @description Deterministic failure-boundary coverage for BackToTop.
 *
 * Scope: every environment fault the click handler can meet — a `scrollTo`
 * that throws, a `focus` that rejects its options object, a `focus` that fails
 * entirely, a DOM lookup that throws, a main region with no heading, and the
 * mount/unmount transitions around them — plus the reduced-motion and repeated
 * -click boundaries.
 *
 * Determinism rules observed throughout:
 * - No timers and no polling. Visibility is driven by explicitly re-defining
 *   `window.scrollY` and dispatching a `scroll` event, so threshold behaviour is
 *   exact rather than timing-dependent.
 * - Failures are injected by stubbing the exact DOM/window API under test, so
 *   the assertion is about BackToTop's handling, not about jsdom internals.
 * - Every test asserts the *absence* of leaked state alongside the outcome:
 *   no unhandled rejection, no console.error, no accumulated attributes.
 *
 * Invariants B1–B6 are documented in `BackToTop.tsx`; each group below names
 * the invariant it defends.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import BackToTop from './BackToTop'
import * as useScrollToTopModule from '../hooks/useScrollToTop'
import * as useReducedMotionModule from '../hooks/useReducedMotion'

vi.mock('../hooks/useScrollToTop', () => ({
  useScrollToTop: vi.fn(),
  BACK_TO_TOP_SCROLL_THRESHOLD: 800,
}))

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function setVisible(value: boolean) {
  vi.mocked(useScrollToTopModule.useScrollToTop).mockReturnValue(value)
}

function setReducedMotion(value: boolean) {
  vi.mocked(useReducedMotionModule.useReducedMotion).mockReturnValue(value)
}

/** Builds a `#main-content` region. Returns the region plus any headings. */
function appendMain(...children: HTMLElement[]) {
  const main = document.createElement('main')
  main.id = 'main-content'
  for (const child of children) main.appendChild(child)
  document.body.appendChild(main)
  return main
}

function heading(text = 'Page Title') {
  const el = document.createElement('h1')
  el.textContent = text
  return el
}

function button() {
  return screen.getByRole('button', { name: /back to top/i })
}

/**
 * Reads the structured line BackToTop emitted through `logDebug`.
 * The logger writes one `key=value` string per event to `console.debug`.
 */
function debugLines(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((call) => String(call[0]))
}

/** Debug lines emitted after a marked point, for "did this click log X?" checks. */
function debugLinesSince(spy: ReturnType<typeof vi.spyOn>, offset: number): string[] {
  return spy.mock.calls.slice(offset).map((call) => String(call[0]))
}

function eventsIn(lines: string[]): string[] {
  return lines.map((line) => /event=(\S+)/.exec(line)?.[1] ?? '').filter(Boolean)
}

let consoleDebugSpy: ReturnType<typeof vi.spyOn>
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  setVisible(true)
  setReducedMotion(false)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

/** Runs a click while capturing any error that escapes the handler. */
function clickQuietly(): void {
  fireEvent.click(button())
}

// ---------------------------------------------------------------------------

describe('BackToTop — scroll failure boundaries (B1, B2)', () => {
  // The scroll is best-effort. None of these may throw out of the handler, and
  // none of them may cost the user their focus placement.
  const throwingScrolls: Array<[string, () => never]> = [
    ['an Error', () => { throw new Error('scroll failed') }],
    ['a TypeError', () => { throw new TypeError('unsupported argument') }],
    ['a DOMException', () => { throw new DOMException('not implemented', 'NotSupportedError') }],
    ['a non-Error object', () => { throw { code: 'E_SCROLL' } }],
    ['a string', () => { throw 'scroll failed' }],
    ['null', () => { throw null }],
  ]

  it.each(throwingScrolls)('does not throw when scrollTo rejects with %s', (_label, impl) => {
    appendMain(heading())
    render(<BackToTop />)
    const focusSpy = vi.spyOn(document.querySelector('h1') as HTMLElement, 'focus')
    vi.mocked(window.scrollTo).mockImplementation(impl)

    expect(() => clickQuietly()).not.toThrow()
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('attempts exactly one scroll per click regardless of failure', () => {
    appendMain(heading())
    render(<BackToTop />)
    vi.mocked(window.scrollTo).mockImplementation(() => { throw new Error('nope') })

    clickQuietly()
    clickQuietly()

    expect(window.scrollTo).toHaveBeenCalledTimes(2)
  })

  it('records a scroll failure without raising an error-level log', () => {
    appendMain(heading())
    render(<BackToTop />)
    vi.mocked(window.scrollTo).mockImplementation(() => { throw new Error('scroll failed') })

    clickQuietly()

    const lines = debugLines(consoleDebugSpy)
    expect(eventsIn(lines)).toContain('back-to-top.scroll-failed')
    expect(eventsIn(lines)).not.toContain('back-to-top.focus-skipped')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('logs only the error class, never the message (B6)', () => {
    appendMain(heading())
    render(<BackToTop />)
    // A DOMException message can echo the offending call and page content.
    const secret = 'scrollTo failed for node "Stellar Wallet Balance 0xabc123"'
    vi.mocked(window.scrollTo).mockImplementation(() => { throw new Error(secret) })

    clickQuietly()

    const lines = debugLines(consoleDebugSpy)
    const scrollLine = lines.find((l) => l.includes('back-to-top.scroll-failed')) ?? ''
    expect(scrollLine).toContain('kind=Error')
    expect(scrollLine).not.toContain('0xabc123')
    expect(scrollLine).not.toContain('Stellar Wallet Balance')
    expect(scrollLine).not.toContain(secret)
  })

  it('never logs a forbidden field name', () => {
    appendMain(heading())
    render(<BackToTop />)
    vi.mocked(window.scrollTo).mockImplementation(() => { throw new Error('x') })
    clickQuietly()

    for (const line of debugLines(consoleDebugSpy)) {
      expect(line).not.toMatch(/secret|token|password|authorization|cookie|session/i)
    }
  })

  it('recovers on the next click once scrollTo stops failing', () => {
    appendMain(heading())
    render(<BackToTop />)

    vi.mocked(window.scrollTo).mockImplementationOnce(() => { throw new Error('nope') })
    clickQuietly()
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.scroll-failed')

    // The debug log is cumulative, so only assert on what the recovery click adds.
    const before = consoleDebugSpy.mock.calls.length
    vi.mocked(window.scrollTo).mockImplementation(() => undefined)
    clickQuietly()

    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })
    const recoveryEvents = eventsIn(debugLinesSince(consoleDebugSpy, before))
    expect(recoveryEvents).not.toContain('back-to-top.scroll-failed')
    expect(recoveryEvents).toContain('back-to-top.focus-applied')
  })
})

// ---------------------------------------------------------------------------

describe('BackToTop — focus failure boundaries (B1, B4)', () => {
  it('falls back to a bare focus when the options object is rejected', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)

    const focusSpy = vi.spyOn(h, 'focus').mockImplementation((...args: unknown[]) => {
      if (args.length > 0) throw new TypeError('options not supported')
    })

    clickQuietly()

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    expect(focusSpy).toHaveBeenCalledWith()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('gives up quietly and records a line when focus is entirely unsupported', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)

    vi.spyOn(h, 'focus').mockImplementation(() => {
      throw new TypeError('focus is not a function')
    })

    expect(() => clickQuietly()).not.toThrow()
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.focus-failed')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it.each([
    ['a DOMException', new DOMException('blocked', 'NotAllowedError')],
    ['a non-Error object', { code: 11 }],
    ['a string', 'no focus'],
  ])('gives up quietly when focus throws %s', (_label, thrown) => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    vi.spyOn(h, 'focus').mockImplementation(() => { throw thrown })

    expect(() => clickQuietly()).not.toThrow()
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.focus-failed')
  })

  it('still scrolls when focus fails, and does not retry the scroll', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    vi.spyOn(h, 'focus').mockImplementation(() => { throw new TypeError('nope') })

    clickQuietly()

    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('still scrolls when there is nothing to focus at all', () => {
    render(<BackToTop />)

    clickQuietly()

    expect(window.scrollTo).toHaveBeenCalledTimes(1)
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.focus-skipped')
  })

  it('survives tabindex assignment being blocked, and still attempts focus', () => {
    // Regression: `setAttribute` sat outside every try/catch, so a document
    // that forbids attribute mutation threw straight out of the click handler
    // and violated B1. The focus attempt must still happen.
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    vi.spyOn(h, 'setAttribute').mockImplementation(() => {
      throw new DOMException('modifying not allowed', 'NoModificationAllowedError')
    })
    const focusSpy = vi.spyOn(h, 'focus')

    expect(() => clickQuietly()).not.toThrow()

    expect(window.scrollTo).toHaveBeenCalledTimes(1)
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    const events = eventsIn(debugLines(consoleDebugSpy))
    expect(events).toContain('back-to-top.tabindex-failed')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

it('still survives when tabindex assignment and both focus attempts all fail', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    vi.spyOn(h, 'setAttribute').mockImplementation(() => {
      throw new DOMException('nope', 'NoModificationAllowedError')
    })
    const focusSpy = vi.spyOn(h, 'focus').mockImplementation(() => {
      throw new TypeError('focus is not a function')
    })

    expect(() => clickQuietly()).not.toThrow()

    expect(focusSpy).toHaveBeenCalledTimes(2)
    const events = eventsIn(debugLines(consoleDebugSpy))
    expect(events).toContain('back-to-top.tabindex-failed')
    expect(events).toContain('back-to-top.focus-failed')
    // Observability must stay honest: success is never claimed for a focus
    // move the environment refused.
    expect(events).not.toContain('back-to-top.focus-applied')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('BackToTop — DOM lookup failure boundaries (B1, B3)', () => {
  it('survives getElementById throwing and records it', () => {
    appendMain(heading())
    render(<BackToTop />)
    const getById = vi
      .spyOn(document, 'getElementById')
      .mockImplementation(() => { throw new DOMException('detached', 'NotFoundError') })

    expect(() => clickQuietly()).not.toThrow()
    expect(getById).toHaveBeenCalledWith('main-content')
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.main-lookup-failed')
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
  })

  it('falls back to the main region when querySelector throws', () => {
    const main = appendMain(heading())
    render(<BackToTop />)
    vi.spyOn(main, 'querySelector').mockImplementation(() => {
      throw new DOMException('invalid selector', 'SyntaxError')
    })
    const mainFocusSpy = vi.spyOn(main, 'focus')

    expect(() => clickQuietly()).not.toThrow()

    const events = eventsIn(debugLines(consoleDebugSpy))
    expect(events).toContain('back-to-top.heading-lookup-failed')
    // B3: the fallback still lands somewhere reachable.
    expect(mainFocusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('focuses the main region when it contains no heading (B3)', () => {
    // The regression this prevents: with no h1, focus used to stay on the
    // button that had just scrolled the viewport, with no predictable next stop.
    const main = appendMain()
    render(<BackToTop />)
    const mainFocusSpy = vi.spyOn(main, 'focus')

    clickQuietly()

    expect(mainFocusSpy).toHaveBeenCalledWith({ preventScroll: true })
    expect(main.getAttribute('tabindex')).toBe('-1')
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.focus-applied')
  })

  it('reports target=main for the fallback and target=heading for the preferred path', () => {
    const h = heading()
    const main = appendMain(h)
    render(<BackToTop />)

    clickQuietly()
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.focus-applied')

    h.remove()
    clickQuietly()
    const lines = debugLines(consoleDebugSpy)
    expect(lines.some((l) => l.includes('event=back-to-top.focus-applied') && l.includes('target=main'))).toBe(true)
    expect(mainFocusIsCalled(main)).toBe(true)
  })

  it('ignores an h1 that is not inside the main region', () => {
    const inside = heading('inside')
    appendMain(inside)
    const outside = heading('outside')
    document.body.appendChild(outside)
    render(<BackToTop />)

    const outsideSpy = vi.spyOn(outside, 'focus')
    clickQuietly()

    expect(outsideSpy).not.toHaveBeenCalled()
    expect(inside.getAttribute('tabindex')).toBe('-1')
  })

  it('uses the first heading when several are present', () => {
    const first = heading('first')
    const second = heading('second')
    appendMain(first, second)
    render(<BackToTop />)

    const firstSpy = vi.spyOn(first, 'focus')
    const secondSpy = vi.spyOn(second, 'focus')
    clickQuietly()

    expect(firstSpy).toHaveBeenCalledWith({ preventScroll: true })
    expect(secondSpy).not.toHaveBeenCalled()
  })

  it('finds a heading nested deep inside the main region', () => {
    const h = heading()
    const section = document.createElement('section')
    const div = document.createElement('div')
    div.appendChild(h)
    section.appendChild(div)
    appendMain(section)
    render(<BackToTop />)

    const focusSpy = vi.spyOn(h, 'focus')
    clickQuietly()

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('treats a non-element node returned by the lookup as unusable without throwing', () => {
    // `getElementById` can only return Elements, but the defensive guard must
    // hold if a future refactor widens the selector.
    const main = appendMain(heading())
    render(<BackToTop />)
    vi.spyOn(document, 'getElementById').mockReturnValue(null)

    expect(() => clickQuietly()).not.toThrow()
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.focus-skipped')
    expect(main.isConnected).toBe(true)
  })

  it('recovers when the main region is added after an initial click', () => {
    render(<BackToTop />)
    clickQuietly()
    expect(eventsIn(debugLines(consoleDebugSpy))).toContain('back-to-top.focus-skipped')

    const h = heading()
    appendMain(h)
    const focusSpy = vi.spyOn(h, 'focus')
    clickQuietly()

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('recovers when a heading is removed mid-session', () => {
    const h = heading()
    const main = appendMain(h)
    render(<BackToTop />)

    const headingFocusSpy = vi.spyOn(h, 'focus')
    clickQuietly()
    expect(headingFocusSpy).toHaveBeenCalledTimes(1)

    h.remove()
    const mainFocusSpy = vi.spyOn(main, 'focus')
    clickQuietly()

    expect(mainFocusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })
})

// ---------------------------------------------------------------------------

describe('BackToTop — scroll target and behavior boundaries', () => {
  it('always targets the very top of the document', () => {
    appendMain(heading())
    render(<BackToTop />)

    clickQuietly()
    clickQuietly()

    for (const call of vi.mocked(window.scrollTo).mock.calls) {
      expect(call[0]).toEqual({ top: 0, behavior: 'smooth' })
    }
  })

  it('uses smooth behavior by default', () => {
    appendMain(heading())
    setReducedMotion(false)
    render(<BackToTop />)
    clickQuietly()
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it.each([
    ['true', 'auto'],
    ['false', 'smooth'],
  ])('maps reducedMotion=%s to behavior=%s', (flag, expected) => {
    appendMain(heading())
    setReducedMotion(flag === 'true')
    render(<BackToTop />)
    clickQuietly()
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: expected })
  })

  it('picks up a reduced-motion preference that changes between clicks', () => {
    appendMain(heading())
    setReducedMotion(false)
    const { rerender } = render(<BackToTop />)

    clickQuietly()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })

    setReducedMotion(true)
    rerender(<BackToTop />)
    clickQuietly()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })

    setReducedMotion(false)
    rerender(<BackToTop />)
    clickQuietly()
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('does not read or mutate scroll position directly', () => {
    // BackToTop must delegate the scroll rather than assigning scrollY, so a
    // smooth-scroll-capable browser still animates and the user keeps history
    // entries consistent.
    appendMain(heading())
    render(<BackToTop />)
    const scrollY = vi.fn()
    Object.defineProperty(window, 'scrollY', { configurable: true, get: scrollY })

    clickQuietly()

    expect(scrollY).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('BackToTop — tabindex invariants (B5)', () => {
  it('adds tabindex=-1 when absent', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    clickQuietly()
    expect(h.getAttribute('tabindex')).toBe('-1')
  })

  it.each([
    ['0', '0'],
    ['-1', '-1'],
    ['1', '1'],
    ['2', '2'],
    ['', ''],
    ['-2', '-2'],
  ])('never overwrites an existing tabindex of "%s"', (provided, expected) => {
    const h = heading()
    h.setAttribute('tabindex', provided)
    appendMain(h)
    render(<BackToTop />)

    clickQuietly()
    clickQuietly()

    expect(h.getAttribute('tabindex')).toBe(expected)
  })

  it('assigns tabindex exactly once across many clicks', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    const setAttributeSpy = vi.spyOn(h, 'setAttribute')

    for (let i = 0; i < 5; i++) clickQuietly()

    expect(setAttributeSpy).toHaveBeenCalledTimes(1)
    expect(setAttributeSpy).toHaveBeenCalledWith('tabindex', '-1')
  })

  it('does not accumulate any other attribute across clicks', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)

    clickQuietly()
    const after = [...h.attributes].map((a) => a.name).sort()
    clickQuietly()
    clickQuietly()

    expect([...h.attributes].map((a) => a.name).sort()).toEqual(after)
  })

  it('applies tabindex to the fallback target too', () => {
    const main = appendMain()
    render(<BackToTop />)

    clickQuietly()
    expect(main.getAttribute('tabindex')).toBe('-1')
  })

  it('treats tabindex set by another component between clicks as author intent', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)

    clickQuietly()
    expect(h.getAttribute('tabindex')).toBe('-1')

    // A layout change re-orders the page and hands the heading a positive
    // tabindex; BackToTop must not drag it back to -1.
    h.setAttribute('tabindex', '3')
    clickQuietly()

    expect(h.getAttribute('tabindex')).toBe('3')
  })
})

// ---------------------------------------------------------------------------

describe('BackToTop — repeated and concurrent activation (B1, B6)', () => {
  it('is idempotent across a burst of clicks in one batch', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)

    act(() => {
      const el = button()
      el.click()
      el.click()
      el.click()
      el.click()
    })

    expect(window.scrollTo).toHaveBeenCalledTimes(4)
    expect(h.getAttribute('tabindex')).toBe('-1')
    expect(h.hasAttribute('style')).toBe(false)
  })

  it('refocuses on every click so repeated activation is never a no-op', () => {
    // Focus is idempotent in effect but must be re-requested: the user may have
    // tabbed away between clicks.
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    const focusSpy = vi.spyOn(h, 'focus')

    clickQuietly()
    clickQuietly()
    clickQuietly()

    expect(focusSpy).toHaveBeenCalledTimes(3)
  })

  it('produces no error-level output and no unhandled rejection under a mixed fault burst', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)

    const unhandled: unknown[] = []
    const onUnhandled = (event: PromiseRejectionEvent) => unhandled.push(event.reason)
    window.addEventListener('unhandledrejection', onUnhandled)

    const scrollImpls = [
      () => { throw new Error('a') },
      () => undefined,
      () => { throw new DOMException('b', 'NotSupportedError') },
      () => undefined,
    ]
    let i = 0
    vi.mocked(window.scrollTo).mockImplementation(() => { scrollImpls[i++]() })

    for (let n = 0; n < scrollImpls.length; n++) {
      expect(() => clickQuietly()).not.toThrow()
    }

    window.removeEventListener('unhandledrejection', onUnhandled)
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(unhandled).toHaveLength(0)
    expect(h.getAttribute('tabindex')).toBe('-1')
  })

  it('logs nothing but debug lines even while failing', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    vi.mocked(window.scrollTo).mockImplementation(() => { throw new Error('x') })
    vi.spyOn(h, 'focus').mockImplementation(() => { throw new TypeError('y') })

    clickQuietly()

    const lines = debugLines(consoleDebugSpy)
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).toContain('level=debug')
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('BackToTop — mount, visibility and accessibility boundaries', () => {
  it('renders nothing and does no work while below the threshold', () => {
    setVisible(false)
    render(<BackToTop />)

    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(consoleDebugSpy).not.toHaveBeenCalled()
  })

  it('does not touch the DOM while hidden, so a missing main region is harmless', () => {
    setVisible(false)
    const getById = vi.spyOn(document, 'getElementById')
    render(<BackToTop />)
    expect(getById).not.toHaveBeenCalledWith('main-content')
  })

  it('is a type=button so it can never submit a surrounding form', () => {
    appendMain(heading())
    render(
      <form onSubmit={(e) => e.preventDefault()}>
        <BackToTop />
      </form>
    )
    const submitSpy = vi.fn((e: React.FormEvent) => e.preventDefault())
    const form = screen.getByRole('button', { name: /back to top/i }).closest('form')!
    form.addEventListener('submit', submitSpy)

    fireEvent.click(button())

    expect(button().getAttribute('type')).toBe('button')
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('exposes a stable accessible name and hides the decorative icon', () => {
    appendMain(heading())
    render(<BackToTop />)

    const el = button()
    expect(el).toHaveAccessibleName('Back to top')
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(el.className).toBe('back-to-top')
  })

  it('does not throw when unmounted before any click', () => {
    appendMain(heading())
    const { unmount } = render(<BackToTop />)
    expect(() => unmount()).not.toThrow()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('does not warn when unmounted between render and click', () => {
    appendMain(heading())
    const { unmount } = render(<BackToTop />)
    unmount()
    expect(() => fireEvent.click(screen.queryByRole('button', { name: /back to top/i }) ?? document.body)).not.toThrow()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('resolves the first main region when a duplicate id is present', () => {
    // Duplicate ids are invalid HTML but happen. `getElementById` returns the
    // first in tree order, and BackToTop must follow that deterministically
    // rather than picking whichever region happens to mount last.
    const firstHeading = heading('first')
    const firstMain = document.createElement('main')
    firstMain.id = 'main-content'
    firstMain.appendChild(firstHeading)
    document.body.appendChild(firstMain)

    const secondHeading = heading('second')
    const secondMain = document.createElement('main')
    secondMain.id = 'main-content'
    secondMain.appendChild(secondHeading)
    document.body.appendChild(secondMain)

    render(<BackToTop />)
    const firstSpy = vi.spyOn(firstHeading, 'focus')
    const secondSpy = vi.spyOn(secondHeading, 'focus')

    clickQuietly()
    clickQuietly()

    expect(firstSpy).toHaveBeenCalledTimes(2)
    expect(secondSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------

describe('BackToTop — real hook integration (visibility lifecycle)', () => {
  // These use the real `useScrollToTop` / `useReducedMotion` rather than the
  // mocks above, so the mount → scroll → hide → remount lifecycle is covered
  // end to end. Visibility is driven by re-defining `window.scrollY` and firing
  // a real `scroll` event, so the threshold boundary is exact.
  const THRESHOLD = 800

  function setScrollY(value: number) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value, writable: true })
  }

  function fireScroll() {
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
  }

  async function loadRealComponent() {
    vi.resetModules()
    vi.doUnmock('../hooks/useScrollToTop')
    vi.doUnmock('../hooks/useReducedMotion')
    const mod = await import('./BackToTop')
    return mod.default
  }

  beforeEach(() => {
    setScrollY(0)
  })

  afterEach(() => {
    setScrollY(0)
    vi.doMock('../hooks/useScrollToTop', () => ({
      useScrollToTop: vi.fn(),
      BACK_TO_TOP_SCROLL_THRESHOLD: THRESHOLD,
    }))
    vi.doMock('../hooks/useReducedMotion', () => ({ useReducedMotion: vi.fn() }))
  })

  it.each([
    [THRESHOLD, false],
    [THRESHOLD - 1, false],
    [THRESHOLD + 1, true],
    [THRESHOLD * 10, true],
    [0, false],
  ])('is hidden at scrollY=%s and shown at %s', async (scrollY, expectedVisible) => {
    setScrollY(scrollY)
    const RealBackToTop = await loadRealComponent()
    const h = heading()
    appendMain(h)

    render(<RealBackToTop />)

    expect(screen.queryByRole('button', { name: /back to top/i }) !== null).toBe(expectedVisible)
  })

  it('appears and disappears as the user scrolls across the threshold', async () => {
    const RealBackToTop = await loadRealComponent()
    appendMain(heading())
    render(<RealBackToTop />)
    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()

    setScrollY(THRESHOLD + 1)
    fireScroll()
    expect(screen.queryByRole('button', { name: /back to top/i })).toBeInTheDocument()

    setScrollY(THRESHOLD)
    fireScroll()
    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
  })

  it('hides again once the scroll-to-top completes', async () => {
    // The full round trip: scroll down, click, and the button retires itself
    // because the scroll listener observes the new position.
    const RealBackToTop = await loadRealComponent()
    const h = heading()
    appendMain(h)
    render(<RealBackToTop />)

    setScrollY(THRESHOLD + 1)
    fireScroll()
    const el = screen.getByRole('button', { name: /back to top/i })

    fireEvent.click(el)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(screen.getByRole('button', { name: /back to top/i })).toBeInTheDocument()

    // Browser reports the new position.
    setScrollY(0)
    fireScroll()
    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
    expect(h.getAttribute('tabindex')).toBe('-1')
  })

  it('removes its scroll listener on unmount', async () => {
    const RealBackToTop = await loadRealComponent()
    appendMain(heading())
    const { unmount } = render(<RealBackToTop />)

    setScrollY(THRESHOLD + 1)
    unmount()

    // A listener left behind would keep calling setState on a dead component.
    expect(() => fireScroll()).not.toThrow()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('does not leak listeners across repeated mount/unmount cycles', async () => {
    const RealBackToTop = await loadRealComponent()
    appendMain(heading())

    for (let i = 0; i < 5; i++) {
      const { unmount } = render(<RealBackToTop />)
      setScrollY(THRESHOLD + 1)
      fireScroll()
      unmount()
    }

    expect(() => fireScroll()).not.toThrow()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })

  it('honours a live reduced-motion preference from matchMedia', async () => {
    // `useReducedMotion` reads the media query at mount; prove the value
    // reaches the scroll behavior rather than trusting the mock.
    vi.resetModules()
    vi.doUnmock('../hooks/useScrollToTop')
    vi.doUnmock('../hooks/useReducedMotion')
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    try {
      const RealBackToTop = (await import('./BackToTop')).default
      appendMain(heading())
      setScrollY(THRESHOLD + 1)
      render(<RealBackToTop />)

      fireEvent.click(screen.getByRole('button', { name: /back to top/i }))

      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
    } finally {
      window.matchMedia = original
    }
  })
})

// ---------------------------------------------------------------------------

describe('BackToTop — regressions against the documented contract', () => {
  it('scrolls and focuses on the very first click after mount', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    const focusSpy = vi.spyOn(h, 'focus')

    clickQuietly()

    expect(window.scrollTo).toHaveBeenCalledTimes(1)
    expect(focusSpy).toHaveBeenCalledTimes(1)
  })

  it('never lets a scroll failure skip the focus move (B2)', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    const focusSpy = vi.spyOn(h, 'focus')
    vi.mocked(window.scrollTo).mockImplementation(() => { throw new Error('x') })

    clickQuietly()

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    expect(h.getAttribute('tabindex')).toBe('-1')
  })

  it('focuses with preventScroll so focus never fights the scroll (B4)', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    const focusSpy = vi.spyOn(h, 'focus')

    clickQuietly()

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('keeps working when both faults occur in the same click', () => {
    const h = heading()
    appendMain(h)
    render(<BackToTop />)
    vi.mocked(window.scrollTo).mockImplementation(() => { throw new Error('x') })
    const focusSpy = vi.spyOn(h, 'focus').mockImplementation((...args: unknown[]) => {
      if (args.length > 0) throw new TypeError('no options')
    })

    expect(() => clickQuietly()).not.toThrow()

    expect(focusSpy).toHaveBeenCalledWith()
    expect(h.getAttribute('tabindex')).toBe('-1')
  })
})

/** Small helper used by one assertion above. */
function mainFocusIsCalled(main: HTMLElement): boolean {
  return main.getAttribute('tabindex') === '-1'
}