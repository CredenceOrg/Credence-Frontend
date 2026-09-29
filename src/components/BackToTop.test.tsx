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
    expect(screen.getByRole('button', { name: /back to top/i })).toBeInTheDocument()
  })

  it('calls window.scrollTo with smooth behavior on click', () => {
    setVisible(true)
    render(<BackToTop />)

    fireEvent.click(screen.getByRole('button', { name: /back to top/i }))

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('calls window.scrollTo with auto behavior when reduced motion is preferred', () => {
    setVisible(true)
    setReducedMotion(true)
    render(<BackToTop />)

    fireEvent.click(screen.getByRole('button', { name: /back to top/i }))

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('focuses the h1 inside #main-content after click', () => {
    setVisible(true)

    const main = document.createElement('main')
    main.id = 'main-content'
    const heading = document.createElement('h1')
    heading.textContent = 'Page Title'
    main.appendChild(heading)
    document.body.appendChild(main)

    render(<BackToTop />)
    const focusSpy = vi.spyOn(heading, 'focus')

    fireEvent.click(screen.getByRole('button', { name: /back to top/i }))

    expect(heading.getAttribute('tabindex')).toBe('-1')
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('does not overwrite tabindex if heading already has one', () => {
    setVisible(true)

    const main = document.createElement('main')
    main.id = 'main-content'
    const heading = document.createElement('h1')
    heading.setAttribute('tabindex', '0')
    main.appendChild(heading)
    document.body.appendChild(main)

    render(<BackToTop />)

    fireEvent.click(screen.getByRole('button', { name: /back to top/i }))

    expect(heading.getAttribute('tabindex')).toBe('0')
  })

  it('does not throw when there is no h1 in #main-content', () => {
    setVisible(true)
    render(<BackToTop />)
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: /back to top/i }))
    ).not.toThrow()
  })

  describe('handleClick failure boundaries and regressions', () => {
    it('aborts execution when window.scrollTo throws', () => {
      setVisible(true)

      const main = document.createElement('main')
      main.id = 'main-content'
      const heading = document.createElement('h1')
      main.appendChild(heading)
      document.body.appendChild(main)

      render(<BackToTop />)
      const error = new Error('scrollTo failure')
      vi.spyOn(window, 'scrollTo').mockImplementation(() => {
        throw error
      })

      const focusSpy = vi.spyOn(heading, 'focus')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const errorHandler = (e: ErrorEvent) => {
        if (e.error === error) {
          e.preventDefault()
        }
      }
      window.addEventListener('error', errorHandler)

      fireEvent.click(screen.getByRole('button', { name: /back to top/i }))

      expect(focusSpy).not.toHaveBeenCalled()

      window.removeEventListener('error', errorHandler)
      consoleSpy.mockRestore()
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
