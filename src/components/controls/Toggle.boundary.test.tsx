/**
 * Toggle — boundary and adverse-condition coverage.
 *
 * The component is controlled and stateless, so the failure surface is the
 * prop/state matrix (loading, error, retry, stale, permission) plus the
 * interaction refusals that protect a persisted boolean setting from being
 * flipped twice or flipped at all while the caller has not confirmed it.
 *
 * Each block states the invariant it pins down; `Toggle.recovery.test.tsx`
 * covers the same states through a full async save/retry lifecycle.
 */

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Toggle from './Toggle'

function getSwitch(name: string): HTMLElement {
  return screen.getByRole('switch', { name })
}

/* ── Controlled value model ─────────────────────────────── */

describe('Toggle — controlled value model', () => {
  it('renders exactly the checked prop and never a local optimistic value', async () => {
    // Invariant: the switch is a pure projection of `checked`. A caller that
    // rejects the change keeps its previous value, and the UI follows it
    // instead of showing a value the backend never accepted.
    const user = userEvent.setup()
    const onChange = vi.fn()

    const { rerender } = render(
      <Toggle checked={false} onChange={onChange} ariaLabel="Enable toasts" />
    )
    expect(getSwitch('Enable toasts')).not.toBeChecked()
    expect(getSwitch('Enable toasts')).toHaveTextContent('Off')

    await user.click(getSwitch('Enable toasts'))

    // The parent never confirmed: the rendered value must be unchanged.
    rerender(<Toggle checked={false} onChange={onChange} ariaLabel="Enable toasts" />)
    expect(getSwitch('Enable toasts')).not.toBeChecked()
    expect(getSwitch('Enable toasts')).toHaveTextContent('Off')
  })

  it('emits the negation of the confirmed value, never an accumulated toggle', async () => {
    // Invariant: repeated activations before the parent re-renders emit the
    // same requested value. If the component kept internal state the second
    // click would emit `false` and a slow backend would persist a flip-flop.
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<Toggle checked={false} onChange={onChange} ariaLabel="Enable toasts" />)
    const toggle = getSwitch('Enable toasts')

    await user.click(toggle)
    await user.click(toggle)
    await user.click(toggle)

    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenNthCalledWith(1, true)
    expect(onChange).toHaveBeenNthCalledWith(2, true)
    expect(onChange).toHaveBeenNthCalledWith(3, true)
  })

  it('mirrors every value transition of the checked prop in both directions', () => {
    // Boundary: unchecked → checked → unchecked must each be reflected in
    // both aria-checked and the visible label.
    const { rerender } = render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Sync" />)
    expect(getSwitch('Sync')).toHaveAttribute('aria-checked', 'false')

    rerender(<Toggle checked onChange={vi.fn()} ariaLabel="Sync" />)
    expect(getSwitch('Sync')).toHaveAttribute('aria-checked', 'true')
    expect(getSwitch('Sync')).toHaveTextContent('On')

    rerender(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Sync" />)
    expect(getSwitch('Sync')).toHaveAttribute('aria-checked', 'false')
    expect(getSwitch('Sync')).toHaveTextContent('Off')
  })

  it('does not submit a surrounding form when activated', async () => {
    // Invariant: `type="button"` keeps a Toggle inside a `<form>` from
    // submitting unrelated fields. A stray submit is a silent data-loss path
    // for any other unsaved input on the same form.
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const onChange = vi.fn()

    render(
      <form onSubmit={onSubmit}>
        <Toggle checked={false} onChange={onChange} ariaLabel="Quiet hours" />
        <button type="submit">Save all</button>
      </form>
    )

    await user.click(getSwitch('Quiet hours'))

    expect(onChange).toHaveBeenCalledWith(true)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

/* ── Interaction refusals (disabled / loading) ──────────── */

describe('Toggle — interaction refusals', () => {
  it('refuses a programmatically dispatched click while disabled', () => {
    // Invariant: the refusal is enforced in the component, not delegated to
    // the browser. A synthetic click bypasses the HTML `disabled` attribute,
    // so without the in-handler guard a disabled control could still emit a
    // value change.
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Beta" disabled />)

    fireEvent.click(getSwitch('Beta'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('refuses a programmatically dispatched click while a save is in flight', () => {
    // Invariant: the same guard covers the loading window, so a queued click
    // that lands after the first request was dispatched cannot start a second
    // write of the same setting.
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Beta" isLoading />)

    fireEvent.click(getSwitch('Beta'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes the disabled state to assistive technology while keeping the value readable', () => {
    render(<Toggle checked onChange={vi.fn()} ariaLabel="Beta" disabled />)

    expect(getSwitch('Beta')).toBeDisabled()
    expect(getSwitch('Beta')).toBeChecked()
  })

  it('refuses keyboard activation while disabled or loading', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    const { rerender } = render(
      <Toggle checked={false} onChange={onChange} ariaLabel="Beta" disabled />
    )
    getSwitch('Beta').focus()
    await user.keyboard('{Enter}')
    await user.keyboard('{ }')

    rerender(<Toggle checked={false} onChange={onChange} ariaLabel="Beta" isLoading />)
    await user.keyboard('{Enter}')
    await user.keyboard('{ }')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('activates with Space and Enter and inverts the value in both directions', async () => {
    // Boundary: keyboard parity with pointer activation for role="switch".
    const user = userEvent.setup()
    const onChange = vi.fn()

    const { rerender } = render(<Toggle checked={false} onChange={onChange} ariaLabel="Beta" />)
    getSwitch('Beta').focus()
    await user.keyboard('{ }')
    expect(onChange).toHaveBeenNthCalledWith(1, true)

    rerender(<Toggle checked onChange={onChange} ariaLabel="Beta" />)
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenNthCalledWith(2, false)
  })

  it('drops every click of a rapid burst while loading, then accepts exactly one afterwards', async () => {
    // Concurrency boundary: a burst during the in-flight window must be a
    // no-op, and the first deliberate click after recovery must be the only
    // write.
    const user = userEvent.setup()
    const onChange = vi.fn()

    const { rerender } = render(
      <Toggle checked={false} onChange={onChange} ariaLabel="Sync" isLoading />
    )
    for (let i = 0; i < 5; i += 1) {
      await user.click(getSwitch('Sync'))
    }
    expect(onChange).not.toHaveBeenCalled()

    rerender(<Toggle checked={false} onChange={onChange} ariaLabel="Sync" isLoading={false} />)
    await user.click(getSwitch('Sync'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

/* ── Loading state ──────────────────────────────────────── */

describe('Toggle — loading state', () => {
  it('marks the switch busy and hides the On/Off label behind a spinner', () => {
    // Invariant: while a write is in flight the control is aria-busy and no
    // longer claims a settled value, so neither sighted nor screen-reader
    // users read "Off" as the confirmed state.
    const { container } = render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Auto-save" isLoading />
    )

    expect(getSwitch('Auto-save')).toHaveAttribute('aria-busy', 'true')
    expect(getSwitch('Auto-save')).not.toHaveTextContent('On')
    expect(getSwitch('Auto-save')).not.toHaveTextContent('Off')
    expect(container.querySelector('.control-toggle-spinner')).toBeInTheDocument()
    expect(container.querySelector('.control-toggle-wrapper--loading')).toBeInTheDocument()
  })

  it('announces a pending save through a polite live region', () => {
    // Invariant: the spinner is aria-hidden, so without this announcement the
    // loading state would be invisible to screen-reader users.
    const { container, rerender } = render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Auto-save" isLoading />
    )

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toHaveTextContent('Saving…')
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1)

    rerender(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Auto-save" />)
    // The region stays mounted (a region registered after the text appears is
    // not announced reliably) but must be silent when idle.
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('')
  })

  it('supports a caller-supplied loading label', () => {
    const { container } = render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Auto-save"
        isLoading
        loadingLabel="Saving quiet hours…"
      />
    )

    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('Saving quiet hours…')
  })

  it('does not mark the switch busy or loading when idle', () => {
    const { container } = render(
      <Toggle checked onChange={vi.fn()} ariaLabel="Auto-save" isLoading={false} />
    )

    expect(getSwitch('Auto-save')).not.toHaveAttribute('aria-busy')
    expect(container.querySelector('.control-toggle-wrapper--loading')).not.toBeInTheDocument()
  })

  it('recovers the confirmed value when the in-flight save succeeds', async () => {
    // Recovery: loading → ready must restore interaction and the confirmed
    // value; nothing may stay stuck in a spinner.
    const user = userEvent.setup()
    const onChange = vi.fn()

    const { rerender } = render(
      <Toggle checked={false} onChange={onChange} ariaLabel="Auto-save" isLoading />
    )
    rerender(<Toggle checked onChange={onChange} ariaLabel="Auto-save" />)

    expect(getSwitch('Auto-save')).not.toBeDisabled()
    expect(getSwitch('Auto-save')).toBeChecked()
    expect(getSwitch('Auto-save')).toHaveTextContent('On')

    await user.click(getSwitch('Auto-save'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('keeps the previous failure visible while the retry is in flight', () => {
    // Partial failure: error + loading must coexist, and the invalid marking
    // must survive the retry window instead of being reported as resolved.
    const { container } = render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Auto-save"
        isLoading
        error="Save failed"
      />
    )

    expect(getSwitch('Auto-save')).toHaveAttribute('aria-busy', 'true')
    expect(getSwitch('Auto-save')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed')
    expect(container.querySelector('.control-toggle--error')).toBeInTheDocument()
  })
})

/* ── Error state ────────────────────────────────────────── */

describe('Toggle — error state', () => {
  it('surfaces the failure message instead of only colouring the control', () => {
    // Invariant: an error that is not rendered is not diagnosable. The message
    // is linked with aria-describedby and announced with role="alert".
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Email alerts"
        error="Confirm your email first"
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Confirm your email first')
    expect(getSwitch('Email alerts')).toHaveAttribute('aria-invalid', 'true')
    expect(getSwitch('Email alerts')).toHaveAttribute('aria-describedby', alert.id)
  })

  it('treats an empty error string as "no error"', () => {
    // Boundary: `error=""` must not mark the control invalid or render an
    // empty alert, which would otherwise be announced as a blank failure.
    render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Email alerts" error="" />)

    expect(getSwitch('Email alerts')).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('derives the message id from the caller id and keeps it unique without one', () => {
    // Invariant: two Toggles on a page must never share a message id, or one
    // control would be described by the other control's failure.
    const { rerender } = render(
      <Toggle
        id="toasts-enabled"
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Toasts"
        error="Rejected"
      />
    )
    expect(getSwitch('Toasts')).toHaveAttribute('aria-describedby', 'toasts-enabled-error')

    rerender(
      <>
        <Toggle checked={false} onChange={vi.fn()} ariaLabel="Toasts" error="First failure" />
        <Toggle checked={false} onChange={vi.fn()} ariaLabel="Digest" error="Second failure" />
      </>
    )

    const [toastsAlert, digestAlert] = screen.getAllByRole('alert')
    expect(toastsAlert.id).not.toBe(digestAlert.id)
    expect(getSwitch('Toasts')).toHaveAttribute('aria-describedby', toastsAlert.id)
    expect(getSwitch('Digest')).toHaveAttribute('aria-describedby', digestAlert.id)
  })

  it('does not render a second copy of a message the caller already describes', () => {
    // Compatibility: FormField clones the control with its own
    // aria-describedby and renders the message itself. Rendering ours too
    // would announce the failure twice and duplicate the visible text.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Email alerts"
        error="Confirm your email first"
        aria-describedby="email-alerts-hint"
      />
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getSwitch('Email alerts')).toHaveAttribute('aria-describedby', 'email-alerts-hint')
    expect(getSwitch('Email alerts')).toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps the control usable for a validation error', async () => {
    // Invariant: an error describes the current value, not a permission
    // problem. Blocking interaction would trap the user in a state they
    // cannot leave.
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <Toggle
        checked={false}
        onChange={onChange}
        ariaLabel="Email alerts"
        error="Confirm your email first"
      />
    )

    await user.click(getSwitch('Email alerts'))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(getSwitch('Email alerts')).toHaveAttribute('aria-invalid', 'true')
  })

  it('clears the failure state when the error is resolved', () => {
    // Recovery: a resolved error must not leave a stuck invalid control.
    const { rerender } = render(
      <Toggle
        checked
        onChange={vi.fn()}
        ariaLabel="Email alerts"
        error="Confirm your email first"
      />
    )
    expect(getSwitch('Email alerts')).toHaveAttribute('aria-invalid', 'true')

    rerender(<Toggle checked onChange={vi.fn()} ariaLabel="Email alerts" />)

    expect(getSwitch('Email alerts')).not.toHaveAttribute('aria-invalid')
    expect(getSwitch('Email alerts')).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

/* ── Retry affordance ───────────────────────────────────── */

describe('Toggle — retry affordance', () => {
  it('offers retry only when a failure and a handler are both present', () => {
    // Boundary: an error without a handler is reported but not actionable, and
    // a handler without an error has nothing to retry.
    const { rerender } = render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Sync" error="Save failed" />
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()

    rerender(<Toggle checked={false} onChange={vi.fn()} onRetry={vi.fn()} ariaLabel="Sync" />)
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()

    rerender(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onRetry={vi.fn()}
        ariaLabel="Sync"
        error="Save failed"
      />
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('retries without flipping the setting', async () => {
    // Invariant: the retry control lives next to the switch, so a click must
    // re-run the save and nothing else. Toggling the value while retrying
    // would overwrite the user's setting with the opposite of their intent.
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onRetry = vi.fn()

    render(
      <Toggle
        checked={false}
        onChange={onChange}
        onRetry={onRetry}
        ariaLabel="Sync"
        error="Save failed"
      />
    )

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
    expect(getSwitch('Sync')).toHaveAttribute('aria-checked', 'false')
  })

  it('refuses a retry while a request is already in flight', async () => {
    // Concurrency invariant: retry must not be double-submitted, otherwise a
    // flaky backend receives parallel writes of the same value.
    const user = userEvent.setup()
    const onRetry = vi.fn()

    const { rerender } = render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onRetry={onRetry}
        ariaLabel="Sync"
        error="Save failed"
      />
    )
    rerender(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onRetry={onRetry}
        ariaLabel="Sync"
        isLoading
        error="Save failed"
      />
    )

    const retry = screen.getByRole('button', { name: 'Retry' })
    expect(retry).toBeDisabled()
    await user.click(retry)
    fireEvent.click(retry)

    expect(onRetry).not.toHaveBeenCalled()
  })

  it('does not submit a surrounding form from the retry control', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())

    render(
      <form onSubmit={onSubmit}>
        <Toggle
          checked={false}
          onChange={vi.fn()}
          onRetry={vi.fn()}
          ariaLabel="Sync"
          error="Save failed"
        />
      </form>
    )

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('supports a caller-supplied retry label', () => {
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onRetry={vi.fn()}
        retryLabel="Try again"
        ariaLabel="Sync"
        error="Save failed"
      />
    )

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('removes the retry affordance once the save succeeds', async () => {
    // Recovery: a resolved failure must clear both the message and the retry
    // control, so the UI cannot offer a retry for a completed save.
    const user = userEvent.setup()
    const onRetry = vi.fn()

    const { rerender } = render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        onRetry={onRetry}
        ariaLabel="Sync"
        error="Save failed"
      />
    )
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    rerender(<Toggle checked onChange={vi.fn()} onRetry={onRetry} ariaLabel="Sync" />)

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

/* ── Stale state ────────────────────────────────────────── */

describe('Toggle — stale state', () => {
  it('annotates the rendered value without disabling or changing it', async () => {
    // Invariant: stale means "this value may be out of date", not "do not
    // touch". The switch stays interactive so the user can still correct a
    // value the server has not confirmed yet.
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<Toggle checked={false} onChange={onChange} ariaLabel="Sync" isStale />)

    const note = screen.getByText(/out of date/i)
    expect(note.id).not.toBe('')
    expect(getSwitch('Sync')).toHaveAttribute('aria-describedby', note.id)
    expect(getSwitch('Sync')).not.toBeDisabled()
    expect(getSwitch('Sync')).toHaveAttribute('aria-checked', 'false')

    await user.click(getSwitch('Sync'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('accepts a caller-supplied stale message', () => {
    render(
      <Toggle
        checked
        onChange={vi.fn()}
        ariaLabel="Sync"
        isStale
        staleMessage="Reloading limits…"
      />
    )

    const note = screen.getByText('Reloading limits…')
    expect(getSwitch('Sync')).toHaveAttribute('aria-describedby', note.id)
  })

  it('clears the stale annotation when fresh data arrives', () => {
    // Recovery: the annotation must be tied to the data, not to the mount, so
    // a refreshed value is not permanently labelled stale.
    const { rerender } = render(<Toggle checked onChange={vi.fn()} ariaLabel="Sync" isStale />)
    expect(screen.getByText(/out of date/i)).toBeInTheDocument()

    rerender(<Toggle checked onChange={vi.fn()} ariaLabel="Sync" />)

    expect(screen.queryByText(/out of date/i)).not.toBeInTheDocument()
    expect(getSwitch('Sync')).not.toHaveAttribute('aria-describedby')
  })

  it('keeps the stale annotation and the loading affordance together', () => {
    // Boundary: a background revalidation is stale + loading at once; the
    // value must stay visible and the note must survive the busy window.
    const { container } = render(
      <Toggle checked onChange={vi.fn()} ariaLabel="Sync" isStale isLoading />
    )

    expect(screen.getByText(/out of date/i)).toBeInTheDocument()
    expect(getSwitch('Sync')).toBeDisabled()
    expect(getSwitch('Sync')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.control-toggle-spinner')).toBeInTheDocument()
  })

  it('merges the stale note with an error and a caller description', () => {
    // Boundary: describedBy is an ordered merge, so no message is dropped and
    // the caller's own tokens keep priority.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Sync"
        isStale
        error="Save failed"
        aria-describedby="sync-hint"
      />
    )

    const staleNote = screen.getByText(/out of date/i)
    const describedBy = getSwitch('Sync').getAttribute('aria-describedby')?.split(' ') ?? []
    expect(describedBy[0]).toBe('sync-hint')
    expect(describedBy).toContain(staleNote.id)
  })
})

/* ── Permission / disabled-reason state ─────────────────── */

describe('Toggle — permission state', () => {
  it('explains why a disabled control is inert', () => {
    // Invariant: an unexplained disabled control is unrecoverable for the
    // user. The reason is visible and linked through aria-describedby.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Advanced settlement"
        disabled
        disabledReason="Ask an admin to enable advanced settlement"
      />
    )

    const reason = screen.getByText('Ask an admin to enable advanced settlement')
    expect(reason.id).not.toBe('')
    expect(getSwitch('Advanced settlement')).toBeDisabled()
    expect(getSwitch('Advanced settlement')).toHaveAttribute('aria-describedby', reason.id)
  })

  it('does not show a reason while the control is not disabled', () => {
    // Boundary: a permanently mounted explanation would be noise, and would
    // also be read out for an interactive control.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Advanced settlement"
        disabledReason="Ask an admin to enable advanced settlement"
      />
    )

    expect(screen.queryByText('Ask an admin to enable advanced settlement')).not.toBeInTheDocument()
    expect(getSwitch('Advanced settlement')).not.toHaveAttribute('aria-describedby')
  })

  it('restores interaction and drops the reason once permission is granted', async () => {
    // Recovery: after a permission check resolves, the control must become
    // usable again and must not keep advertising the refusal.
    const user = userEvent.setup()
    const onChange = vi.fn()

    const { rerender } = render(
      <Toggle
        checked={false}
        onChange={onChange}
        ariaLabel="Advanced settlement"
        disabled
        disabledReason="Ask an admin to enable advanced settlement"
      />
    )

    rerender(<Toggle checked={false} onChange={onChange} ariaLabel="Advanced settlement" />)

    expect(screen.queryByText('Ask an admin to enable advanced settlement')).not.toBeInTheDocument()
    await user.click(getSwitch('Advanced settlement'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('keeps the permission refusal readable while a save is in flight', () => {
    // Boundary: `disabledReason` covers the disabled case only; a busy switch
    // is explained by the loading label, so the two must not stack up.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Advanced settlement"
        disabled
        disabledReason="Ask an admin to enable advanced settlement"
        isLoading
      />
    )

    const describedBy = getSwitch('Advanced settlement').getAttribute('aria-describedby') ?? ''
    expect(describedBy.split(' ')).toHaveLength(1)
    expect(screen.getByText('Ask an admin to enable advanced settlement')).toBeInTheDocument()
  })
})

/* ── Reflected state and passthrough attributes ──────────── */

describe('Toggle — reflected state attribute', () => {
  it('reflects one deterministic state with a documented precedence', () => {
    // Precedence: loading > error > disabled > stale > default. A single
    // attribute keeps the state machine observable in tests and devtools
    // without letting two states claim the same slot.
    const stateOf = (element: HTMLElement) =>
      element.closest('.control-toggle-wrapper')?.getAttribute('data-state')

    const { rerender, container } = render(<Toggle checked onChange={vi.fn()} ariaLabel="Sync" />)
    expect(stateOf(getSwitch('Sync'))).toBe('default')

    rerender(<Toggle checked onChange={vi.fn()} ariaLabel="Sync" isStale />)
    expect(stateOf(getSwitch('Sync'))).toBe('stale')

    rerender(<Toggle checked onChange={vi.fn()} ariaLabel="Sync" disabled />)
    expect(stateOf(getSwitch('Sync'))).toBe('disabled')

    rerender(<Toggle checked onChange={vi.fn()} ariaLabel="Sync" disabled error="Save failed" />)
    expect(stateOf(getSwitch('Sync'))).toBe('error')

    rerender(<Toggle checked onChange={vi.fn()} ariaLabel="Sync" isLoading error="Save failed" />)
    expect(stateOf(getSwitch('Sync'))).toBe('loading')
    expect(container.querySelector('.control-toggle-wrapper')).toHaveAttribute('data-state')
  })
})

describe('Toggle — aria-invalid coercion', () => {
  it.each([
    { label: 'boolean true', value: true as const, expected: 'true' },
    { label: 'string "true"', value: 'true' as const, expected: 'true' },
  ])('marks the control invalid for $label', ({ value, expected }) => {
    const { container } = render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Sync" aria-invalid={value} />
    )

    expect(getSwitch('Sync')).toHaveAttribute('aria-invalid', expected)
    expect(container.querySelector('.control-toggle--error')).toBeInTheDocument()
  })

  it.each([
    { label: 'boolean false', value: false as const },
    { label: 'string "false"', value: 'false' as const },
  ])('omits aria-invalid for $label', ({ value }) => {
    // Boundary: `aria-invalid="false"` must not be coerced into the invalid
    // state, and the attribute is omitted rather than set to "false".
    render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Sync" aria-invalid={value} />)

    expect(getSwitch('Sync')).not.toHaveAttribute('aria-invalid')
    expect(document.querySelector('.control-toggle--error')).not.toBeInTheDocument()
  })
})

describe('Toggle — attribute passthrough', () => {
  it('forwards aria-required, aria-describedby and id to the switch', () => {
    render(
      <Toggle
        id="toasts-enabled"
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Toasts"
        aria-required="true"
        aria-describedby="toasts-hint"
      />
    )

    const toggle = getSwitch('Toasts')
    expect(toggle).toHaveAttribute('id', 'toasts-enabled')
    expect(toggle).toHaveAttribute('aria-required', 'true')
    expect(toggle).toHaveAttribute('aria-describedby', 'toasts-hint')
  })

  it('omits optional attributes that were not supplied', () => {
    // Boundary: attributes are omitted, never emitted as empty strings, so
    // they do not override what a parent component would compute.
    render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Toasts" />)

    const toggle = getSwitch('Toasts')
    expect(toggle).not.toHaveAttribute('aria-required')
    expect(toggle).not.toHaveAttribute('aria-describedby')
    expect(toggle).not.toHaveAttribute('id')
    expect(toggle).not.toHaveAttribute('aria-busy')
  })

  it('keeps every control in a group independently addressable', () => {
    // Boundary: the accessible name is the only discriminator when no id is
    // supplied, so identical switches must stay separable for keyboard and
    // screen-reader users.
    render(
      <section aria-label="Notification settings">
        <Toggle checked onChange={vi.fn()} ariaLabel="Email alerts" isStale />
        <Toggle checked={false} onChange={vi.fn()} ariaLabel="Push alerts" isStale />
      </section>
    )

    const group = within(screen.getByRole('region', { name: 'Notification settings' }))
    const staleNotes = group.getAllByText(/out of date/i)
    expect(staleNotes).toHaveLength(2)
    expect(staleNotes[0].id).not.toBe(staleNotes[1].id)
    expect(group.getByRole('switch', { name: 'Email alerts' })).toBeChecked()
    expect(group.getByRole('switch', { name: 'Push alerts' })).not.toBeChecked()
  })

  it('renders without an accessible name or an id', () => {
    // Boundary: the name may come from a wrapping FormField label; the
    // component must not require either prop to render.
    expect(() => render(<Toggle checked={false} onChange={vi.fn()} />)).not.toThrow()

    expect(document.querySelector('[role="switch"]')).toBeInTheDocument()
  })
})
