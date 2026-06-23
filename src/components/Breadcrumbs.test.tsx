import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { describe, it, expect } from 'vitest'
import Breadcrumbs from './Breadcrumbs'

// Mock react-router-dom hooks
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => ({
      pathname: '/dashboard',
    }),
    useMatches: () => [{ pathname: '/' }, { pathname: '/dashboard' }],
    Link: ({ to, children, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

describe('Breadcrumbs', () => {
  describe('basic rendering', () => {
    it('renders breadcrumb nav element', () => {
      render(<Breadcrumbs />)
      const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
      expect(nav).toBeInTheDocument()
    })

    it('applies breadcrumbs class to nav', () => {
      render(<Breadcrumbs />)
      const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
      expect(nav).toHaveClass('breadcrumbs')
    })

    it('renders an ordered list', () => {
      render(<Breadcrumbs />)
      const list = screen.getByRole('list')
      expect(list.tagName).toBe('OL')
    })
  })

  describe('accessibility', () => {
    it('has aria-label on nav', () => {
      render(<Breadcrumbs />)
      const nav = screen.getByRole('navigation', { name: 'Breadcrumb' })
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb')
    })

    it('applies breadcrumbs-link class to links', () => {
      render(<Breadcrumbs />)
      const links = screen.queryAllByRole('link')
      links.forEach((link) => {
        expect(link).toHaveClass('breadcrumbs-link')
      })
    })
  })

  describe('styling', () => {
    it('applies breadcrumbs-list class to ol', () => {
      render(<Breadcrumbs />)
      const list = screen.getByRole('list')
      expect(list).toHaveClass('breadcrumbs-list')
    })

    it('applies breadcrumbs-item class to list items', () => {
      render(<Breadcrumbs />)
      const items = screen.getAllByRole('listitem')
      items.forEach((item) => {
        expect(item).toHaveClass('breadcrumbs-item')
      })
    })
  })
})
