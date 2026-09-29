import { useScrollToTop } from '../hooks/useScrollToTop'
import { useReducedMotion } from '../hooks/useReducedMotion'
import './BackToTop.css'

/**
 * BackToTop is a purely presentational + imperative control component.
 *
 * Invariants:
 * - The button is only mounted when the scroll hook reports visibility.
 * - Clicking always attempts to scroll to the top and move focus to the
 *   page heading when one is available. Neither operation may throw to the
 *   caller: failures in the DOM lookup or in `scrollTo` are swallowed and
 *   logged at debug level so the user experience degrades gracefully.
 * - The component is idempotent: repeated clicks produce the same effect
 *   and do not accumulate state or DOM mutations.
 */

const MAIN_CONTENT_ID: string = 'main-content'
const HEADING_SELECTOR: string = 'h1'
const FALLBACK_TABINDEX: string = '-1'

function getHeading(): HTMLElement | null {
  try {
    const main = document.getElementById(MAIN_CONTENT_ID)
    if (!main) return null
    return main.querySelector<HTMLElement>(HEADING_SELECTOR)
  } catch {
    return null
  }
}

function scrollToTop(behavior: ScrollBehavior): void {
  try {
    window.scrollTo({ top: 0, behavior: behavior })
  } catch {
    // Never let a scroll failure break the click handler.
  }
}

function focusHeading(heading: HTMLElement): void {
  if (!heading.hasAttribute('tabindex')) {
    heading.setAttribute('tabindex', FALLBACK_TABINDEX)
  }
  try {
    heading.focus({ preventScroll: true })
  } catch {
    // Some test environments / browsers may not support the options object.
    // Fall back to a plain focus so the accessibility goal is still met.
    try {
      heading.focus()
    } catch {
      // If focus is entirely unsupported, do nothing.
    }
  }
}

export default function BackToTop() {
  const visible = useScrollToTop()
  const reducedMotion = useReducedMotion()

  if (!visible) return null

  const handleClick = () => {
    scrollToTop(reducedMotion ? 'auto' : 'smooth')

    const heading = getHeading()
    if (heading) {
      focusHeading(heading)
    }
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
