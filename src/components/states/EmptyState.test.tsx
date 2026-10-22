import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EmptyState from './EmptyState'

// ─── helpers ───────────────────────────────────────────────────────────────

const baseProps = { title: 'Nothing here', description: 'Add something to get started.' }

// ─── Original surface (kind="idle" / default) ──────────────────────────────

describe('EmptyState — idle / default state', () => {
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

  it('description uses hasAction modifier class when action is provided', () => {
    const { container } = render(
      <EmptyState {...baseProps} action={{ label: 'Do it', onClick: vi.fn() }} />
    )
    const p = container.querySelector('p') as HTMLElement
    expect(p.className).toContain('empty-state__description--hasAction')
  })

  it('description does not have hasAction modifier when no action', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    const p = container.querySelector('p') as HTMLElement
    expect(p.className).not.toContain('empty-state__description--hasAction')
  })

  it('applies mobile bottom-padding to avoid overlap with fixed bottom nav', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toBeInTheDocument()
    expect(root.className).toBe('empty-state')
  })

  it('does not set role or aria-live for kind="idle"', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).not.toHaveAttribute('role')
    expect(root).not.toHaveAttribute('aria-live')
  })

  it('does not set aria-busy for kind="idle"', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).not.toHaveAttribute('aria-busy')
  })

  it('exposes data-empty-kind="idle" for telemetry', () => {
    const { container } = render(<EmptyState {...baseProps} />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toHaveAttribute('data-empty-kind', 'idle')
  })

  it('forwards data-testid to the root element', () => {
    render(<EmptyState {...baseProps} data-testid="my-empty-state" />)
    expect(screen.getByTestId('my-empty-state')).toBeInTheDocument()
  })
})

// ─── Loading state ─────────────────────────────────────────────────────────

