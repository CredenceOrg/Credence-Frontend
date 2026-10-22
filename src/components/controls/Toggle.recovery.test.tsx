/**
 * Toggle — recovery coverage through a full save lifecycle.
 *
 * `Toggle.boundary.test.tsx` pins the prop/state matrix in isolation. This
 * file drives the same states through a controlled parent that models a real
 * persisted setting: optimistic apply, in-flight window, rejection, retry,
 * permission refusal, and a background revalidation that can resolve out of
 * order. The assertions are about the invariants that keep a boolean setting
 * recoverable — a failed write must never be presented as a successful one,
 * and no response may overwrite a newer confirmed value.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Toggle from './Toggle'

type SaveOutcome =
  { ok: true; value: boolean } | { ok: false; reason: string; permission?: boolean }

/** A queued outcome, or a factory for one that resolves later or by attempt. */
type Outcome = SaveOutcome | ((attempt: number) => SaveOutcome | Promise<SaveOutcome>)

async function resolveOutcome(outcome: Outcome, attempt: number): Promise<SaveOutcome> {
  return typeof outcome === 'function' ? await outcome(attempt) : outcome
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

interface HarnessProps {
  initial: boolean
  /** Deterministic queue of backend outcomes; the last entry repeats. */
  outcomes: Outcome[]
  /** Applies the requested value before the backend answers (optimistic UI). */
  optimistic?: boolean
  /** Permission state owned by the caller, as it would be in a real session. */
  blockedReason?: string
  onPermissionDenied?: (reason: string) => void
  onCommit?: (value: boolean) => void
  onAttempt?: (attempt: number) => void
}

/**
 * Minimal settings harness modelled on the repo's mutation contract
 * (`useMutation` + `useDebouncedAutoSave`): one write at a time, a monotonic
 * ticket so a superseded response is discarded, and a rollback to the last
 * value the backend confirmed when a write is rejected.
 */
function ToggleHarness({
  initial,
  outcomes,
  optimistic = false,
  blockedReason,
  onPermissionDenied,
  onCommit,
  onAttempt,
}: HarnessProps) {
  const [display, setDisplay] = useState(initial)
  const [confirmed, setConfirmed] = useState(initial)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isStale, setIsStale] = useState(false)

  const confirmedRef = useRef(initial)
  const attemptsRef = useRef(0)
  // Monotonic ticket: a response from a superseded request is dropped, so a
  // slow retry or revalidation can never clobber a newer confirmed value.
  const ticketRef = useRef(0)

  const commit = (value: boolean) => {
    confirmedRef.current = value
    setConfirmed(value)
    setDisplay(value)
  }

  const runSave = async (next: boolean) => {
    const ticket = (ticketRef.current += 1)
    const attempt = attemptsRef.current
    attemptsRef.current += 1
    onAttempt?.(attempt)

    setIsPending(true)
    // The previous failure stays on screen for the whole retry window; it is
    // cleared when the write resolves, not when it starts.
    if (optimistic) setDisplay(next)

    const outcome = await resolveOutcome(
      outcomes[attempt] ?? outcomes[outcomes.length - 1],
      attempt
    )

    if (ticket !== ticketRef.current) return

    setIsPending(false)
    if (outcome.ok) {
      commit(outcome.value)
      setError(undefined)
      // A confirmed write is fresher than any background revalidation that
      // was still in flight, so the stale annotation is retired here.
      setIsStale(false)
      onCommit?.(outcome.value)
      return
    }

    setDisplay(confirmedRef.current)
    if (outcome.permission) {
      // A 403 is not transient: report it once, as a reason, and stop offering
      // a retry that cannot succeed.
      setError(undefined)
      onPermissionDenied?.(outcome.reason)
      return
    }
    setError(outcome.reason)
  }

  const runRefresh = async () => {
    const ticket = (ticketRef.current += 1)
    const attempt = attemptsRef.current
    attemptsRef.current += 1
    onAttempt?.(attempt)

    setIsStale(true)
    const outcome = await resolveOutcome(
      outcomes[attempt] ?? outcomes[outcomes.length - 1],
      attempt
    )

    // Superseded by a newer write: this response predates it, so it is dropped
    // wholesale — applying it would revert a value the user already confirmed.
    if (ticket !== ticketRef.current) return

    // A rejected revalidation keeps the last confirmed value on screen and
    // keeps the annotation, so the user is never shown an unknown value.
    if (!outcome.ok) return
    setIsStale(false)
    commit(outcome.value)
  }

  return (
    <div>
      <Toggle
        checked={display}
        onChange={(next) => {
          void runSave(next)
        }}
        onRetry={() => {
          void runSave(!confirmedRef.current)
        }}
        ariaLabel="Enable toasts"
        disabled={Boolean(blockedReason)}
        disabledReason={blockedReason}
        isLoading={isPending}
        error={error}
        isStale={isStale}
      />
      <button type="button" onClick={() => void runRefresh()}>
        Refresh limits
      </button>
      <output aria-label="confirmed value">{String(confirmed)}</output>
    </div>
  )
}

