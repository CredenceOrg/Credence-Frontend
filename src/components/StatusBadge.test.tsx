import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge from './StatusBadge'
import type { StatusBadgeVariant } from './StatusBadge'

vi.mock('./StatusBadge.css', () => ({}))

const ALL_VARIANTS: [StatusBadgeVariant, string][] = [
  ['pending', 'Pending'],
  ['active', 'Active'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
]

describe('StatusBadge', () => {
  describe('default labels', () => {
    it.each(ALL_VARIANTS)('variant "%s" renders label "%s"', (variant, expectedLabel) => {
      render(<StatusBadge variant={variant} />)
      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
    })
  })

  describe('variant class names', () => {
    it.each(ALL_VARIANTS)('variant "%s" has .status-badge--%s class', (variant) => {
      render(<StatusBadge variant={variant} />)
      const el = document.querySelector(`.status-badge--${variant}`)
      expect(el).not.toBeNull()
    })

    it.each(ALL_VARIANTS)('root element always carries .status-badge base class', (variant) => {
      render(<StatusBadge variant={variant} />)
      expect(document.querySelector('.status-badge')).not.toBeNull()
    })
  })

  describe('label override', () => {
    it('renders the custom label instead of the default', () => {
      render(<StatusBadge variant="pending" label="Awaiting review" />)
      expect(screen.getByText('Awaiting review')).toBeInTheDocument()
      expect(screen.queryByText('Pending')).toBeNull()
    })

    it('custom label applies to completed variant', () => {
      render(<StatusBadge variant="completed" label="Done" />)
      expect(screen.getByText('Done')).toBeInTheDocument()
      expect(screen.queryByText('Completed')).toBeNull()
    })

    it.each(ALL_VARIANTS)('custom label on variant "%s" is rendered', (variant) => {
      render(<StatusBadge variant={variant} label="Custom" />)
      expect(screen.getByText('Custom')).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    it('appends extra class names to the badge root', () => {
      render(<StatusBadge variant="active" className="my-extra-class" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveClass('my-extra-class')
    })

    it('does not produce a trailing space in className when no className is given', () => {
      render(<StatusBadge variant="active" />)
      const badge = document.querySelector('.status-badge')
      expect(badge?.className).not.toMatch(/^\s|\s$/)
    })

    it('both base and variant class are present alongside custom className', () => {
      render(<StatusBadge variant="failed" className="extra" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveClass('status-badge', 'status-badge--failed', 'extra')
    })
  })

  describe('srPrefix — screen-reader-only context prefix', () => {
    it('is absent from the DOM when srPrefix is not supplied', () => {
      render(<StatusBadge variant="pending" />)
      expect(document.querySelector('.sr-only')).toBeNull()
    })

    it('renders a .sr-only span when srPrefix is provided', () => {
      render(<StatusBadge variant="failed" srPrefix="Bond status:" />)
      const srSpan = document.querySelector('.sr-only')
      expect(srSpan).not.toBeNull()
      expect(srSpan).toHaveTextContent('Bond status:')
    })

    it('full text content includes both prefix and visible label', () => {
      render(<StatusBadge variant="completed" srPrefix="Transaction status:" />)
      const badge = document.querySelector('.status-badge')
      expect(badge?.textContent).toContain('Transaction status:')
      expect(badge?.textContent).toContain('Completed')
    })

    it('srPrefix still applies when a custom label is used', () => {
      render(<StatusBadge variant="active" label="Running" srPrefix="Status:" />)
      expect(document.querySelector('.sr-only')).toHaveTextContent('Status:')
      expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it.each(ALL_VARIANTS)('srPrefix renders on variant "%s"', (variant) => {
      render(<StatusBadge variant={variant} srPrefix="Step:" />)
      expect(document.querySelector('.sr-only')).toHaveTextContent('Step:')
    })
  })

  describe('aria-label', () => {
    it.each(ALL_VARIANTS)(
      'variant "%s" defaults aria-label to its display label "%s"',
      (variant, expectedLabel) => {
        render(<StatusBadge variant={variant} />)
        const badge = document.querySelector('.status-badge')
        expect(badge).toHaveAttribute('aria-label', expectedLabel)
      }
    )

    it('custom ariaLabel overrides the default', () => {
      render(<StatusBadge variant="pending" ariaLabel="Bond status: Pending review" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Bond status: Pending review')
    })

    it('ariaLabel applies alongside a custom label', () => {
      render(<StatusBadge variant="completed" label="Done" ariaLabel="Transaction completed" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Transaction completed')
    })

    it('aria-label reflects custom label when ariaLabel is not provided', () => {
      render(<StatusBadge variant="failed" label="Error" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Error')
    })

    it('aria-label is present on every variant', () => {
      for (const [variant] of ALL_VARIANTS) {
        const { unmount } = render(<StatusBadge variant={variant} />)
        const badge = document.querySelector('.status-badge')
        expect(badge?.getAttribute('aria-label')).toBeTruthy()
        unmount()
      }
    })

    it('aria-label is present when srPrefix is also provided', () => {
      render(<StatusBadge variant="active" srPrefix="Status:" ariaLabel="Active bond" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Active bond')
    })
  })

  describe('color-only regression — visible label is always non-empty', () => {
    it.each(ALL_VARIANTS)('variant "%s" always has a non-empty text label', (variant) => {
      render(<StatusBadge variant={variant} />)
      const badge = document.querySelector('.status-badge')
      const visibleText = badge?.querySelector('.sr-only')
        ? badge.textContent?.replace(badge.querySelector('.sr-only')!.textContent ?? '', '').trim()
        : badge?.textContent?.trim()
      expect(visibleText?.length).toBeGreaterThan(0)
    })
  })

  describe('renders as a <span>', () => {
    it.each(ALL_VARIANTS)('root element is a <span> for variant "%s"', (variant) => {
      render(<StatusBadge variant={variant} />)
      const badge = document.querySelector('.status-badge')
      expect(badge?.tagName.toLowerCase()).toBe('span')
    })
  })
})