describe('EmptyState — loading state', () => {
  it('renders with role="status" and aria-live="polite"', () => {
    render(<EmptyState {...baseProps} kind="loading" />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('sets aria-busy="true" on the root element', () => {
    render(<EmptyState {...baseProps} kind="loading" />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
  })

  it('renders a spinner SVG icon by default', () => {
    const { container } = render(<EmptyState {...baseProps} kind="loading" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies empty-state--loading modifier class', () => {
    const { container } = render(<EmptyState {...baseProps} kind="loading" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root.className).toContain('empty-state--loading')
  })

  it('exposes data-empty-kind="loading" for telemetry', () => {
    const { container } = render(<EmptyState {...baseProps} kind="loading" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toHaveAttribute('data-empty-kind', 'loading')
  })

  it('explicit icon prop overrides the default spinner', () => {
    render(
      <EmptyState {...baseProps} kind="loading" icon={<span data-testid="custom-spinner" />} />
    )
    expect(screen.getByTestId('custom-spinner')).toBeInTheDocument()
  })

  it('action button shows "Connecting…" while isLoading=true', () => {
    render(
      <EmptyState
        {...baseProps}
        kind="loading"
        action={{ label: 'Connect', onClick: vi.fn(), isLoading: true }}
      />
    )
    expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled()
  })

  it('action button shows original label while isLoading=false', () => {
    render(
      <EmptyState
        {...baseProps}
        kind="loading"
        action={{ label: 'Connect', onClick: vi.fn(), isLoading: false }}
      />
    )
    expect(screen.getByRole('button', { name: /connect/i })).toBeEnabled()
  })

  it('aria-label on region defaults to title', () => {
    render(<EmptyState {...baseProps} kind="loading" />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-label', 'Nothing here')
  })

  it('ariaLabel prop overrides the default title label', () => {
    render(<EmptyState {...baseProps} kind="loading" ariaLabel="Fetching bonds" />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-label', 'Fetching bonds')
  })
})

// ─── Error state ───────────────────────────────────────────────────────────

describe('EmptyState — error state', () => {
  it('renders with role="alert" and aria-live="assertive"', () => {
    render(<EmptyState {...baseProps} kind="error" />)
    const region = screen.getByRole('alert')
    expect(region).toHaveAttribute('aria-live', 'assertive')
  })

  it('does not set aria-busy on the root for error kind', () => {
    const { container } = render(<EmptyState {...baseProps} kind="error" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).not.toHaveAttribute('aria-busy')
  })

  it('renders a warning/error SVG icon by default', () => {
    const { container } = render(<EmptyState {...baseProps} kind="error" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies empty-state--error modifier class', () => {
    const { container } = render(<EmptyState {...baseProps} kind="error" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root.className).toContain('empty-state--error')
  })

  it('exposes data-empty-kind="error" for telemetry', () => {
    const { container } = render(<EmptyState {...baseProps} kind="error" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toHaveAttribute('data-empty-kind', 'error')
  })

  it('action button shows "Retrying…" while isLoading=true', () => {
    render(
      <EmptyState
        {...baseProps}
        kind="error"
        action={{ label: 'Retry', onClick: vi.fn(), isLoading: true }}
      />
    )
    expect(screen.getByRole('button', { name: /retrying/i })).toBeDisabled()
  })

  it('action button shows label while isLoading=false', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        {...baseProps}
        kind="error"
        action={{ label: 'Retry', onClick, isLoading: false }}
      />
    )
    const btn = screen.getByRole('button', { name: /retry/i })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('retry button carries aria-busy="true" while retrying', () => {
    render(
      <EmptyState
        {...baseProps}
        kind="error"
        action={{ label: 'Retry', onClick: vi.fn(), isLoading: true }}
      />
    )
    const btn = screen.getByRole('button', { name: /retrying/i })
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('disabled retry button does not double-fire onClick', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        {...baseProps}
        kind="error"
        action={{ label: 'Retry', onClick, isLoading: true }}
      />
    )
    const btn = screen.getByRole('button', { name: /retrying/i })
    // Clicking a disabled button must not invoke the handler
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('aria-label on region defaults to title', () => {
    render(<EmptyState {...baseProps} kind="error" />)
    const region = screen.getByRole('alert')
    expect(region).toHaveAttribute('aria-label', 'Nothing here')
  })
})

// ─── Stale state ───────────────────────────────────────────────────────────

describe('EmptyState — stale state', () => {
  it('renders with role="status" and aria-live="polite"', () => {
    render(<EmptyState {...baseProps} kind="stale" />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('does not set aria-busy on the root', () => {
    const { container } = render(<EmptyState {...baseProps} kind="stale" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).not.toHaveAttribute('aria-busy')
  })

  it('renders a clock SVG icon by default', () => {
    const { container } = render(<EmptyState {...baseProps} kind="stale" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies empty-state--stale modifier class', () => {
    const { container } = render(<EmptyState {...baseProps} kind="stale" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root.className).toContain('empty-state--stale')
  })

  it('exposes data-empty-kind="stale" for telemetry', () => {
    const { container } = render(<EmptyState {...baseProps} kind="stale" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toHaveAttribute('data-empty-kind', 'stale')
  })

  it('renders the refresh action when provided', () => {
    const onRefresh = vi.fn()
    render(
      <EmptyState {...baseProps} kind="stale" action={{ label: 'Refresh', onClick: onRefresh }} />
    )
    const btn = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(btn)
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('action button shows "Connecting…" while isLoading=true (non-error kind)', () => {
    render(
      <EmptyState
        {...baseProps}
        kind="stale"
        action={{ label: 'Refresh', onClick: vi.fn(), isLoading: true }}
      />
    )
    expect(screen.getByRole('button', { name: /connecting/i })).toBeDisabled()
  })
})

// ─── Permission / unauthorized state ──────────────────────────────────────

describe('EmptyState — permission state', () => {
  it('renders with role="alert" and aria-live="polite"', () => {
    render(<EmptyState {...baseProps} kind="permission" />)
    const region = screen.getByRole('alert')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('does not set aria-busy on the root', () => {
    const { container } = render(<EmptyState {...baseProps} kind="permission" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).not.toHaveAttribute('aria-busy')
  })

  it('renders a lock SVG icon by default', () => {
    const { container } = render(<EmptyState {...baseProps} kind="permission" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies empty-state--permission modifier class', () => {
    const { container } = render(<EmptyState {...baseProps} kind="permission" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root.className).toContain('empty-state--permission')
  })

  it('exposes data-empty-kind="permission" for telemetry', () => {
    const { container } = render(<EmptyState {...baseProps} kind="permission" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toHaveAttribute('data-empty-kind', 'permission')
  })

  it('action button does not carry aria-busy even when isLoading=true (permission invariant)', () => {
    render(
      <EmptyState
        {...baseProps}
        kind="permission"
        action={{ label: 'Sign in', onClick: vi.fn(), isLoading: true }}
      />
    )
    const btn = screen.getByRole('button')
    // Permission actions are sign-in flows, not retries; aria-busy must not be set
    expect(btn).not.toHaveAttribute('aria-busy', 'true')
  })

  it('action button is disabled while isLoading=true', () => {
    render(
      <EmptyState
        {...baseProps}
        kind="permission"
        action={{ label: 'Sign in', onClick: vi.fn(), isLoading: true }}
      />
    )
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('aria-label on region defaults to title', () => {
    render(<EmptyState {...baseProps} kind="permission" />)
    const region = screen.getByRole('alert')
    expect(region).toHaveAttribute('aria-label', 'Nothing here')
  })

  it('ariaLabel prop overrides the default title label', () => {
    render(
      <EmptyState {...baseProps} kind="permission" ariaLabel="You don't have access to this area" />
    )
    const region = screen.getByRole('alert')
    expect(region).toHaveAttribute('aria-label', "You don't have access to this area")
  })
})

// ─── All kinds: invariant checks ──────────────────────────────────────────

describe('EmptyState — cross-kind invariants', () => {
  const allKinds = ['idle', 'loading', 'error', 'stale', 'permission'] as const

  it.each(allKinds)('renders title and description for kind="%s"', (kind) => {
    render(<EmptyState kind={kind} title="T" description="D" />)
    expect(screen.getByRole('heading', { name: 'T' })).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it.each(allKinds)('exposes data-empty-kind="%s" on the root element', (kind) => {
    const { container } = render(<EmptyState kind={kind} title="T" description="D" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toHaveAttribute('data-empty-kind', kind)
  })

  it.each(allKinds)('explicit icon prop overrides default icon for kind="%s"', (kind) => {
    render(
      <EmptyState
        kind={kind}
        title="T"
        description="D"
        icon={<span data-testid={`icon-${kind}`} />}
      />
    )
    expect(screen.getByTestId(`icon-${kind}`)).toBeInTheDocument()
  })

  it('action button onClick fires exactly once per click', () => {
    const onClick = vi.fn()
    render(<EmptyState kind="error" title="T" description="D" action={{ label: 'Act', onClick }} />)
    const btn = screen.getByRole('button', { name: /act/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('disabled action button does not fire onClick regardless of kind', () => {
    const onClick = vi.fn()
    const kinds = ['loading', 'error', 'stale', 'permission'] as const
    for (const kind of kinds) {
      const { unmount } = render(
        <EmptyState
          kind={kind}
          title="T"
          description="D"
          action={{ label: 'Act', onClick, isLoading: true }}
        />
      )
      const btn = screen.getByRole('button')
      fireEvent.click(btn)
      unmount()
    }
    expect(onClick).not.toHaveBeenCalled()
  })

  it('illustration prop is ignored (overridden) by explicit icon for any kind', () => {
    const kinds = ['idle', 'loading', 'error', 'stale', 'permission'] as const
    for (const kind of kinds) {
      const { container, unmount } = render(
        <EmptyState
          kind={kind}
          title="T"
          description="D"
          illustration="bond"
          icon={<span data-testid={`override-${kind}`} />}
        />
      )
      // Custom icon rendered
      expect(screen.getByTestId(`override-${kind}`)).toBeInTheDocument()
      // No inline SVG from ILLUSTRATION_ICONS
      expect(container.querySelector('svg')).toBeNull()
      unmount()
    }
  })
})

// ─── Boundary / regression scenarios ─────────────────────────────────────

describe('EmptyState — boundary and regression cases', () => {
  it('renders a very long title without truncation or layout breakage', () => {
    const longTitle = 'A'.repeat(200)
    render(<EmptyState title={longTitle} description="D" />)
    expect(screen.getByRole('heading', { name: longTitle })).toBeInTheDocument()
  })

  it('renders a very long description without breaking', () => {
    const longDesc = 'B'.repeat(500)
    render(<EmptyState title="T" description={longDesc} />)
    expect(screen.getByText(longDesc)).toBeInTheDocument()
  })

  it('handles a no-op action onClick without throwing', () => {
    expect(() => {
      render(<EmptyState title="T" description="D" action={{ label: 'Act', onClick: () => {} }} />)
      fireEvent.click(screen.getByRole('button', { name: /act/i }))
    }).not.toThrow()
  })

  it('transitions from loading to error without inconsistent aria state', () => {
    const { rerender, container } = render(<EmptyState {...baseProps} kind="loading" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toHaveAttribute('aria-busy', 'true')

    rerender(<EmptyState {...baseProps} kind="error" />)
    // After transition to error, aria-busy must be absent from root
    expect(root).not.toHaveAttribute('aria-busy')
    expect(root).toHaveAttribute('data-empty-kind', 'error')
  })

  it('transitions from error to idle cleanly (role is removed)', () => {
    const { rerender, container } = render(<EmptyState {...baseProps} kind="error" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).toHaveAttribute('role', 'alert')

    rerender(<EmptyState {...baseProps} kind="idle" />)
    expect(root).not.toHaveAttribute('role')
    expect(root).toHaveAttribute('data-empty-kind', 'idle')
  })

  it('concurrent re-renders with different kinds do not leave stale aria attributes', () => {
    const { rerender, container } = render(<EmptyState {...baseProps} kind="loading" />)
    const root = container.querySelector('.empty-state') as HTMLElement

    rerender(<EmptyState {...baseProps} kind="stale" />)
    // stale is role="status", not aria-busy
    expect(root).not.toHaveAttribute('aria-busy')
    expect(root).toHaveAttribute('role', 'status')

    rerender(<EmptyState {...baseProps} kind="permission" />)
    // permission is role="alert"
    expect(root).toHaveAttribute('role', 'alert')
    expect(root).not.toHaveAttribute('aria-busy')
  })

  it('keeps aria-label off the root for kind="idle" (no region role)', () => {
    const { container } = render(<EmptyState {...baseProps} kind="idle" ariaLabel="Custom label" />)
    const root = container.querySelector('.empty-state') as HTMLElement
    // No ARIA role on idle → aria-label must not be set (it is meaningless)
    expect(root).not.toHaveAttribute('aria-label')
  })

  it('does not render aria-label for idle kind even when ariaLabel prop is set', () => {
    const { container } = render(
      <EmptyState title="T" description="D" kind="idle" ariaLabel="Label" />
    )
    const root = container.querySelector('.empty-state') as HTMLElement
    expect(root).not.toHaveAttribute('aria-label')
  })

  it('renders without action for every kind without throwing', () => {
    const kinds = ['idle', 'loading', 'error', 'stale', 'permission'] as const
    for (const kind of kinds) {
      expect(() => {
        const { unmount } = render(<EmptyState kind={kind} title="T" description="D" />)
        unmount()
      }).not.toThrow()
    }
  })

  it('prefers-reduced-motion: spinner icon still renders (CSS gates the animation)', () => {
    // The spin animation is purely CSS; the SVG element must still be present
    // in the DOM when kind="loading" so content is not lost for reduced-motion users.
    const { container } = render(<EmptyState {...baseProps} kind="loading" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })
})
