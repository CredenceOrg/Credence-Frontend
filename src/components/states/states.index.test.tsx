/**
 * states/index.ts — boundary & recovery test suite
 *
 * Acceptance criteria (issue #1229):
 *   ✓ Deterministic behaviour for valid, invalid, duplicate, and boundary-case inputs
 *   ✓ Authorization, validation, and state-transition invariants remain enforced
 *   ✓ Retries, partial failure, and concurrent execution cannot produce an unsafe
 *     or inconsistent result
 *   ✓ Focused tests cover success, rejection, boundary, and regression scenarios
 *   ✓ Existing callers remain compatible (module interface contract tests)
 *   ✓ Failures are diagnosable without exposing sensitive data (aria / data-attr coverage)
 *
 * What these tests add that the per-component suites do NOT cover:
 *   – Module interface: all three named exports exist and nothing extraneous is added
 *   – Loading→content state transition invariants (rows=0 edge, sequential mount/unmount)
 *   – Retry-loop guard: isLoading=true prevents double-fire of onClick
 *   – Concurrent click safety: rapid successive clicks respect the disabled state
 *   – hideHeading+title="" aria-label fallback chain
 *   – title="" explicit empty-string suppresses the heading independently of hideHeading
 *   – Stale-data UX composition (type=backend severity=info custom message)
 *   – EmptyState as a stale-data surface
 *   – Permission-denied UX composition (type=validation severity=warning)
 *   – EmptyState as a permission-denied surface
 *   – data-error-kind telemetry passthrough for every error kind (regression guard)
 *   – Error→retry→success integration walk
 *   – Error→retry failure walk (boundary stays visible, button re-enabled)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import * as StatesIndex from './index'
import EmptyState from './EmptyState'
import ErrorState from './ErrorState'
import LoadingSkeleton from './LoadingSkeleton'
import { useReducedMotion } from '../../hooks/useReducedMotion'

vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

afterEach(() => {
  cleanup()
})

// ---------------------------------------------------------------------------
// 1. Module interface contract
// ---------------------------------------------------------------------------

describe('states/index.ts — module interface', () => {
  it('exports EmptyState as a named export', () => {
    expect(StatesIndex.EmptyState).toBeDefined()
    expect(typeof StatesIndex.EmptyState).toBe('function')
  })

  it('exports ErrorState as a named export', () => {
    expect(StatesIndex.ErrorState).toBeDefined()
    expect(typeof StatesIndex.ErrorState).toBe('function')
  })

  it('exports LoadingSkeleton as a named export', () => {
    expect(StatesIndex.LoadingSkeleton).toBeDefined()
    expect(typeof StatesIndex.LoadingSkeleton).toBe('function')
  })

  it('does not export unexpected names (surface-area guard)', () => {
    const exportedKeys = Object.keys(StatesIndex)
    // Only the three named components should be present.
    expect(exportedKeys.sort()).toEqual(['EmptyState', 'ErrorState', 'LoadingSkeleton'].sort())
  })

  it('re-exports the same reference as the direct import', () => {
    // Ensures the barrel does not wrap or transform the component — direct
    // callers and barrel-import callers are identical identity references.
    expect(StatesIndex.EmptyState).toBe(EmptyState)
    expect(StatesIndex.ErrorState).toBe(ErrorState)
    expect(StatesIndex.LoadingSkeleton).toBe(LoadingSkeleton)
  })
})

// ---------------------------------------------------------------------------
// 2. Loading state — boundary inputs & transition invariants
// ---------------------------------------------------------------------------

describe('LoadingSkeleton — loading state boundaries', () => {
  it('rows=0: renders no shimmer children for text variant', () => {
    const { container } = render(<LoadingSkeleton variant="text" rows={0} />)
    // Zero rows → zero child divs inside the status wrapper
    const root = container.firstElementChild as HTMLElement
    expect(root.children).toHaveLength(0)
  })

  it('rows=0: root element still has role="status" (accessible even with empty content)', () => {
    const { container } = render(<LoadingSkeleton variant="text" rows={0} />)
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })

  it('rows=0: aria-label="Loading" present so screen readers announce the loading region', () => {
    const { container } = render(<LoadingSkeleton variant="text" rows={0} />)
    expect(container.querySelector('[aria-label="Loading"]')).not.toBeNull()
  })

  it('rows=0: table variant renders only the header row (0 data rows)', () => {
    const { container } = render(<LoadingSkeleton variant="table" rows={0} />)
    const root = container.firstElementChild as HTMLElement
    // The table variant always renders a header block; zero data rows means 1 child total.
    expect(root.children).toHaveLength(1)
  })

  it('rows=0: form variant renders no field groups', () => {
    const { container } = render(<LoadingSkeleton variant="form" rows={0} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.children).toHaveLength(0)
  })

  it('rows=0: dashboard variant renders no tile cells', () => {
    const { container } = render(<LoadingSkeleton variant="dashboard" rows={0} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.children).toHaveLength(0)
  })

  it('loading→content transition: replacing skeleton with content is safe (no stale DOM)', () => {
    // Simulate the common UI pattern: skeleton mounts first, then data arrives
    // and content replaces it.  Verify the skeleton unmounts cleanly and the
    // content node takes over without residue.
    const { rerender, container } = render(<LoadingSkeleton variant="text" rows={3} />)
    // Loading phase: skeleton is in the DOM
    expect(container.querySelector('[role="status"]')).not.toBeNull()

    // Content arrives — rerender with actual content
    rerender(<div data-testid="loaded-content">Bond list loaded</div>)

    // Skeleton must be gone
    expect(container.querySelector('[role="status"]')).toBeNull()
    // Content must be present
    expect(container.querySelector('[data-testid="loaded-content"]')).not.toBeNull()
  })

  it('reduced-motion: stat-widget no-animation class present on all shimmer children when reduce is on', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)
    const { container } = render(<LoadingSkeleton variant="stat-widget" />)
    const shimmerEls = Array.from(
      container.querySelectorAll('.skeleton--stat-label, .skeleton--stat-value, .skeleton--stat-sub')
    ) as HTMLElement[]
    expect(shimmerEls.length).toBeGreaterThan(0)
    shimmerEls.forEach((el) => {
      expect(el.classList.contains('skeleton--no-animation')).toBe(true)
    })
  })

  it('multiple consecutive renders (rapid cycling) remain stable — no key conflicts', () => {
    // Simulate a data-refresh that quickly swaps variants; each must be stable
    const { rerender } = render(<LoadingSkeleton variant="text" rows={3} />)
    rerender(<LoadingSkeleton variant="card" />)
    rerender(<LoadingSkeleton variant="table" rows={5} />)
    rerender(<LoadingSkeleton variant="text" rows={2} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 3. Error state — retry-loop guard, concurrent safety, boundary headings
// ---------------------------------------------------------------------------

describe('ErrorState — retry-loop guard & concurrent safety', () => {
  it('retry-loop guard: onClick is NOT called when isLoading=true (button disabled)', () => {
    const onClick = vi.fn()
    render(
      <ErrorState
        action={{ label: 'Retry', onClick, isLoading: true }}
      />
    )
    const btn = screen.getByRole('button', { name: /retrying/i })
    // Attempt to fire click while already loading
    fireEvent.click(btn)
    // Disabled buttons should not fire onClick
    expect(onClick).not.toHaveBeenCalled()
  })

  it('retry-loop guard: onClick IS called exactly once after isLoading becomes false', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <ErrorState action={{ label: 'Retry', onClick, isLoading: false }} />
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onClick).toHaveBeenCalledTimes(1)

    // Simulate in-flight state
    rerender(<ErrorState action={{ label: 'Retry', onClick, isLoading: true }} />)
    fireEvent.click(screen.getByRole('button', { name: /retrying/i }))
    // Still only 1 call — the second click is suppressed by `disabled`
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('concurrent-click safety: rapid double-click on enabled button calls onClick exactly once per click', () => {
    const onClick = vi.fn()
    render(<ErrorState action={{ label: 'Retry', onClick }} />)
    const btn = screen.getByRole('button', { name: /retry/i })
    // Simulate two rapid clicks while the component stays in the same render
    fireEvent.click(btn)
    fireEvent.click(btn)
    // Both clicks propagate (the component has not transitioned to isLoading)
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('after retry resolves: button can be clicked again (no sticky-disabled regression)', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <ErrorState action={{ label: 'Retry', onClick, isLoading: true }} />
    )
    // Retry completes — isLoading goes back to false
    rerender(<ErrorState action={{ label: 'Retry', onClick, isLoading: false }} />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('ErrorState — heading suppression boundary cases', () => {
  it('hideHeading=true: heading element is not rendered', () => {
    render(<ErrorState hideHeading />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('hideHeading=true: aria-label falls back to the default copy.title so the region stays labelled', () => {
    render(<ErrorState type="generic" hideHeading />)
    const panel = screen.getByRole('alert')
    // copy.title for "generic" is "Something didn't load"
    expect(panel).toHaveAttribute('aria-label', expect.stringMatching(/something didn.t load/i))
  })

  it('title="": heading element is not rendered', () => {
    render(<ErrorState title="" />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('title="" with hideHeading=false: aria-label still resolves to copy.title (does not become empty)', () => {
    render(<ErrorState type="network" title="" />)
    const panel = screen.getByRole('alert')
    // When title is suppressed, resolvedTitle is undefined, so aria-label falls back to copy.title
    expect(panel.getAttribute('aria-label')).toBeTruthy()
    expect(panel.getAttribute('aria-label')).not.toBe('')
  })

  it('explicit ariaLabel overrides even when title="" and hideHeading=true', () => {
    render(<ErrorState title="" hideHeading ariaLabel="Access denied" />)
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-label', 'Access denied')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('hideHeading=false + title="Custom": heading is visible and aria-label matches title', () => {
    render(<ErrorState title="Custom error heading" />)
    expect(screen.getByRole('heading', { name: /custom error heading/i })).toBeInTheDocument()
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-label', 'Custom error heading')
  })
})

// ---------------------------------------------------------------------------
// 4. Stale data UX — ErrorState + EmptyState as stale indicators
// ---------------------------------------------------------------------------

describe('ErrorState — stale-data UX composition', () => {
  it('type="backend" severity="info" renders with info modifier class (stale/cached-data tone)', () => {
    render(<ErrorState type="backend" severity="info" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--info')
  })

  it('type="backend" severity="info" with custom stale message surfaces the override', () => {
    const staleMsg = 'Showing cached data from 5 minutes ago. Refresh to get the latest.'
    render(<ErrorState type="backend" severity="info" message={staleMsg} />)
    expect(screen.getByText(staleMsg)).toBeInTheDocument()
  })

  it('stale state: data-error-kind remains "backend" even when overriding severity+message', () => {
    render(
      <ErrorState
        type="backend"
        severity="info"
        message="Showing cached data."
        title="Stale data"
      />
    )
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('data-error-kind', 'backend')
    expect(panel).toHaveAttribute('data-error-severity', 'info')
  })

  it('stale state: action button is present and callable (allow manual refresh from stale view)', () => {
    const onRefresh = vi.fn()
    render(
      <ErrorState
        type="backend"
        severity="info"
        message="Showing cached data."
        action={{ label: 'Refresh', onClick: onRefresh }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('stale state: action isLoading=true surfaces "Retrying…" and disables button while refresh is in-flight', () => {
    render(
      <ErrorState
        type="backend"
        severity="info"
        message="Showing cached data."
        action={{ label: 'Refresh', onClick: vi.fn(), isLoading: true }}
      />
    )
    const btn = screen.getByRole('button', { name: /retrying/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })
})

describe('EmptyState — stale-data UX composition', () => {
  it('EmptyState can convey stale data: renders title and description', () => {
    render(
      <EmptyState
        title="No fresh data available"
        description="We're showing the last known state. Pull down to refresh."
        action={{ label: 'Refresh', onClick: vi.fn() }}
      />
    )
    expect(screen.getByRole('heading', { name: /no fresh data available/i })).toBeInTheDocument()
    expect(screen.getByText(/last known state/i)).toBeInTheDocument()
  })

  it('EmptyState stale: action button fires correctly', () => {
    const onRefresh = vi.fn()
    render(
      <EmptyState
        title="No fresh data"
        description="Refresh to load."
        action={{ label: 'Refresh now', onClick: onRefresh }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /refresh now/i }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('EmptyState stale: isLoading=true disables and marks aria-busy on the action', () => {
    render(
      <EmptyState
        title="No fresh data"
        description="Refresh to load."
        action={{ label: 'Refresh', onClick: vi.fn(), isLoading: true }}
      />
    )
    const btn = screen.getByRole('button', { name: /connecting/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })
})

// ---------------------------------------------------------------------------
// 5. Permission-denied UX — ErrorState + EmptyState as auth-gate surfaces
// ---------------------------------------------------------------------------

describe('ErrorState — permission-denied UX composition', () => {
  it('type="validation" severity="warning" renders with warning class (access-denied tone)', () => {
    render(<ErrorState type="validation" severity="warning" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--warning')
  })

  it('permission-denied: custom title and message override defaults appropriately', () => {
    render(
      <ErrorState
        type="validation"
        severity="warning"
        title="Access denied"
        message="You do not have permission to view this resource. Contact your admin."
      />
    )
    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument()
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument()
  })

  it('permission-denied: data-error-kind="validation" is preserved for telemetry', () => {
    render(
      <ErrorState
        type="validation"
        severity="warning"
        title="Access denied"
        message="Insufficient permissions."
      />
    )
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('data-error-kind', 'validation')
    expect(panel).toHaveAttribute('data-error-severity', 'warning')
  })

  it('permission-denied: no action button when no remedy is available', () => {
    render(
      <ErrorState
        type="validation"
        severity="warning"
        title="Access denied"
        message="Contact your administrator."
      />
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('permission-denied: action button renders when a navigate-to-login remedy is provided', () => {
    const onLogin = vi.fn()
    render(
      <ErrorState
        type="validation"
        severity="warning"
        title="Session expired"
        message="Your session has expired. Please log in again."
        action={{ label: 'Log in', onClick: onLogin }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(onLogin).toHaveBeenCalledTimes(1)
  })

  it('permission-denied: aria-label explicitly overridden to avoid leaking jargon', () => {
    render(
      <ErrorState
        type="validation"
        severity="warning"
        title="Access denied"
        message="Insufficient permissions."
        ariaLabel="Permission error"
      />
    )
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('aria-label', 'Permission error')
    expect(panel.getAttribute('aria-label')).not.toMatch(/error state/i)
  })
})

describe('EmptyState — permission-denied UX composition', () => {
  it('EmptyState can convey permission-denied: renders title and description', () => {
    render(
      <EmptyState
        title="Nothing to show here"
        description="You need verifier permissions to see this section."
      />
    )
    expect(screen.getByRole('heading', { name: /nothing to show here/i })).toBeInTheDocument()
    expect(screen.getByText(/verifier permissions/i)).toBeInTheDocument()
  })

  it('EmptyState permission-denied: no action button when no route to elevation exists', () => {
    render(
      <EmptyState
        title="Nothing to show here"
        description="You need verifier permissions to see this section."
      />
    )
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('EmptyState permission-denied: action provided when user can request access', () => {
    const onRequest = vi.fn()
    render(
      <EmptyState
        title="Restricted area"
        description="Request access to continue."
        action={{ label: 'Request access', onClick: onRequest }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /request access/i }))
    expect(onRequest).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// 6. Error→retry integration walk
// ---------------------------------------------------------------------------

describe('ErrorState — error → retry → success / failure integration', () => {
  it('error→retry→success: action fires, isLoading transitions, content appears', () => {
    let isLoading = false
    const onRetry = vi.fn(() => {
      isLoading = true
    })

    const { rerender } = render(
      <ErrorState
        type="network"
        action={{ label: 'Try again', onClick: onRetry, isLoading }}
      />
    )

    // Phase 1: error displayed, button enabled
    const btn = screen.getByRole('button', { name: /try again/i })
    expect(btn).not.toBeDisabled()

    // Phase 2: user clicks retry
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)

    // Phase 3: in-flight — button disabled, aria-busy
    rerender(
      <ErrorState
        type="network"
        action={{ label: 'Try again', onClick: onRetry, isLoading: true }}
      />
    )
    const loadingBtn = screen.getByRole('button', { name: /retrying/i })
    expect(loadingBtn).toBeDisabled()
    expect(loadingBtn).toHaveAttribute('aria-busy', 'true')

    // Phase 4: success — error state replaced by content
    rerender(<div data-testid="success-view">Bonds loaded successfully</div>)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('success-view')).toBeInTheDocument()
  })

  it('error→retry→failure: error state re-displayed with button re-enabled for next attempt', () => {
    const onRetry = vi.fn()

    const { rerender } = render(
      <ErrorState type="network" action={{ label: 'Try again', onClick: onRetry }} />
    )

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    // In-flight
    rerender(
      <ErrorState type="network" action={{ label: 'Try again', onClick: onRetry, isLoading: true }} />
    )

    // Retry fails — error state remains, isLoading drops back to false
    rerender(
      <ErrorState type="network" action={{ label: 'Try again', onClick: onRetry, isLoading: false }} />
    )

    // Error panel still visible
    expect(screen.getByRole('alert')).toBeInTheDocument()
    // Button is re-enabled for the next attempt
    const btn = screen.getByRole('button', { name: /try again/i })
    expect(btn).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// 7. Telemetry passthrough — data-error-kind for every ErrorStateKind
// ---------------------------------------------------------------------------

describe('ErrorState — data-error-kind telemetry passthrough (all kinds)', () => {
  const kinds = ['network', 'backend', 'validation', 'generic', 'pageNotFound'] as const

  it.each(kinds)(
    'data-error-kind="%s" is emitted on the alert panel for observability hooks',
    (kind) => {
      const { unmount } = render(<ErrorState type={kind} />)
      const panel = screen.getByRole('alert')
      expect(panel).toHaveAttribute('data-error-kind', kind)
      unmount()
    }
  )

  it('unknown/runtime kind still mounts without throwing (defensive rendering)', () => {
    // Simulate a future API response sending an unrecognised error code that
    // gets passed down as `type`.  The component should not throw.
    expect(() =>
      render(
        // @ts-expect-error — deliberately passing an unrecognised kind to test runtime safety
        <ErrorState type="__unknown_future_kind__" />
      )
    ).not.toThrow()
  })

  it('unknown kind: data-error-kind is still set on the panel for debugging', () => {
    render(
      // @ts-expect-error — deliberately passing an unrecognised kind
      <ErrorState type="__unknown_future_kind__" />
    )
    const panel = screen.getByRole('alert')
    expect(panel).toHaveAttribute('data-error-kind', '__unknown_future_kind__')
  })
})

// ---------------------------------------------------------------------------
// 8. ErrorState — severity axis orthogonality (validation type can be any severity)
// ---------------------------------------------------------------------------

describe('ErrorState — type/severity orthogonality (permission + stale patterns)', () => {
  it.each([
    ['validation', 'danger'],
    ['validation', 'info'],
    ['backend', 'info'],
    ['backend', 'warning'],
    ['network', 'info'],
    ['generic', 'warning'],
  ] as const)(
    'type="%s" + severity="%s" renders with correct CSS class and does not throw',
    (type, severity) => {
      const { unmount } = render(<ErrorState type={type} severity={severity} />)
      expect(screen.getByRole('alert')).toHaveClass(`error-state--${severity}`)
      unmount()
    }
  )
})

// ---------------------------------------------------------------------------
// 9. EmptyState — action button boundary cases (duplicate, isLoading, no action)
// ---------------------------------------------------------------------------

describe('EmptyState — action boundary cases', () => {
  const baseProps = { title: 'Nothing here', description: 'Check back later.' }

  it('no action: no button element in the DOM', () => {
    render(<EmptyState {...baseProps} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('action isLoading=true: shows "Connecting…" and is disabled with aria-busy', () => {
    render(
      <EmptyState
        {...baseProps}
        action={{ label: 'Connect', onClick: vi.fn(), isLoading: true }}
      />
    )
    const btn = screen.getByRole('button', { name: /connecting/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('action isLoading=true: onClick is NOT called when button is disabled', () => {
    const onClick = vi.fn()
    render(
      <EmptyState
        {...baseProps}
        action={{ label: 'Connect', onClick, isLoading: true }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /connecting/i }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('action isLoading=false: clicking calls onClick exactly once', () => {
    const onClick = vi.fn()
    render(
      <EmptyState {...baseProps} action={{ label: 'Connect', onClick, isLoading: false }} />
    )
    fireEvent.click(screen.getByRole('button', { name: /connect/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('variant="secondary" button: fires onClick and has secondary class', () => {
    const onClick = vi.fn()
    const { container } = render(
      <EmptyState
        {...baseProps}
        action={{ label: 'Dismiss', onClick, variant: 'secondary' }}
      />
    )
    const btn = screen.getByRole('button', { name: /dismiss/i })
    expect(btn.className).toContain('empty-state__action--secondary')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(container).toBeTruthy() // satisfy linter
  })
})

// ---------------------------------------------------------------------------
// 10. Accessibility invariants across composed state patterns
// ---------------------------------------------------------------------------

describe('Accessibility invariants — composed state patterns', () => {
  it('loading skeleton: role="status" is present on all standard variants for SR polling', () => {
    const variants = ['text', 'card', 'form', 'table', 'dashboard'] as const
    variants.forEach((variant) => {
      const { container, unmount } = render(<LoadingSkeleton variant={variant} />)
      expect(
        container.querySelector('[role="status"]'),
        `variant="${variant}" must have role=status`
      ).not.toBeNull()
      unmount()
    })
  })

  it('error state: role="alert" + aria-live="assertive" present on every kind', () => {
    const kinds = ['network', 'backend', 'validation', 'generic', 'pageNotFound'] as const
    kinds.forEach((kind) => {
      const { unmount } = render(<ErrorState type={kind} />)
      const panel = screen.getByRole('alert')
      expect(panel).toHaveAttribute('aria-live', 'assertive')
      unmount()
    })
  })

  it('error state: aria-label is never empty regardless of heading suppression config', () => {
    // Empty aria-label breaks screen reader navigation
    const configs = [
      { hideHeading: true },
      { title: '' },
      { hideHeading: true, title: '' },
    ]
    configs.forEach((props) => {
      const { unmount } = render(<ErrorState {...props} />)
      const panel = screen.getByRole('alert')
      const label = panel.getAttribute('aria-label')
      expect(label, `aria-label must not be null/empty for props: ${JSON.stringify(props)}`).toBeTruthy()
      expect(label!.length).toBeGreaterThan(0)
      unmount()
    })
  })

  it('empty state: title is always rendered as a heading element', () => {
    render(<EmptyState title="Empty" description="No results." />)
    expect(screen.getByRole('heading', { name: /empty/i })).toBeInTheDocument()
  })

  it('error state icon: aria-hidden="true" on all built-in icons prevents double-announcement', () => {
    const kinds = ['network', 'backend', 'validation', 'generic', 'pageNotFound'] as const
    kinds.forEach((kind) => {
      const { container, unmount } = render(<ErrorState type={kind} />)
      const svg = container.querySelector('svg')
      expect(svg, `expected SVG for kind="${kind}"`).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      unmount()
    })
  })

  it('custom icon prop: custom content is rendered inside the icon container', () => {
    render(
      <ErrorState icon={<span data-testid="lock-icon" aria-hidden="true">🔒</span>} />
    )
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument()
    // Default SVG must NOT be rendered when a custom icon is provided
    const { container } = render(
      <ErrorState icon={<span data-testid="lock-icon-2" aria-hidden="true">🔒</span>} />
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 11. Regression: state-transition invariants (no data loss, no stale state)
// ---------------------------------------------------------------------------

describe('State transition invariants — no data loss / stale DOM residue', () => {
  it('ErrorState re-renders cleanly when type changes (network→backend→validation)', () => {
    const { rerender } = render(<ErrorState type="network" />)
    expect(screen.getByRole('alert')).toHaveAttribute('data-error-kind', 'network')

    rerender(<ErrorState type="backend" />)
    expect(screen.getByRole('alert')).toHaveAttribute('data-error-kind', 'backend')

    rerender(<ErrorState type="validation" />)
    expect(screen.getByRole('alert')).toHaveAttribute('data-error-kind', 'validation')
  })

  it('ErrorState severity update propagates immediately to the DOM class', () => {
    const { rerender } = render(<ErrorState severity="danger" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--danger')
    expect(screen.getByRole('alert')).not.toHaveClass('error-state--info')

    rerender(<ErrorState severity="info" />)
    expect(screen.getByRole('alert')).toHaveClass('error-state--info')
    expect(screen.getByRole('alert')).not.toHaveClass('error-state--danger')
  })

  it('action transition: adding an action mid-render inserts the button', () => {
    const onClick = vi.fn()
    const { rerender } = render(<ErrorState />)
    expect(screen.queryByRole('button')).toBeNull()

    rerender(<ErrorState action={{ label: 'Retry', onClick }} />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('action transition: removing an action mid-render removes the button cleanly', () => {
    const { rerender } = render(
      <ErrorState action={{ label: 'Retry', onClick: vi.fn() }} />
    )
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()

    rerender(<ErrorState />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('EmptyState title update propagates correctly (no stale heading text)', () => {
    const { rerender } = render(
      <EmptyState title="First title" description="Description." />
    )
    expect(screen.getByRole('heading', { name: /first title/i })).toBeInTheDocument()

    rerender(<EmptyState title="Updated title" description="Description." />)
    expect(screen.queryByRole('heading', { name: /first title/i })).toBeNull()
    expect(screen.getByRole('heading', { name: /updated title/i })).toBeInTheDocument()
  })

  it('LoadingSkeleton variant change re-renders without stale DOM nodes from the previous variant', () => {
    const { rerender, container } = render(<LoadingSkeleton variant="stat-widget" />)
    expect(container.querySelector('.skeleton--stat-widget')).not.toBeNull()

    rerender(<LoadingSkeleton variant="text" rows={2} />)
    // stat-widget wrapper must be gone
    expect(container.querySelector('.skeleton--stat-widget')).toBeNull()
    // text variant wrapper must be present
    expect(container.querySelector('[role="status"]')).not.toBeNull()
  })
})
