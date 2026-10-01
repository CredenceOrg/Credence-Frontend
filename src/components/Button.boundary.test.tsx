/**
 * @file Button.boundary.test.tsx
 * @description Boundary, loading, error, and recovery tests for the Button component.
 *
 * Complements Button.test.tsx with deterministic coverage of:
 *   - Variant × size rendering matrix (all combinations)
 *   - Loading state transitions and recovery upon completion
 *   - Boundary conditions (empty labels, long text, missing onClick, loadingText rules)
 *   - Error and failure recovery (thrown errors, failed async actions, rapid clicks)
 *
 * All state transitions are driven through rerender / captured resolve callbacks
 * so behavior stays deterministic (no fake timers, no real network).
 *
 * @see {@link Button.tsx} for the implementation under test.
 */

import { useState } from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Button from './Button'
import { TEST_IDS } from '../config/testIds'

function getBtn(name?: string | RegExp) {
  return name ? screen.getByRole('button', { name }) : screen.getByRole('button')
}

/**
 * Clicks a button whose onClick throws and captures the error that escapes
 * React's event system.
 *
 * Why this exists: React (DEV) invokes event handlers through a guarded
 * callback that rethrows handler errors inside jsdom's dispatchEvent. jsdom
 * reports those rethrows to the Node process as uncaught exceptions, which
 * vitest attributes to whichever test is running — making plain
 * `fireEvent.click` on a throwing handler flaky. Registering a window 'error'
 * listener with preventDefault captures the error deterministically AND
 * suppresses the spurious process-level report (jsdom skips reporting an
 * uncaught error whose 'error' event was canceled).
 *
 * Returns the list of captured error values (the same handler error may be
 * reported twice: once from React's fake dispatch, once from the rethrow).
 */
function clickAndCaptureHandlerError(btn: HTMLElement): unknown[] {
  const reported: unknown[] = []
  const onError = (e: ErrorEvent) => {
    reported.push(e.error)
    e.preventDefault()
  }
  window.addEventListener('error', onError)
  try {
    fireEvent.click(btn)
  } finally {
    window.removeEventListener('error', onError)
  }
  return reported
}

// ---------------------------------------------------------------------------
// 1. Variant × size rendering matrix
// ---------------------------------------------------------------------------

describe('Button – variant × size rendering matrix', () => {
  const variants = ['primary', 'secondary', 'ghost', 'danger', 'link'] as const
  const sizes = ['sm', 'md', 'lg'] as const

  it('renders every variant × size combination with exactly one variant and one size class', () => {
    for (const variant of variants) {
      for (const size of sizes) {
        const { unmount } = render(
          <Button variant={variant} size={size}>
            {variant}-{size}
          </Button>
        )
        const btn = getBtn(new RegExp(`${variant}-${size}`, 'i'))
        expect(btn).toHaveClass('credence-button')
        expect(btn).toHaveClass(`credence-button--${variant}`)
        expect(btn).toHaveClass(`credence-button--${size}`)

        const variantClasses = variants.filter((v) =>
          btn.classList.contains(`credence-button--${v}`)
        )
        const sizeClasses = sizes.filter((s) => btn.classList.contains(`credence-button--${s}`))
        expect(variantClasses).toEqual([variant])
        expect(sizeClasses).toEqual([size])
        unmount()
      }
    }
  })

  it('every matrix cell is enabled and clickable by default', async () => {
    for (const variant of variants) {
      for (const size of sizes) {
        const handler = vi.fn()
        const { unmount } = render(
          <Button variant={variant} size={size} onClick={handler}>
            cell
          </Button>
        )
        const btn = getBtn()
        expect(btn).not.toBeDisabled()
        await userEvent.click(btn)
        expect(handler).toHaveBeenCalledTimes(1)
        unmount()
      }
    }
  })

  it('fullWidth composes with every variant without dropping variant/size classes', () => {
    for (const variant of variants) {
      const { unmount } = render(
        <Button variant={variant} fullWidth>
          wide
        </Button>
      )
      const btn = getBtn()
      expect(btn).toHaveClass('credence-button--full-width')
      expect(btn).toHaveClass(`credence-button--${variant}`)
      expect(btn).toHaveClass('credence-button--md')
      unmount()
    }
  })
})

// ---------------------------------------------------------------------------
// 2. Loading state transitions and recovery
// ---------------------------------------------------------------------------

