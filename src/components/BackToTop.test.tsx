import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

function setVisible(value: boolean) {
  vi.mocked(useScrollToTopModule.useScrollToTop).mockReturnValue(value)
}

function setReducedMotion(value: boolean) {
  vi.mocked(useReducedMotionModule.useReducedMotion).mockReturnValue(value)
}

function appendMainContent(heading?: HTMLElement): void {
  const main = document.createElement('main')
  main.id = 'main-content'
  if (heading) main.appendChild(heading)
  document.body.appendChild(main)
}

function renderButton() {
  return screen.getByRole('button', { name: /back to top/i })
}

describe('BackToTop', () => {
  beforeEach(() => {
    setVisible(false)
    setReducedMotion(false)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('is not rendered when scroll is below threshold', () => {
    setVisible(false)
    render(<BackToTop />)
    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
  })

  it('renders the button when scroll exceeds threshold', () => {
    setVisible(true)
    render(<BackToTop />)
    expect(renderButton()).toBeInTheDocument()
  })

  it('calls window.scrollTo with smooth behavior on click', () => {
    setVisible(true)
    render(<BackToTop />)

    fireEvent.click(renderButton())

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('calls window.scrollTo with auto behavior when reduced motion is preferred', () => {
    setVisible(true)
    setReducedMotion(true)
    render(<BackToTop />)

    fireEvent.click(renderButton())

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('focuses the h1 inside #main-content after click', () => {
    setVisible(true)

    const heading = document.createElement('h1')
    heading.textContent = 'Page Title'
    appendMainContent(heading)

    render(<BackToTop />)
    const focusSpy = vi.spyOn(heading, 'focus')

    fireEvent.click(renderButton())

    expect(heading.getAttribute('tabindex')).toBe('-1')
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('does not overwrite tabindex if heading already has one', () => {
    setVisible(true)

    const heading = document.createElement('h1')
    heading.setAttribute('tabindex', '0')
    appendMainContent(heading)

    render(<BackToTop />)

    fireEvent.click(renderButton())

    expect(heading.getAttribute('tabindex')).toBe('0')
  })

  it('does not throw when there is no h1 in #main-content', () => {
    setVisible(true)
    appendMainContent()
    render(<BackToTop />)
    expect(() => fireEvent.click(renderButton())).not.toThrow()
  })

  it('does not throw when #main-content is missing entirely', () => {
    setVisible(true)
    render(<BackToTop />)
    expect(() => fireEvent.click(renderButton())).not.toThrow()
  })

  it('still focuses the heading when window.scrollTo throws', () => {
    setVisible(true)

    const heading = document.createElement('h1')
    appendMainContent(heading)

    render(<BackToTop />)
    const focusSpy = vi.spyOn(heading, 'focus')
    vi.mocked(window.scrollTo).mockImplementation(() => {
      throw new Error('scroll failed')
    })

    expect(() => fireEvent.click(renderButton())).not.toThrow()
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('falls back to a plain focus when the options object is unsupported', () => {
    setVisible(true)

    const heading = document.createElement('h1')
    appendMainContent(heading)

    render(<BackToTop />)
    const focusSpy = vi.spyOn(heading, 'focus').mockImplementation((...args: unknown[]) => {
      if (args.length > 0) throw new TypeError('options not supported')
    })

    expect(() => fireEvent.click(renderButton())).not.toThrow()
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    expect(focusSpy).toHaveBeenCalledWith()
  })

  it('is idempotent across repeated clicks', () => {
    setVisible(true)

    const heading = document.createElement('h1')
    appendMainContent(heading)

    render(<BackToTop />)
    const button = renderButton()

    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(window.scrollTo).toHaveBeenCalledTimes(3)
    expect(heading.getAttribute('tabindex')).toBe('-1')
  })

  it('recovers: button remains functional after a failed click', () => {
    setVisible(true)

    const heading = document.createElement('h1')
    appendMainContent(heading)

    render(<BackToTop />)
    const button = renderButton()

    vi.mocked(window.scrollTo).mockImplementationOnce(() => {
      throw new Error('scroll failed')
    })

    expect(() => fireEvent.click(button)).not.toThrow()

    vi.mocked(window.scrollTo).mockImplementation(() => undefined)
    fireEvent.click(button)

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('recovers when #main-content appears after an initial click', () => {
    setVisible(true)
    render(<BackToTop />)
    const button = renderButton()

    expect(() => fireEvent.click(button)).not.toThrow()

    const heading = document.createElement('h1')
    appendMainContent(heading)
    const focusSpy = vi.spyOn(heading, 'focus')

    fireEvent.click(button)

    expect(heading.getAttribute('tabindex')).toBe('-1')
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('uses the first h1 when multiple headings exist', () => {
    setVisible(true)

    const first = document.createElement('h1')
    const second = document.createElement('h1')
    const main = document.createElement('main')
    main.id = 'main-content'
    main.appendChild(first)
    main.appendChild(second)
    document.body.appendChild(main)

    render(<BackToTop />)
    const firstSpy = vi.spyOn(first, 'focus')
    const secondSpy = vi.spyOn(second, 'focus')

    fireEvent.click(renderButton())

    expect(firstSpy).toHaveBeenCalledWith({ preventScroll: true })
    expect(secondSpy).not.toHaveBeenCalled()
  })

  it('ignores h1 elements outside #main-content', () => {
    setVisible(true)

    const outside = document.createElement('h1')
    document.body.appendChild(outside)

    render(<BackToTop />)
    const outsideSpy = vi.spyOn(outside, 'focus')

    fireEvent.click(renderButton())

    expect(outsideSpy).not.toHaveBeenCalled()
  })

  it('stays hidden and does not scroll when visibility flags false', () => {
    setVisible(false)
    render(<BackToTop />)

    expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('renders the accessible label and hides the icon from AT', () => {
    setVisible(true)
    render(<BackToTop />)

    const button = renderButton()
    expect(button.getAttribute('type')).toBe('button')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  describe('handleClick failure boundaries and regressions', () => {
    // The scroll is best-effort; focus management is not. A scroll failure must
    // never cost the user their focus placement, so the two steps are
    // independent. This is the invariant the previous version of this test
    // asserted the opposite of, which is why it could never have passed.
    it('still focuses the heading when window.scrollTo throws', () => {
      setVisible(true)

      const main = document.createElement('main')
      main.id = 'main-content'
      const heading = document.createElement('h1')
      main.appendChild(heading)
      document.body.appendChild(main)

      render(<BackToTop />)
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {
        throw new Error('scrollTo failure')
      })

      const focusSpy = vi.spyOn(heading, 'focus')

      expect(() => fireEvent.click(screen.getByRole('button', { name: /back to top/i }))).not.toThrow()
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
    })

    it('swallows a scrollTo rejection without surfacing an unhandled error', () => {
      setVisible(true)
      const heading = document.createElement('h1')
      appendMainContent(heading)

      render(<BackToTop />)
      vi.mocked(window.scrollTo).mockImplementation(() => {
        throw new Error('scrollTo failure')
      })

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const unhandled: unknown[] = []
      const onUnhandled = (event: PromiseRejectionEvent) => unhandled.push(event.reason)
      window.addEventListener('unhandledrejection', onUnhandled)

      expect(() => fireEvent.click(renderButton())).not.toThrow()

      window.removeEventListener('unhandledrejection', onUnhandled)
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(unhandled).toHaveLength(0)
      consoleErrorSpy.mockRestore()
    })

    it('handles repeated invocation without side effects', () => {
      setVisible(true)

      const main = document.createElement('main')
      main.id = 'main-content'
      const heading = document.createElement('h1')
      main.appendChild(heading)
      document.body.appendChild(main)

      render(<BackToTop />)

      const setAttributeSpy = vi.spyOn(heading, 'setAttribute')
      const focusSpy = vi.spyOn(heading, 'focus')

      const button = screen.getByRole('button', { name: /back to top/i })

      fireEvent.click(button)
      expect(window.scrollTo).toHaveBeenCalledTimes(1)
      expect(setAttributeSpy).toHaveBeenCalledTimes(1)
      expect(focusSpy).toHaveBeenCalledTimes(1)

      fireEvent.click(button)
      expect(window.scrollTo).toHaveBeenCalledTimes(2)
      // setAttribute shouldn't be called again since tabindex is already set
      expect(setAttributeSpy).toHaveBeenCalledTimes(1)
      expect(focusSpy).toHaveBeenCalledTimes(2)
    })
  })
})
