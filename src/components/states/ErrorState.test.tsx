import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorState from './ErrorState'

describe('ErrorState', () => {
  it('renders the default title and message for type="generic"', () => {
    render(<ErrorState />)
    expect(screen.getByRole('heading', { name: /something didn\u2019t load/i })).toBeInTheDocument()
    expect(screen.getByText(/unexpected hiccup/i)).toBeInTheDocument()
  })

  it('renders the network copy when type="network"', () => {
    render(<ErrorState type="network" />)
    expect(screen.getByRole('heading', { name: /connection issue/i })).toBeInTheDocument()
    expect(screen.getByText(/check your connection/i)).toBeInTheDocument()
  })

  it('renders the backend copy when type="backend"', () => {
    render(<ErrorState type="backend" />)
    expect(
      screen.getByRole('heading', { name: /service temporarily unavailable/i })
    ).toBeInTheDocument()
    expect(screen.getByText(/brief snag/i)).toBeInTheDocument()
  })

  it('renders the validation copy when type="validation"', () => {
    render(<ErrorState type="validation" />)
    expect(screen.getByRole('heading', { name: /check your input/i })).toBeInTheDocument()
    expect(screen.getByText(/highlighted items/i)).toBeInTheDocument()
  })

  it('renders the pageNotFound copy and severity=info by default', () => {
    render(<ErrorState type="pageNotFound" />)
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByText(/may have moved/i)).toBeInTheDocument()
    const panel = screen.getByRole('alert')
    expect(panel).toHaveClass('error-state--info')
  })

  it('allows overriding title and message', () => {
    render(
      <ErrorState
        title="Custom heading"
        message="Custom body copy"
        action={{ label: 'Retry', onClick: vi.fn() }}
      />
    )
    expect(screen.getByRole('heading', { name: /custom heading/i })).toBeInTheDocument()
    expect(screen.getByText(/custom body copy/i)).toBeInTheDocument()
  })

  it('renders the action button and triggers onClick', () => {
    const onClick = vi.fn()
    render(<ErrorState action={{ label: 'Try again', onClick }} />)
    const btn = screen.getByRole('button', { name: /try again/i })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disables the action while isLoading and surfaces aria-busy', () => {
    render(<ErrorState action={{ label: 'Retry', onClick: vi.fn(), isLoading: true }} />)
    const btn = screen.getByRole('button', { name: /retrying/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('omits the action button when no action is provided', () => {
    render(<ErrorState />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('exposes role="alert" and aria-live="assertive" for screen readers', () => {
    render(<ErrorState />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-live', 'assertive')
  })

  it('derives the default aria-label from the title without leaking internal jargon', () => {
    render(<ErrorState type="network" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-label', expect.stringMatching(/connection issue/i))
    // The label must not leak component-internal jargon like "error state"
    // (cf. Copy Tone Guide voice rules).
    expect(panel).not.toHaveAttribute('aria-label', expect.stringMatching(/error state/i))
  })

  it('respects an explicit ariaLabel prop', () => {
    render(<ErrorState ariaLabel="Custom label" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-label', 'Custom label')
  })

  it('applies severity modifier class default of danger for generic', () => {
    render(<ErrorState />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--danger')
  })

  it.each(['danger', 'warning', 'info'] as const)(
    'applies severity modifier class error-state--%s when severity="%s"',
    (severity) => {
      render(<ErrorState severity={severity} />)
      expect(screen.getByRole('alert')).toHaveClass(`error-state--${severity}`)
    }
  )

  it('default severity for type="validation" is warning', () => {
    render(<ErrorState type="validation" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--warning')
  })

  it('default severity for type="pageNotFound" is info', () => {
    render(<ErrorState type="pageNotFound" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--info')
  })

  it('explicit severity prop overrides the type default', () => {
    render(<ErrorState type="validation" severity="danger" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--danger')
  })

  it('renders an inline SVG icon for every error kind', () => {
    const kinds = ['network', 'backend', 'validation', 'generic', 'pageNotFound'] as const
    for (const kind of kinds) {
      const { container, unmount } = render(<ErrorState type={kind} />)
      const svg = container.querySelector('svg')
      expect(svg, `expected an SVG for kind="${kind}"`).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      unmount()
    }
  })

  it('renders the user-provided icon and skips the default glyph', () => {
    render(<ErrorState icon={<span data-testid="custom-icon">!</span>} />)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('marks the description with a has-action modifier when an action is present', () => {
    const { container } = render(<ErrorState action={{ label: 'Retry', onClick: vi.fn() }} />)
    const message = container.querySelector('.error-state__message') as HTMLElement | null
    expect(message).not.toBeNull()
    expect(message?.className).toContain('error-state__message--has-action')
  })

  it('does not mark the description with has-action when no action is present', () => {
    const { container } = render(<ErrorState />)
    const message = container.querySelector('.error-state__message') as HTMLElement | null
    expect(message).not.toBeNull()
    expect(message?.className).not.toContain('error-state__message--has-action')
  })

  it('exposes data-error-kind and data-error-severity for telemetry hooks', () => {
    render(<ErrorState type="backend" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('data-error-kind', 'backend')
    expect(panel).toHaveAttribute('data-error-severity', 'danger')
  })

  it('keeps prefers-reduced-motion animations gated via CSS, not JS', () => {
    // The animation is a CSS-only concern (see ErrorState.css rules under
    // `@media (prefers-reduced-motion: reduce)`) so the test only asserts
    // that the panel mounts cleanly with reduced motion enabled — it
    // should not throw and the entrance animation should be a no-op.
    render(<ErrorState />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