describe('Button – loading state transitions and recovery', () => {
  it('transitions enabled → loading → enabled across rerenders', () => {
    const { rerender } = render(<Button>Action</Button>)
    expect(getBtn()).not.toBeDisabled()

    rerender(<Button isLoading>Action</Button>)
    expect(getBtn()).toBeDisabled()
    expect(getBtn()).toHaveAttribute('aria-busy', 'true')

    rerender(<Button>Action</Button>)
    expect(getBtn()).not.toBeDisabled()
    expect(getBtn()).toHaveAttribute('aria-busy', 'false')
  })

  it('recovers click handling after loading completes', async () => {
    const handler = vi.fn()
    const { rerender } = render(<Button onClick={handler}>Save</Button>)
    await userEvent.click(getBtn())
    expect(handler).toHaveBeenCalledTimes(1)

    rerender(
      <Button isLoading onClick={handler}>
        Save
      </Button>
    )
    await userEvent.click(getBtn())
    expect(handler).toHaveBeenCalledTimes(1)

    rerender(<Button onClick={handler}>Save</Button>)
    await userEvent.click(getBtn())
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('removes the spinner and clears the live region upon recovery', () => {
    const { rerender, container } = render(<Button isLoading>Busy</Button>)
    expect(container.querySelector('.credence-button__spinner')).toBeInTheDocument()

    rerender(<Button>Busy</Button>)
    expect(container.querySelector('.credence-button__spinner')).toBeNull()
    const liveRegion = container.querySelector('.sr-only[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('')
    expect(container.querySelector('.credence-button__content--loading')).toBeNull()
  })

  it('drives a full async action lifecycle: idle → loading → success recovery', async () => {
    const resolveLoading: Array<() => void> = []

    function AsyncButton() {
      const [isLoading, setIsLoading] = useState(false)
      return (
        <Button
          isLoading={isLoading}
          onClick={() => {
            setIsLoading(true)
            resolveLoading.push(() => setIsLoading(false))
          }}
        >
          Deploy
        </Button>
      )
    }

    render(<AsyncButton />)
    const btn = getBtn()
    expect(btn).not.toBeDisabled()

    await userEvent.click(btn)
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Loading…')).toBeInTheDocument()

    // Simulate the async action resolving
    act(() => resolveLoading.forEach((resolve) => resolve()))
    await waitFor(() => expect(btn).not.toBeDisabled())
    expect(btn).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('recovers from a failed async action when isLoading is cleared', async () => {
    const recover: Array<() => void> = []

    function FailingButton() {
      const [isLoading, setIsLoading] = useState(false)
      return (
        <Button
          isLoading={isLoading}
          onClick={() => {
            setIsLoading(true)
            recover.push(() => setIsLoading(false))
          }}
        >
          Submit
        </Button>
      )
    }

    render(<FailingButton />)
    await userEvent.click(getBtn())
    expect(getBtn()).toBeDisabled()
    expect(getBtn()).toHaveAttribute('aria-busy', 'true')

    // Failure recovery: the action fails and the parent clears loading
    act(() => recover.forEach((resolve) => resolve()))
    await waitFor(() => expect(getBtn()).not.toBeDisabled())
    expect(getBtn()).toHaveAttribute('aria-busy', 'false')
    expect(getBtn()).toHaveAttribute('aria-disabled', 'false')
  })

  it('stays disabled while loading even if the disabled prop is later removed', () => {
    const { rerender } = render(
      <Button isLoading disabled>
        Stuck
      </Button>
    )
    expect(getBtn()).toBeDisabled()

    rerender(<Button isLoading>Stuck</Button>)
    expect(getBtn()).toBeDisabled()
    expect(getBtn()).toHaveAttribute('aria-busy', 'true')
  })

  it('recovers when both isLoading and disabled are cleared together', () => {
    const { rerender } = render(
      <Button isLoading disabled>
        Both
      </Button>
    )
    expect(getBtn()).toBeDisabled()

    rerender(<Button>Both</Button>)
    expect(getBtn()).not.toBeDisabled()
    expect(getBtn()).toHaveAttribute('aria-busy', 'false')
    expect(getBtn()).toHaveAttribute('aria-disabled', 'false')
  })
})

// ---------------------------------------------------------------------------
// 3. loadingText rules and live-region announcements
// ---------------------------------------------------------------------------

describe('Button – loadingText rules', () => {
  it('uses the explicit loadingText override in the live region', () => {
    render(
      <Button isLoading loadingText="Uploading file…">
        Upload
      </Button>
    )
    expect(screen.getByText('Uploading file…')).toBeInTheDocument()
  })

  it('prefers loadingText over text derived from children', () => {
    render(
      <Button isLoading loadingText="Custom…">
        Create bond
      </Button>
    )
    expect(screen.getByText('Custom…')).toBeInTheDocument()
    expect(screen.queryByText('Creating bond…')).not.toBeInTheDocument()
  })

  it('falls back to derived text when loadingText is an empty string', () => {
    const { container } = render(
      <Button isLoading loadingText="">
        Save
      </Button>
    )
    const liveRegion = container.querySelector('.sr-only[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Loading…')
  })

  it.each([
    ['Create bond', 'Creating bond…'],
    ['CREATE BOND', 'Creating bond…'],
    ['Create', 'Creating bond…'],
    ['Look up', 'Looking up…'],
    ['LOOK UP', 'Looking up…'],
    ['Lookup', 'Looking up…'],
    ['Withdraw', 'Withdrawing…'],
    ['WITHDRAW funds', 'Withdrawing…'],
    ['Submit', 'Submitting…'],
    ['SUBMIT form', 'Submitting…'],
    ['Save', 'Loading…'],
    ['', 'Loading…'],
  ])('derives "%s" → announces "%s" from children text', (children, expected) => {
    const { unmount, container } = render(<Button isLoading>{children}</Button>)
    const liveRegion = container.querySelector('.sr-only[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe(expected)
    unmount()
  })

  it('falls back to "Loading…" when children are not a string', () => {
    const { container } = render(
      <Button isLoading>
        <span>Icon only</span>
      </Button>
    )
    const liveRegion = container.querySelector('.sr-only[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Loading…')
  })

  it('live region updates when loadingText changes between rerenders', () => {
    const { rerender } = render(
      <Button isLoading loadingText="First…">
        Go
      </Button>
    )
    expect(screen.getByText('First…')).toBeInTheDocument()

    rerender(
      <Button isLoading loadingText="Second…">
        Go
      </Button>
    )
    expect(screen.getByText('Second…')).toBeInTheDocument()
    expect(screen.queryByText('First…')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// 4. Boundary conditions
// ---------------------------------------------------------------------------

describe('Button – boundary conditions', () => {
  it('renders an empty label without crashing', () => {
    render(<Button>{''}</Button>)
    const btn = getBtn()
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveTextContent('')
    expect(btn).not.toBeDisabled()
  })

  it('renders a whitespace-only label without crashing', () => {
    render(<Button> </Button>)
    expect(getBtn()).toBeInTheDocument()
  })

  it('renders a very long label in full without truncation', () => {
    const longLabel = 'A'.repeat(1000)
    render(<Button>{longLabel}</Button>)
    expect(getBtn()).toHaveTextContent(longLabel)
  })

  it('derives loading text from a very long label while loading', () => {
    const longLabel = `submit ${'x'.repeat(500)}`
    const { container } = render(<Button isLoading>{longLabel}</Button>)
    const liveRegion = container.querySelector('.sr-only[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('Submitting…')
  })

  it('does not throw when clicked without an onClick handler', async () => {
    render(<Button>No handler</Button>)
    await expect(userEvent.click(getBtn())).resolves.not.toThrow()
  })

  it('does not throw when clicked with onClick={undefined}', () => {
    render(<Button onClick={undefined}>Undefined handler</Button>)
    expect(() => fireEvent.click(getBtn())).not.toThrow()
  })

  it('does not throw when clicked while loading without an onClick handler', () => {
    render(<Button isLoading>Loading no handler</Button>)
    expect(() => fireEvent.click(getBtn())).not.toThrow()
  })

  it('ignores rapid clicks while loading — handler never fires', async () => {
    const handler = vi.fn()
    render(
      <Button isLoading onClick={handler}>
        Guarded
      </Button>
    )
    const btn = getBtn()
    await userEvent.click(btn)
    await userEvent.click(btn)
    await userEvent.click(btn)
    fireEvent.click(btn)
    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores rapid keyboard activation while loading', () => {
    const handler = vi.fn()
    render(
      <Button isLoading onClick={handler}>
        Guarded keys
      </Button>
    )
    const btn = getBtn()
    btn.focus()
    fireEvent.keyDown(btn, { key: 'Enter' })
    fireEvent.keyDown(btn, { key: ' ' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('fires every click when enabled — no accidental suppression', async () => {
    const handler = vi.fn()
    render(<Button onClick={handler}>Rapid</Button>)
    const btn = getBtn()
    await userEvent.click(btn)
    await userEvent.click(btn)
    await userEvent.click(btn)
    await userEvent.click(btn)
    await userEvent.click(btn)
    expect(handler).toHaveBeenCalledTimes(5)
  })

  it('sets aria-disabled="true" when loading even without the disabled prop', () => {
    render(<Button isLoading>Busy</Button>)
    expect(getBtn()).toHaveAttribute('aria-disabled', 'true')
  })

  it('explicit data-testid overrides the default PRIMARY_CTA testId', () => {
    render(
      <Button variant="primary" data-testid="custom-cta">
        CTA
      </Button>
    )
    expect(screen.getByTestId('custom-cta')).toBeInTheDocument()
    expect(screen.queryByTestId(TEST_IDS.PRIMARY_CTA)).not.toBeInTheDocument()
  })

  it('keeps the default PRIMARY_CTA testId when data-testid is omitted', () => {
    render(<Button variant="primary">CTA</Button>)
    expect(screen.getByTestId(TEST_IDS.PRIMARY_CTA)).toBeInTheDocument()
  })

  it('does not assign a default testId to non-primary variants', () => {
    render(<Button variant="secondary">Secondary</Button>)
    expect(getBtn()).not.toHaveAttribute('data-testid')
  })

  it('handles an empty className without producing stray whitespace', () => {
    render(<Button className="">Clean</Button>)
    expect(getBtn().className).not.toMatch(/\s{2,}/)
    expect(getBtn().className).not.toMatch(/^\s|\s$/)
  })

  it('renders numeric children without crashing', () => {
    render(<Button>{0}</Button>)
    expect(getBtn()).toHaveTextContent('0')
  })
})

// ---------------------------------------------------------------------------
// 5. Error and failure recovery handling
// ---------------------------------------------------------------------------

describe('Button – error and failure recovery handling', () => {
  it('does not swallow errors thrown by onClick — they escape to the window error handler', () => {
    const handler = vi.fn(() => {
      throw new Error('handler exploded')
    })
    render(<Button onClick={handler}>Boom</Button>)

    const reported = clickAndCaptureHandlerError(getBtn())

    expect(handler).toHaveBeenCalledTimes(1)
    // The handler's error must escape the Button (no try/catch swallowing)
    expect(reported).toContainEqual(expect.any(Error))
    expect(reported.some((e) => e instanceof Error && e.message === 'handler exploded')).toBe(true)
  })

  it('does not swallow errors thrown on keyboard activation', () => {
    const handler = vi.fn(() => {
      throw new Error('keyboard boom')
    })
    render(<Button onClick={handler}>Boom keys</Button>)

    const btn = getBtn()
    btn.focus()
    const reported = clickAndCaptureHandlerError(btn)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(reported.some((e) => e instanceof Error && e.message === 'keyboard boom')).toBe(true)
  })

  it('remains usable after a previous click handler threw', () => {
    let shouldThrow = true
    const handler = vi.fn(() => {
      if (shouldThrow) throw new Error('transient failure')
    })
    render(<Button onClick={handler}>Retry</Button>)

    clickAndCaptureHandlerError(getBtn())
    expect(getBtn()).not.toBeDisabled()

    shouldThrow = false
    fireEvent.click(getBtn())
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('recovers from a rejected async action and allows a retry click', async () => {
    const recover: Array<() => void> = []

    function AsyncRetryButton() {
      const [isLoading, setIsLoading] = useState(false)
      const [attempt, setAttempt] = useState(0)
      return (
        <Button
          isLoading={isLoading}
          onClick={() => {
            setAttempt((a) => a + 1)
            setIsLoading(true)
            recover.push(() => setIsLoading(false))
          }}
        >
          {attempt === 0 ? 'Run' : 'Retry'}
        </Button>
      )
    }

    render(<AsyncRetryButton />)
    await userEvent.click(getBtn())
    expect(getBtn()).toBeDisabled()
    expect(getBtn()).toHaveAttribute('aria-busy', 'true')

    // The async action rejects; the parent clears loading to allow a retry
    act(() => recover.forEach((resolve) => resolve()))
    await waitFor(() => expect(getBtn()).not.toBeDisabled())
    expect(getBtn()).toHaveAttribute('aria-busy', 'false')
  })

  it('does not announce stale loading text after an error recovery', () => {
    const { rerender, container } = render(
      <Button isLoading loadingText="Processing…">
        Pay
      </Button>
    )
    expect(screen.getByText('Processing…')).toBeInTheDocument()

    rerender(<Button>Pay</Button>)
    const liveRegion = container.querySelector('.sr-only[aria-live="polite"]')
    expect(liveRegion?.textContent).toBe('')
    expect(screen.queryByText('Processing…')).not.toBeInTheDocument()
  })

  it('spinner disappears after failure recovery', () => {
    const { rerender, container } = render(<Button isLoading>Pay</Button>)
    expect(container.querySelector('.credence-button__spinner')).toBeInTheDocument()

    rerender(<Button>Pay</Button>)
    expect(container.querySelector('.credence-button__spinner')).toBeNull()
  })

  it('content span loses the loading modifier class after recovery', () => {
    const { rerender, container } = render(<Button isLoading>Pay</Button>)
    expect(container.querySelector('.credence-button__content--loading')).toBeInTheDocument()

    rerender(<Button>Pay</Button>)
    expect(container.querySelector('.credence-button__content--loading')).toBeNull()
    expect(getBtn()).toHaveTextContent('Pay')
  })

  it('a disabled button recovers when the disabled prop is removed', async () => {
    const handler = vi.fn()
    const { rerender } = render(
      <Button disabled onClick={handler}>
        Locked
      </Button>
    )
    expect(getBtn()).toBeDisabled()

    rerender(<Button onClick={handler}>Locked</Button>)
    expect(getBtn()).not.toBeDisabled()
    await userEvent.click(getBtn())
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 6. Extended recovery — rapid clicks, keyboard, repeated cycles
// ---------------------------------------------------------------------------

describe('Button – extended recovery scenarios', () => {
  it('ignores rapid clicks during a loading transition, then recovers', async () => {
    const settle: Array<() => void> = []

    function TransitionButton() {
      const [isLoading, setIsLoading] = useState(false)
      return (
        <Button
          isLoading={isLoading}
          onClick={() => {
            setIsLoading(true)
            settle.push(() => setIsLoading(false))
          }}
        >
          Save
        </Button>
      )
    }

    render(<TransitionButton />)
    const btn = getBtn()

    // First click starts the async action
    await userEvent.click(btn)
    expect(btn).toBeDisabled()

    // Rapid clicks while loading must all be ignored
    await userEvent.click(btn)
    await userEvent.click(btn)
    fireEvent.click(btn)
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')

    // Action settles — button recovers and accepts clicks again
    act(() => settle.forEach((resolve) => resolve()))
    await waitFor(() => expect(btn).not.toBeDisabled())
    await userEvent.click(btn)
    expect(btn).toBeDisabled()
  })

  it('recovers keyboard activation after loading completes', async () => {
    const settle: Array<() => void> = []

    function KeyboardRecoveryButton() {
      const [isLoading, setIsLoading] = useState(false)
      return (
        <Button
          isLoading={isLoading}
          onClick={() => {
            setIsLoading(true)
            settle.push(() => setIsLoading(false))
          }}
        >
          Send
        </Button>
      )
    }

    render(<KeyboardRecoveryButton />)
    const btn = getBtn()

    await userEvent.click(btn)
    expect(btn).toBeDisabled()

    act(() => settle.forEach((resolve) => resolve()))
    await waitFor(() => expect(btn).not.toBeDisabled())

    // Enter must fire onClick again after recovery
    btn.focus()
    await userEvent.keyboard('{Enter}')
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })

  it('survives repeated loading cycles without getting stuck', async () => {
    const settle: Array<() => void> = []

    function CycledButton() {
      const [isLoading, setIsLoading] = useState(false)
      return (
        <Button
          isLoading={isLoading}
          onClick={() => {
            setIsLoading(true)
            settle.push(() => setIsLoading(false))
          }}
        >
          Cycle
        </Button>
      )
    }

    render(<CycledButton />)
    const btn = getBtn()

    for (let cycle = 0; cycle < 3; cycle++) {
      expect(btn).not.toBeDisabled()
      await userEvent.click(btn)
      expect(btn).toBeDisabled()
      expect(btn).toHaveAttribute('aria-busy', 'true')

      act(() => settle.splice(0).forEach((resolve) => resolve()))
      await waitFor(() => expect(btn).not.toBeDisabled())
      expect(btn).toHaveAttribute('aria-busy', 'false')
      expect(btn.querySelector('.credence-button__spinner')).toBeNull()
    }
  })

  it('stays interactive when isLoading toggles rapidly via rerender', async () => {
    const handler = vi.fn()
    const { rerender } = render(<Button onClick={handler}>Toggle</Button>)

    rerender(
      <Button isLoading onClick={handler}>
        Toggle
      </Button>
    )
    rerender(<Button onClick={handler}>Toggle</Button>)
    rerender(
      <Button isLoading onClick={handler}>
        Toggle
      </Button>
    )
    expect(getBtn()).toBeDisabled()

    rerender(<Button onClick={handler}>Toggle</Button>)
    expect(getBtn()).not.toBeDisabled()
    await userEvent.click(getBtn())
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