function getSwitch(): HTMLElement {
  return screen.getByRole('switch', { name: 'Enable toasts' })
}

/**
 * Session wrapper: the permission refusal is owned by the caller (it comes
 * from the auth/role query), so granting it again has to flow back in as a
 * prop for the control to become usable.
 */
function PermissionHarness({
  initial,
  outcomes,
  onAttempt,
  onCommit,
}: Pick<HarnessProps, 'initial' | 'outcomes' | 'onAttempt' | 'onCommit'>) {
  const [blockedReason, setBlockedReason] = useState<string | undefined>(undefined)

  return (
    <>
      <ToggleHarness
        initial={initial}
        outcomes={outcomes}
        blockedReason={blockedReason}
        onPermissionDenied={setBlockedReason}
        onAttempt={onAttempt}
        onCommit={onCommit}
      />
      <button type="button" onClick={() => setBlockedReason(undefined)}>
        Grant permission
      </button>
    </>
  )
}

/* ── Success ───────────────────────────────────────────── */

describe('Toggle — successful write', () => {
  it('commits exactly one write for a double click and ends on the confirmed value', async () => {
    // Invariant: the loading window serialises writes, so a double click on a
    // settings row cannot persist two competing values. The switch refuses the
    // second click, so only one request is ever issued.
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    const onCommit = vi.fn()
    const inFlight = deferred<SaveOutcome>()

    render(
      <ToggleHarness
        initial={false}
        outcomes={[() => inFlight.promise]}
        onAttempt={onAttempt}
        onCommit={onCommit}
      />
    )

    await user.dblClick(getSwitch())
    // Second click lands inside the in-flight window and is refused.
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(getSwitch()).toBeDisabled()

    await act(async () => {
      inFlight.resolve({ ok: true, value: true })
    })

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(true))
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(getSwitch()).toBeChecked()
    expect(getSwitch()).not.toHaveAttribute('aria-busy')
    expect(screen.getByLabelText('confirmed value')).toHaveTextContent('true')
  })

  it('keeps the switch disabled for the whole in-flight window', async () => {
    // Timing boundary: the control must be inert from the click until the
    // backend answers, not only while the request is being dispatched.
    const user = userEvent.setup()
    const pending = deferred<SaveOutcome>()

    render(<ToggleHarness initial={false} outcomes={[() => pending.promise]} />)

    await user.click(getSwitch())
    expect(getSwitch()).toBeDisabled()
    expect(getSwitch()).toHaveAttribute('aria-busy', 'true')

    await act(async () => {
      pending.resolve({ ok: true, value: true })
    })

    await waitFor(() => expect(getSwitch()).not.toBeDisabled())
    expect(getSwitch()).toBeChecked()
  })
})

/* ── Rejection and rollback ─────────────────────────────── */

