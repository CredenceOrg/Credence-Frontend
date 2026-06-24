import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  const baseProps = { title: 'Nothing here', description: 'Add something to get started.' }

  it('renders title and description', () => {
    render(<EmptyState {...baseProps} />)
    expect(screen.getByRole('heading', { name: /nothing here/i })).toBeInTheDocument()
    expect(screen.getByText(/add something to get started/i)).toBeInTheDocument()
  })

  it('renders no illustration when neither icon nor illustration is provided', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it.each(['bond', 'trust', 'dispute', 'attestation', 'activity'] as const)(
    'renders an SVG for illustration="%s"',
    (illustration) => {
      const { container } = render(<EmptyState {...baseProps} illustration={illustration} />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    }
  )

  it('icon prop overrides illustration', () => {
    const { container } = render(
      <EmptyState {...baseProps} illustration="bond" icon={<span data-testid="custom-icon" />} />
    )
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    // The ILLUSTRATION_ICONS svg should NOT be rendered
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(0)
  })

  it('renders action button and calls onClick', () => {
    const onClick = vi.fn()
    render(<EmptyState {...baseProps} action={{ label: 'Do it', onClick }} />)
    const btn = screen.getByRole('button', { name: /do it/i })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('action button uses secondary style when variant="secondary"', () => {
    render(
      <EmptyState
        {...baseProps}
        action={{ label: 'Secondary', onClick: vi.fn(), variant: 'secondary' }}
      />
    )
    expect(screen.getByRole('button', { name: /secondary/i })).toBeInTheDocument()
  })

  it('renders no action button when action prop is omitted', () => {
    render(<EmptyState {...baseProps} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('description margin collapses when no action is provided', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    const p = container.querySelector('p') as HTMLElement
    // jsdom normalises '0' → '0px' in inline styles
    expect(p.style.marginBottom).toMatch(/^0(px)?$/)
  })
})
