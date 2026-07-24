import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Badge from './Badge'

vi.mock('./Badge.css', () => ({}))
vi.mock('./TooltipOnOverflow.css', () => ({}))
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

describe('Badge', () => {
  describe('variant normalization', () => {
    it('renders a known tier variant with the correct label', () => {
      render(<Badge variant="gold" />)
      expect(screen.getByText('Gold')).toBeInTheDocument()
    })

    it('renders a known status variant with the correct label', () => {
      render(<Badge variant="slashed" />)
      expect(screen.getByText('Slashed')).toBeInTheDocument()
    })

    it('renders grace-period with "Grace Period" label', () => {
      render(<Badge variant="grace-period" />)
      expect(screen.getByText('Grace Period')).toBeInTheDocument()
    })

    it('normalizes an unknown variant string to the unknown style', () => {
      render(<Badge variant="foo-bar" />)
      const el = document.querySelector('.badge--unknown')
      expect(el).not.toBeNull()
    })

    it('unknown variant normalizes to "Unknown" label (DEFAULT_LABELS takes precedence over raw string)', () => {
      render(<Badge variant="foo-bar" />)
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })

    it('treats an empty string as unknown', () => {
      render(<Badge variant="" />)
      expect(document.querySelector('.badge--unknown')).not.toBeNull()
    })

    it.each([
      ['bronze', 'Bronze'],
      ['silver', 'Silver'],
      ['gold', 'Gold'],
      ['platinum', 'Platinum'],
      ['active', 'Active'],
      ['locked', 'Locked'],
      ['slashed', 'Slashed'],
      ['grace-period', 'Grace Period'],
      ['unknown', 'Unknown'],
    ] as const)('variant "%s" renders label "%s"', (variant, expectedLabel) => {
      render(<Badge variant={variant} />)
      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
    })
  })

  describe('label override', () => {
    it('renders the custom label instead of the default', () => {
      render(<Badge variant="gold" label="Top tier" />)
      expect(screen.getByText('Top tier')).toBeInTheDocument()
      expect(screen.queryByText('Gold')).toBeNull()
    })

    it('custom label applies to an unknown variant', () => {
      render(<Badge variant="custom-tier" label="My Badge" />)
      expect(screen.getByText('My Badge')).toBeInTheDocument()
    })
  })

  describe('TooltipOnOverflow integration', () => {
    it('wraps badge in a TooltipOnOverflow with the display label as content', () => {
      render(<Badge variant="slashed" />)
      // The badge label is still rendered
      expect(screen.getByText('Slashed')).toBeInTheDocument()
      // The wrapper span from TooltipOnOverflow exists
      const wrapper = document.querySelector('.tooltip-on-overflow__wrapper')
      expect(wrapper).toBeInTheDocument()
    })

    it('passes custom label to TooltipOnOverflow content', () => {
      render(<Badge variant="gold" label="Custom label" />)
      expect(screen.getByText('Custom label')).toBeInTheDocument()
      const wrapper = document.querySelector('.tooltip-on-overflow__wrapper')
      expect(wrapper).toBeInTheDocument()
    })

    it('no longer renders a title attribute on the badge span', () => {
      render(<Badge variant="mystery-tier" />)
      const badge = document.querySelector('.badge')
      expect(badge).not.toHaveAttribute('title')
    })
  })

  describe('className prop', () => {
    it('appends extra class names to the badge root', () => {
      render(<Badge variant="active" className="my-extra-class" />)
      const badge = document.querySelector('.badge')
      expect(badge).toHaveClass('my-extra-class')
    })

    it('does not produce a trailing space in the class when no className is given', () => {
      render(<Badge variant="active" />)
      const badge = document.querySelector('.badge')
      // className should not start or end with a space
      expect(badge?.className).not.toMatch(/^\s|\s$/)
    })
  })

  describe('srPrefix — screen-reader-only context prefix', () => {
    it('is absent from the DOM when srPrefix is not supplied', () => {
      render(<Badge variant="slashed" />)
      // The .sr-only span should not be present
      expect(document.querySelector('.sr-only')).toBeNull()
    })

    it('renders a sr-only span when srPrefix is provided', () => {
      render(<Badge variant="slashed" srPrefix="Bond status:" />)
      const srSpan = document.querySelector('.sr-only')
      expect(srSpan).not.toBeNull()
      expect(srSpan).toHaveTextContent('Bond status:')
    })

    it('accessible name includes both prefix and visible label', () => {
      render(<Badge variant="slashed" srPrefix="Bond status:" />)
      // The full text content should be "Bond status:  Slashed" (note: trailing space after prefix)
      const badge = document.querySelector('.badge')
      expect(badge?.textContent).toContain('Bond status:')
      expect(badge?.textContent).toContain('Slashed')
    })

    it('srPrefix still applies when a custom label is used', () => {
      render(<Badge variant="locked" label="In lock-up" srPrefix="Status:" />)
      expect(document.querySelector('.sr-only')).toHaveTextContent('Status:')
      expect(screen.getByText('In lock-up')).toBeInTheDocument()
    })

    it('srPrefix works on an unknown variant (label normalizes to Unknown)', () => {
      render(<Badge variant="experimental" srPrefix="Tier:" />)
      expect(document.querySelector('.sr-only')).toHaveTextContent('Tier:')
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('color-only regression — visible label is always non-empty', () => {
    it.each([
      'slashed',
      'grace-period',
      'locked',
      'active',
      'bronze',
      'silver',
      'gold',
      'platinum',
      'unknown',
    ] as const)('severity variant "%s" always has a non-empty text label', (variant) => {
      render(<Badge variant={variant} />)
      const badge = document.querySelector('.badge')
      // Strip whitespace from any sr-only prefix to get visible text
      const visibleText = badge?.querySelector('.sr-only')
        ? badge.textContent?.replace(badge.querySelector('.sr-only')!.textContent ?? '', '').trim()
        : badge?.textContent?.trim()
      expect(visibleText?.length).toBeGreaterThan(0)
    })
  })
})
