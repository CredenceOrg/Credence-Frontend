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
})