describe('Toggle — rejected write', () => {
  it('never presents a rejected value as saved', async () => {
    // Invariant: silent data loss starts with a UI that claims a write
    // succeeded. The failure must be visible and the value must not move.
    const user = userEvent.setup()
    const onCommit = vi.fn()

    render(
      <ToggleHarness
        initial={false}
        outcomes={[{ ok: false, reason: 'Network unreachable' }]}
        onCommit={onCommit}
      />
    )

    await user.click(getSwitch())

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network unreachable'))
    expect(onCommit).not.toHaveBeenCalled()
    expect(getSwitch()).not.toBeChecked()
    expect(getSwitch()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('confirmed value')).toHaveTextContent('false')
  })

  it('rolls an optimistic value back to the last confirmed one', async () => {
    // Invariant: an optimistic apply is provisional. On rejection the parent
    // rolls back and Toggle — which holds no state of its own — renders the
    // confirmed value again instead of keeping a half-applied setting.
    const user = userEvent.setup()
    const inFlight = deferred<SaveOutcome>()

    render(<ToggleHarness initial={false} optimistic outcomes={[() => inFlight.promise]} />)

    await user.click(getSwitch())
    expect(getSwitch()).toBeChecked()

    await act(async () => {
      inFlight.resolve({ ok: false, reason: 'Save rejected' })
    })

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Save rejected'))
    expect(getSwitch()).not.toBeChecked()
    expect(getSwitch()).toHaveTextContent('Off')
  })

  it('accepts a fresh attempt after a failure without a retry press', async () => {
    // Recovery: a validation-style failure does not lock the control; the user
    // can correct the setting by toggling again.
    const user = userEvent.setup()
    const onCommit = vi.fn()

    render(
      <ToggleHarness
        initial={false}
        outcomes={[
          { ok: false, reason: 'Save rejected' },
          { ok: true, value: true },
        ]}
        onCommit={onCommit}
      />
    )

    await user.click(getSwitch())
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    await user.click(getSwitch())

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(true))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getSwitch()).toBeChecked()
  })
})

/* ── Retry ──────────────────────────────────────────────── */

describe('Toggle — retry after a failure', () => {
  it('retries the failed write and recovers the value', async () => {
    // Invariant: retry re-runs the same write with the intended value; it is
    // not a toggle, so the setting cannot be flipped by retrying.
    const user = userEvent.setup()
    const onCommit = vi.fn()
    const onAttempt = vi.fn()

    render(
      <ToggleHarness
        initial={false}
        outcomes={[
          { ok: false, reason: 'Save rejected' },
          { ok: true, value: true },
        ]}
        onCommit={onCommit}
        onAttempt={onAttempt}
      />
    )

    await user.click(getSwitch())
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(getSwitch()).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(true))
    expect(onAttempt).toHaveBeenCalledTimes(2)
    expect(getSwitch()).toBeChecked()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  })

  it('keeps the last confirmed value across repeated failed retries', async () => {
    // Partial failure: exhausting retries must degrade to "unchanged and
    // reported", never to a value the user never confirmed.
    const user = userEvent.setup()
    const onCommit = vi.fn()

    render(
      <ToggleHarness
        initial
        outcomes={[{ ok: false, reason: 'Save rejected' }]}
        onCommit={onCommit}
      />
    )

    await user.click(getSwitch())
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(getSwitch()).not.toBeDisabled())

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(getSwitch()).not.toBeDisabled())

    expect(onCommit).not.toHaveBeenCalled()
    expect(getSwitch()).toBeChecked()
    expect(screen.getByRole('alert')).toHaveTextContent('Save rejected')
  })

  it('does not allow a retry while the previous retry is still in flight', async () => {
    // Concurrency invariant: parallel retries of the same write are what turn a
    // transient failure into duplicated side effects.
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    const pendingRetry = deferred<SaveOutcome>()

    render(
      <ToggleHarness
        initial={false}
        outcomes={[{ ok: false, reason: 'Save rejected' }, () => pendingRetry.promise]}
        onAttempt={onAttempt}
      />
    )

    await user.click(getSwitch())
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    const retry = screen.getByRole('button', { name: 'Retry' })
    expect(retry).toBeDisabled()
    await user.click(retry)

    expect(onAttempt).toHaveBeenCalledTimes(2)

    await act(async () => {
      pendingRetry.resolve({ ok: true, value: true })
    })
    await waitFor(() => expect(getSwitch()).toBeChecked())
  })
})

/* ── Permission refusal ─────────────────────────────────── */

