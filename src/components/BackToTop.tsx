import { useScrollToTop } from '../hooks/useScrollToTop'
import { useReducedMotion } from '../hooks/useReducedMotion'
import './BackToTop.css'

export default function BackToTop() {
  const visible = useScrollToTop()
  const reducedMotion = useReducedMotion()

  if (!visible) return null

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })

    const main = document.getElementById('main-content')
    const heading = main?.querySelector<HTMLElement>('h1')
    if (heading) {
      if (!heading.hasAttribute('tabindex')) {
        heading.setAttribute('tabindex', '-1')
      }
      heading.focus({ preventScroll: true })
    }
  }

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label="Back to top"
      onClick={handleClick}
    >
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
