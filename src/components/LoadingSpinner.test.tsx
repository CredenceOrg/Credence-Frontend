import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import LoadingSpinner from './LoadingSpinner'

// Mock useReducedMotion hook
const mockUseReducedMotion = vi.fn()
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

describe('LoadingSpinner', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Standard motion mode (prefers-reduced-motion: false)', () => {
    it('renders the SVG spinner by default when prefersReducedMotion is false', () => {
      mockUseReducedMotion.mockReturnValue(false)
      const { container } = render(<LoadingSpinner />)

      const wrapper = container.querySelector('.credence-loading-spinner')
      expect(wrapper).toBeInTheDocument()
      expect(wrapper).toHaveAttribute('aria-hidden', 'true')

      const svg = container.querySelector('svg.credence-loading-spinner__icon')
      expect(svg).toBeInTheDocument()
    })

    it('applies default size (md) class to the wrapper', () => {
      mockUseReducedMotion.mockReturnValue(false)
      const { container } = render(<LoadingSpinner />)

      expect(container.querySelector('.credence-loading-spinner--md')).toBeInTheDocument()
    })

    it('applies custom size variant classes (sm, lg)', () => {
      mockUseReducedMotion.mockReturnValue(false)
      const { container: containerSm } = render(<LoadingSpinner size="sm" />)
      expect(containerSm.querySelector('.credence-loading-spinner--sm')).toBeInTheDocument()

      const { container: containerLg } = render(<LoadingSpinner size="lg" />)
      expect(containerLg.querySelector('.credence-loading-spinner--lg')).toBeInTheDocument()
    })

    it('applies custom className to wrapper and iconClassName to SVG', () => {
      mockUseReducedMotion.mockReturnValue(false)
      const { container } = render(
        <LoadingSpinner className="custom-wrapper" iconClassName="custom-icon" />
      )

      expect(container.querySelector('.custom-wrapper')).toBeInTheDocument()
      expect(container.querySelector('svg.custom-icon')).toBeInTheDocument()
    })
  })

  describe('Reduced motion mode (prefers-reduced-motion: true)', () => {
    it('falls back to static "Loading…" text when prefersReducedMotion is true', () => {
      mockUseReducedMotion.mockReturnValue(true)
      render(<LoadingSpinner />)

      // Does not render SVG icon
      expect(document.querySelector('svg')).toBeNull()

      // Renders static Loading… text
      const textElement = screen.getByText('Loading…')
      expect(textElement).toBeInTheDocument()
      expect(textElement).toHaveClass('credence-loading-spinner--reduced')
    })

    it('allows customizing the reduced motion fallback text via label prop', () => {
      mockUseReducedMotion.mockReturnValue(true)
      render(<LoadingSpinner label="Please wait…" />)

      expect(screen.getByText('Please wait…')).toBeInTheDocument()
    })

    it('applies custom className in reduced motion mode', () => {
      mockUseReducedMotion.mockReturnValue(true)
      const { container } = render(<LoadingSpinner className="custom-reduced" />)

      expect(container.querySelector('.custom-reduced')).toBeInTheDocument()
    })
  })
})