describe('Toggle — permission refusal', () => {
  it('refuses further writes until the permission is granted, then recovers', async () => {
    // Invariant: a 403 is not a transient failure. Retrying it would be
    // pointless, so the control is disabled with an explanation and no retry
    // affordance, and the value the user had is preserved untouched. Once the
    // permission is granted the control is usable again, so the user is never
    // stranded.
    const user = userEvent.setup()
    const onAttempt = vi.fn()
    const onCommit = vi.fn()

    render(
      <PermissionHarness
        initial={false}
        outcomes={[
          { ok: false, reason: 'Not allowed to change toasts', permission: true },
          { ok: true, value: true },
        ]}
        onAttempt={onAttempt}
        onCommit={onCommit}
      />
    )

    await user.click(getSwitch())

    await waitFor(() => expect(getSwitch()).toBeDisabled())
    expect(screen.getByText('Not allowed to change toasts')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()

    // A refused control issues no further requests, even when clicked directly.
    await user.click(getSwitch())
    expect(onAttempt).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
    expect(getSwitch()).not.toBeChecked()
    expect(screen.getByLabelText('confirmed value')).toHaveTextContent('false')

    await user.click(screen.getByRole('button', { name: 'Grant permission' }))
    expect(getSwitch()).not.toBeDisabled()
    expect(screen.queryByText('Not allowed to change toasts')).not.toBeInTheDocument()

    await user.click(getSwitch())
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(true))
    expect(getSwitch()).toBeChecked()
    expect(getSwitch()).not.toBeDisabled()
  })
})

/* ── Stale value and out-of-order responses ─────────────── */

describe('Toggle — stale value', () => {
  it('marks the value stale while a revalidation is in flight without blocking edits', async () => {
    // Invariant: a background revalidation must not freeze the control. The
    // user can still correct a value the server has not re-confirmed.
    const user = userEvent.setup()
    const pendingRefresh = deferred<SaveOutcome>()

    render(<ToggleHarness initial={false} outcomes={[() => pendingRefresh.promise]} />)

    await user.click(screen.getByRole('button', { name: 'Refresh limits' }))

    expect(screen.getByText(/out of date/i)).toBeInTheDocument()
    expect(getSwitch()).not.toBeDisabled()

    await act(async () => {
      pendingRefresh.resolve({ ok: true, value: true })
    })
    await waitFor(() => expect(getSwitch()).toBeChecked())
    expect(screen.queryByText(/out of date/i)).not.toBeInTheDocument()
  })

  it('keeps the last confirmed value and the annotation when revalidation fails', async () => {
    // Invariant: a failed revalidation must not blank the control or invent a
    // value. The old value stays, flagged as possibly out of date.
    const user = userEvent.setup()

    render(<ToggleHarness initial outcomes={[{ ok: false, reason: 'Limits unavailable' }]} />)

    await user.click(screen.getByRole('button', { name: 'Refresh limits' }))

    await waitFor(() => expect(screen.getByText(/out of date/i)).toBeInTheDocument())
    expect(getSwitch()).toBeChecked()
    expect(getSwitch()).not.toBeDisabled()
  })

  it('discards a revalidation that resolves after a newer write', async () => {
    // Ordering invariant: the revalidation was issued before the save, so its
    // response is stale by definition. Applying it would revert a value the
    // user had already confirmed — the classic lost-update bug.
    const user = userEvent.setup()
    const pendingRefresh = deferred<SaveOutcome>()
    const onCommit = vi.fn()

    render(
      <ToggleHarness
        initial={false}
        outcomes={[() => pendingRefresh.promise, { ok: true, value: true }]}
        onCommit={onCommit}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Refresh limits' }))
    expect(screen.getByText(/out of date/i)).toBeInTheDocument()

    await user.click(getSwitch())
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(true))
    expect(getSwitch()).toBeChecked()

    // The older revalidation answers last with the pre-save value.
    await act(async () => {
      pendingRefresh.resolve({ ok: true, value: false })
    })

    await waitFor(() => expect(screen.queryByText(/out of date/i)).not.toBeInTheDocument())
    expect(getSwitch()).toBeChecked()
    expect(screen.getByLabelText('confirmed value')).toHaveTextContent('true')
  })
})
