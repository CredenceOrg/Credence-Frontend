/**
 * Tests for ErrorBoundary catching thrown async renders — issue #742
 *
 * A React error boundary catches render-phase throws regardless of whether the
 * throw was triggered synchronously or by a resolved async operation.  These
 * tests verify the four async-render scenarios that the existing suite does
 * not cover:
 *
 *  1. lazy() resolves, but the loaded component throws on first render.
 *  2. A component schedules async work in useEffect, updates state, then throws
 *     on the subsequent render (the "async-triggered render throw" pattern).
 *  3. A custom fallback prop receives the correct error and a working reset.
 *  4. Resetting the boundary and immediately throwing again is caught a second
 *     time (the boundary is reusable across multiple failure cycles).
 */

import { lazy, Suspense, useEffect, useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Returns a React.lazy() factory whose dynamic-import Promise resolves to a
 * component that throws synchronously the first time it is rendered.
 *
 * Because the import itself succeeds, React unwraps the Suspense boundary and
 * calls the component's render function — which then throws.  This is the
 * canonical "loaded but broken" async render scenario.
 */
function makeLazyThrowingComponent(message: string) {
  const ThrowingComponent = () => {
    throw new Error(message)
  }
  return lazy(
    () =>
      // Simulate an async dynamic import that resolves successfully
      new Promise<{ default: typeof ThrowingComponent }>((resolve) =>
        setTimeout(() => resolve({ default: ThrowingComponent }), 0)
      )
  )
}

// ---------------------------------------------------------------------------
// suite
// ---------------------------------------------------------------------------

describe('ErrorBoundary – async render throws (#742)', () => {
  beforeEach(() => {
    // React's own error logging is noisy in test output; silence it.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── test 1 ─────────────────────────────────────────────────────────────────
  it('catches_error_when_lazy_component_loads_then_throws_on_render', async () => {
    // Happy path: the dynamic import resolves (no network / chunk failure).
    // Sad path:   the resolved component throws synchronously in its render.
    const LazyBroken = makeLazyThrowingComponent('async render: component is broken after load')

    render(
      <ErrorBoundary>
        <Suspense fallback={<div>Loading component…</div>}>
          <LazyBroken />
        </Suspense>
      </ErrorBoundary>
    )

    // Initially the Suspense fallback is shown while the import resolves.
    expect(screen.getByText('Loading component…')).toBeInTheDocument()

    // After the async import resolves the component tries to render and throws.
    await waitFor(() => {
      expect(screen.getByRole('alert') as HTMLElement).toHaveAttribute(
        'data-error-kind',
        'generic'
      )
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    // The Suspense fallback must no longer be visible.
    expect(screen.queryByText('Loading component…')).not.toBeInTheDocument()
  })

  // ── test 2 ─────────────────────────────────────────────────────────────────
  it('catches_error_thrown_on_render_triggered_by_resolved_async_state_update', async () => {
    /**
     * Pattern: component renders normally on first pass, then a useEffect kicks
     * off an async operation. When the operation resolves it calls setState,
     * triggering a re-render. That re-render throws.
     *
     * This is the "async-triggered render throw" pattern — the boundary must
     * catch the throw that comes from a render initiated by an async side-effect,
     * not from the initial synchronous render.
     */
    const AsyncThenThrow = () => {
      const [shouldThrow, setShouldThrow] = useState(false)

      useEffect(() => {
        // Simulate async work (e.g. a resolved data-fetch) that triggers state
        Promise.resolve().then(() => {
          setShouldThrow(true)
        })
      }, [])

      if (shouldThrow) {
        throw new Error('async state update caused render to throw')
      }

      return <div>Initial render is fine</div>
    }

    render(
      <ErrorBoundary>
        <AsyncThenThrow />
      </ErrorBoundary>
    )

    // First render completes normally.
    expect(screen.getByText('Initial render is fine')).toBeInTheDocument()

    // After the micro-task resolves the component re-renders and throws.
    await waitFor(() => {
      expect(screen.getByRole('alert') as HTMLElement).toHaveAttribute(
        'data-error-kind',
        'generic'
      )
    })
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  // ── test 3 ─────────────────────────────────────────────────────────────────
  it('passes_error_and_working_reset_to_custom_fallback_on_async_throw', async () => {
    /**
     * Verifies that when a `fallback` prop is provided:
     *  • the prop is called with the caught Error instance, and
     *  • calling the supplied reset callback clears the error state so the
     *    children re-mount.
     *
     * After reset the child is rendered with `recovered=true` so it no longer
     * throws on the subsequent re-mount, letting us verify the boundary is gone.
     */
    const THROWN_MESSAGE = 'custom fallback should receive this error'

    // External flag so the component can behave differently after reset without
    // relying on React state (which would cause another async-throw cycle).
    let recovered = false

    const AsyncThenThrow = () => {
      const [shouldThrow, setShouldThrow] = useState(false)

      useEffect(() => {
        if (recovered) return // do not throw again after reset
        Promise.resolve().then(() => setShouldThrow(true))
      }, [])

      if (shouldThrow) throw new Error(THROWN_MESSAGE)
      return <div>before throw</div>
    }

    const fallbackSpy = vi.fn((error: Error, reset: () => void) => (
      <div>
        <p data-testid="custom-message">caught: {error.message}</p>
        <button
          onClick={() => {
            recovered = true
            reset()
          }}
        >
          reset boundary
        </button>
      </div>
    ))

    render(
      <ErrorBoundary fallback={fallbackSpy}>
        <AsyncThenThrow />
      </ErrorBoundary>
    )

    // Wait for the async throw and the custom fallback to appear.
    await waitFor(() => {
      expect(screen.getByTestId('custom-message')).toBeInTheDocument()
    })

    // The fallback receives the correct error message.
    expect(screen.getByTestId('custom-message').textContent).toContain(THROWN_MESSAGE)
    expect(fallbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: THROWN_MESSAGE }),
      expect.any(Function)
    )

    // Calling reset unmounts the fallback and re-mounts the children.
    fireEvent.click(screen.getByRole('button', { name: /reset boundary/i }))

    await waitFor(() => {
      expect(screen.getByText('before throw')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('custom-message')).not.toBeInTheDocument()
  })

  // ── test 4 ─────────────────────────────────────────────────────────────────
  it('catches_second_async_throw_after_boundary_has_been_reset', async () => {
    /**
     * The boundary must remain functional after a reset.  If the newly mounted
     * child throws again (whether sync or async), the boundary catches it a
     * second time.
     *
     * Sad path: reset → child re-mounts → async operation resolves → throws
     *           again → boundary must catch the second throw too.
     *
     * We verify by observing the error UI appearing, being cleared by reset,
     * and then reappearing — two distinct catch cycles.
     */

    // Track the number of times the boundary's componentDidCatch fires via the
    // console.error proxy that ErrorBoundary uses for telemetry.
    const caughtMessages: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      if (typeof args[1] === 'string') {
        caughtMessages.push(args[1] as string)
      }
    })

    // External flag so we can control whether the second mount throws.
    let throwOnMount = true

    const RepeatAsyncThrower = () => {
      const [shouldThrow, setShouldThrow] = useState(false)

      useEffect(() => {
        if (!throwOnMount) return
        Promise.resolve().then(() => setShouldThrow(true))
      }, [])

      if (shouldThrow) throw new Error('repeated async throw')
      return <div>mounted (will throw soon)</div>
    }

    render(
      <ErrorBoundary>
        <RepeatAsyncThrower />
      </ErrorBoundary>
    )

    // ── First failure ────────────────────────────────────────────────────────
    await waitFor(() => {
      expect(screen.getByRole('alert') as HTMLElement).toHaveAttribute(
        'data-error-kind',
        'generic'
      )
    })

    // ── Reset (second mount will also throw) ─────────────────────────────────
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    })

    // ── Second failure ───────────────────────────────────────────────────────
    await waitFor(() => {
      expect(screen.getByRole('alert') as HTMLElement).toHaveAttribute(
        'data-error-kind',
        'generic'
      )
    })

    // componentDidCatch was invoked at least twice (once per caught cycle).
    const repeatedCatches = caughtMessages.filter((m) => m.includes('repeated async throw'))
    expect(repeatedCatches.length).toBeGreaterThanOrEqual(2)

    // The "Try again" button is present — the boundary is still usable.
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()

    // ── Final reset – child no longer throws ─────────────────────────────────
    throwOnMount = false

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    })

    await waitFor(() => {
      expect(screen.getByText('mounted (will throw soon)')).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: /something went wrong/i })).not.toBeInTheDocument()
  })

  // ── test 5 ─────────────────────────────────────────────────────────────────
  it('calls_componentDidCatch_with_error_and_component_stack_on_async_throw', async () => {
    /**
     * componentDidCatch is the hook for telemetry / logging.  It must be
     * invoked with the thrown Error and a React ErrorInfo object (which includes
     * `componentStack`) when the error originates from an async-triggered render.
     */
    const AsyncThenThrow = () => {
      const [shouldThrow, setShouldThrow] = useState(false)

      useEffect(() => {
        Promise.resolve().then(() => setShouldThrow(true))
      }, [])

      if (shouldThrow) throw new Error('componentDidCatch telemetry check')
      return <div>waiting</div>
    }

    // componentDidCatch proxies to console.error in the current implementation.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <AsyncThenThrow />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert') as HTMLElement).toHaveAttribute(
        'data-error-kind',
        'generic'
      )
    })

    // The boundary's componentDidCatch calls console.error with the error message.
    const calls = consoleSpy.mock.calls
    const boundaryCall = calls.find(
      (args) => typeof args[1] === 'string' && args[1].includes('componentDidCatch telemetry check')
    )
    expect(boundaryCall).toBeDefined()
    // The third argument is the component stack from React's ErrorInfo.
    expect(typeof boundaryCall?.[2]).toBe('string')
  })
})
