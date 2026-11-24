import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import FooterLink from './FooterLink'

describe('FooterLink', () => {
  it('renders same-origin links without opening a new tab', () => {
    render(<FooterLink label="Documentation" href="/docs" />)

    const link = screen.getByRole('link', { name: 'Documentation' })
    expect(link).toHaveAttribute('href', '/docs')
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })

  it.each(['https://legal.example/terms', 'mailto:support@example.com'])(
    'marks allowed external URL %s for safe new-tab navigation',
    (href) => {
      render(<FooterLink label="Terms" href={href} />)

      const link = screen.getByRole('link', { name: 'Terms' })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  )

  it.each(['javascript:alert(1)', 'data:text/html,unsafe', 'custom:payload'])(
    'renders unsupported scheme %s as inert text',
    (href) => {
      render(<FooterLink label="Documentation" href={href} />)

      expect(screen.queryByRole('link', { name: 'Documentation' })).not.toBeInTheDocument()
      const disabledLink = screen.getByText('Documentation')
      expect(disabledLink.tagName).toBe('SPAN')
      expect(disabledLink).toHaveAttribute('aria-disabled', 'true')
      expect(disabledLink).toHaveAttribute('title', 'Unavailable link')
      expect(disabledLink).toHaveAttribute('tabindex', '-1')
    }
  )

  it.each(['http://', 'https://[invalid'])('renders malformed web URL %s as inert text', (href) => {
    render(<FooterLink label="Documentation" href={href} />)

    expect(screen.queryByRole('link', { name: 'Documentation' })).not.toBeInTheDocument()
    expect(screen.getByText('Documentation')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Documentation')).toHaveAttribute('title', 'Unavailable link')
  })

  it.each(['', '   ', '#', '  #  '])('disables placeholder href %j', (href) => {
    render(<FooterLink label="Privacy" href={href} />)

    const disabledLink = screen.getByText('Privacy')
    expect(disabledLink.tagName).toBe('SPAN')
    expect(disabledLink).toHaveAttribute('aria-disabled', 'true')
    expect(disabledLink).toHaveAttribute('title', 'Coming soon')
  })

  it('recovers cleanly when an unsafe href changes to a valid link', () => {
    const { rerender } = render(<FooterLink label="Documentation" href="javascript:alert(1)" />)

    expect(screen.queryByRole('link', { name: 'Documentation' })).not.toBeInTheDocument()

    rerender(<FooterLink label="Documentation" href="/docs" />)

    expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs')
  })

  it('renders duplicate hrefs as independent links', () => {
    render(
      <>
        <FooterLink label="Documentation" href="/docs" />
        <FooterLink label="Terms" href="/docs" />
      </>
    )

    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', '/docs')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/docs')
  })
})
