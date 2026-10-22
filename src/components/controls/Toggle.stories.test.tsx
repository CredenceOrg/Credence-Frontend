import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Toggle from './Toggle'
import * as ToggleStories from './Toggle.stories'

type ToggleProps = React.ComponentProps<typeof Toggle>
type ToggleStory = { args?: Record<string, unknown>; render?: (args: never, ctx: never) => unknown }

/**
 * The story's effective args, reproducing Storybook's meta-then-story merge.
 * `onChange` is defaulted because the meta supplies it via `argTypes` actions,
 * not via `args` — without it a story would render with a missing handler.
 */
function storyArgs(story: ToggleStory): ToggleProps {
  const metaArgs = (ToggleStories.default?.args ?? {}) as Record<string, unknown>
  return { onChange: vi.fn(), ...metaArgs, ...(story.args ?? {}) } as ToggleProps
}

/** Renders a story the way Storybook would, honouring a custom `render`. */
function renderStory(story: ToggleStory) {
  const args = storyArgs(story)
  if (!story.render) return render(<Toggle {...args} />)
  return render(<>{(story.render as (a: unknown, c: unknown) => React.ReactNode)(args, {})}</>)
}

/** Every exported story, excluding the harnesses (exported functions). */
const ALL_STORIES = Object.entries(ToggleStories).filter(
  ([name, value]) =>
    /^[A-Z]/.test(name) &&
    typeof value === 'object' &&
    value !== null &&
    ('args' in value || 'render' in value)
) as [string, ToggleStory][]

const switchEl = () => screen.getByRole('switch')

afterEach(() => {
  vi.restoreAllMocks()
})

/* ═══════════════════════════════════════════════════════════════════════════
   1. Catalog integrity — the stories module is the entry point under test, so
      its shape is itself part of the contract. A story that stops rendering,
      loses its accessible name, or drops out of the catalog is a regression
      even when every component test still passes.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Toggle stories catalog', () => {
  it('exports the meta object with autodocs and a stable title', () => {
    expect(ToggleStories.default.title).toBe('Components/Controls/Toggle')
    expect(ToggleStories.default.component).toBe(Toggle)
    expect(ToggleStories.default.tags).toContain('autodocs')
  })

  it('declares a default checked=false and an accessible name for every story', () => {
    expect(ToggleStories.default.args).toMatchObject({
      checked: false,
      ariaLabel: 'Toggle setting',
    })
  })

  it('covers every state in the component state model', () => {
    // Guards against a state being dropped from the matrix by a later edit.
    const names = ALL_STORIES.map(([name]) => name)
    expect(names).toEqual(
      expect.arrayContaining([
        'Off',
        'On',
        'Error',
        'ErrorWhileOn',
        'InvalidWithoutMessage',
        'Disabled',
        'DisabledWhileOn',
        'Loading',
        'LoadingWhileOn',
        'LoadingWhileDisabled',
        'Required',
        'LabelledExternally',
        'PendingWrite',
        'RetryAfterError',
      ])
    )
  })

  it.each(ALL_STORIES)('renders %s without throwing', (_name, story) => {
    expect(() => renderStory(story)).not.toThrow()
  })

  it.each(ALL_STORIES.filter(([name]) => name !== 'PendingWrite' && name !== 'RetryAfterError'))(
    '%s gives its switch an accessible name',
    (_name, story) => {
      renderStory(story)
      // A switch with no name is unusable with a screen reader. LabelledExternally
      // supplies it via a wrapping <label htmlFor> rather than the ariaLabel prop.
      expect(switchEl()).toHaveAccessibleName()
    }
  )

  it('Off and On are the two committed values, reflected in the visible label', () => {
    const { unmount } = renderStory(ToggleStories.Off as ToggleStory)
    expect(switchEl()).toHaveAttribute('aria-checked', 'false')
    expect(switchEl()).toHaveTextContent('Off')
    unmount()

    renderStory(ToggleStories.On as ToggleStory)
    expect(switchEl()).toHaveAttribute('aria-checked', 'true')
    expect(switchEl()).toHaveTextContent('On')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   2. Boundary inputs — valid, empty, conflicting and duplicated flags.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Toggle stories — validation boundaries', () => {
  it('treats an empty error string as "no error" rather than an invalid field', () => {
    // Boundary: callers pass computed messages; an unresolved promise yields ''.
    // Rendering an empty role="alert" would announce a blank error.
    render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Toggle setting" error="" />)

    expect(switchEl()).not.toHaveAttribute('aria-invalid')
    expect(switchEl()).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lets a truthy error override an explicit aria-invalid="false"', () => {
    // Invariant 2: a stale aria-invalid must never downgrade a live validation
    // failure into a control that looks valid.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Toggle setting"
        error="Rejected by policy"
        aria-invalid="false"
      />
    )

    expect(switchEl()).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    ['boolean true', true],
    ['string "true"', 'true'],
  ] as const)('marks the switch invalid for aria-invalid set as %s', (_label, value) => {
    render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Toggle setting" aria-invalid={value} />
    )

    expect(switchEl()).toHaveAttribute('aria-invalid', 'true')
    // Caller-owned validation supplies its own message; we must not invent one.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['boolean false', false],
    ['string "false"', 'false'],
  ] as const)('leaves the switch valid for aria-invalid set as %s', (_label, value) => {
    render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Toggle setting" aria-invalid={value} />
    )

    expect(switchEl()).not.toHaveAttribute('aria-invalid')
  })

  it('renders the error message and links it to the switch', () => {
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Toggle setting"
        error="Could not save this setting."
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Could not save this setting.')

    // Invariant 3: an invalid state with no describedby target is not
    // diagnosable — the message would never be announced with the control.
    const describedBy = switchEl().getAttribute('aria-describedby')
    expect(describedBy).toBe(alert.id)
    expect(alert.id).not.toBe('')
  })

  it('preserves a caller-supplied aria-describedby and appends its own', () => {
    // Invariant 4: FormField injects its own describedby; wrapping Toggle in one
    // must not drop the error message out of the description.
    render(
      <Toggle
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Toggle setting"
        error="Rejected by policy"
        aria-describedby="field-hint field-error"
      />
    )

    const describedBy = switchEl().getAttribute('aria-describedby') ?? ''
    const ids = describedBy.split(' ')
    expect(ids).toContain('field-hint')
    expect(ids).toContain('field-error')
    expect(ids).toContain(screen.getByRole('alert').id)
    // No duplicate ids in the merged list.
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not collide its error id with a FormField-generated one', () => {
    // FormField builds `${id}-error`. If Toggle derived its own id from `id`
    // the page would contain two elements with identical DOM ids.
    render(
      <Toggle
        id="toasts-enabled"
        checked={false}
        onChange={vi.fn()}
        ariaLabel="Toggle setting"
        error="Could not save this setting."
      />
    )

    expect(screen.getByRole('alert').id).not.toBe('toasts-enabled-error')
  })

  it('InvalidWithoutMessage keeps the caller-supplied description wired', () => {
    renderStory(ToggleStories.InvalidWithoutMessage as ToggleStory)

    expect(switchEl()).toHaveAttribute('aria-invalid', 'true')
    expect(switchEl()).toHaveAttribute('aria-describedby', 'toggle-external-help')
    expect(screen.getByText('This setting is not available on your plan.')).toBeInTheDocument()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   3. State transitions — which stories are interactive, and what they emit.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Toggle stories — state transitions', () => {
  it('Off emits true and On emits false', async () => {
    const user = userEvent.setup()

    const first = renderStory(ToggleStories.Off as ToggleStory)
    await user.click(switchEl())
    first.unmount()

    const onChange = vi.fn()
    render(<Toggle checked onChange={onChange} ariaLabel="Toggle setting" />)
    await user.click(switchEl())
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('rejects interaction entirely while Loading', async () => {
    // Invariant 1: a pending write cannot be clicked through. This is what
    // stops a second click racing a slow first one and double-submitting.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Toggle setting" isLoading />)

    const toggle = switchEl()
    expect(toggle).toBeDisabled()
    await user.click(toggle)
    await user.keyboard('{Enter}')
    toggle.focus()
    await user.keyboard(' ')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects interaction when Loading and Disabled are both set', async () => {
    // Boundary: duplicated permission + busy flags must not change the outcome.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Toggle checked={false} onChange={onChange} ariaLabel="Toggle setting" isLoading disabled />
    )

    expect(switchEl()).toBeDisabled()
    await user.click(switchEl())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects interaction when Disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Toggle setting" disabled />)

    expect(switchEl()).toBeDisabled()
    await user.click(switchEl())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stays interactive while Error, so a rejected write can be retried', async () => {
    // An error must not brick the control — the user needs a way back out.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Toggle checked={true} onChange={onChange} ariaLabel="Toggle setting" error="Rejected" />
    )

    const toggle = switchEl()
    expect(toggle).not.toBeDisabled()
    await user.click(toggle)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('ErrorWhileOn preserves the committed value and still reports the failure', () => {
    // The rejected write must not silently revert or silently keep pretending
    // to have succeeded — the switch shows what the server actually stored.
    renderStory(ToggleStories.ErrorWhileOn as ToggleStory)

    expect(switchEl()).toHaveAttribute('aria-checked', 'true')
    expect(switchEl()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('managed by your organization')
  })

  it('LoadingWhileOn reports the committed value, never the optimistic one', () => {
    // Invariant 5: during a pending write aria-checked must still be truthful.
    renderStory(ToggleStories.LoadingWhileOn as ToggleStory)

    expect(switchEl()).toHaveAttribute('aria-checked', 'true')
    expect(switchEl()).toHaveAttribute('aria-busy', 'true')
  })

  it('does not flip the value on click until the parent re-renders it', async () => {
    // Invariant 5: Toggle is fully controlled. Ignoring the emitted value must
    // leave the UI alone, otherwise a failed write shows a phantom state.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} ariaLabel="Toggle setting" />)

    await user.click(switchEl())
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(switchEl()).toHaveAttribute('aria-checked', 'false')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   4. Observability — loading and error must be perceivable, not silent.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Toggle stories — diagnosability', () => {
  it('Loading hides the On/Off label but announces a pending state', () => {
    renderStory(ToggleStories.Loading as ToggleStory)
    const toggle = switchEl()

    expect(toggle).toHaveAttribute('aria-busy', 'true')
    expect(toggle).not.toHaveTextContent('On')
    expect(toggle).not.toHaveTextContent('Off')
    // The spinner is decorative, so the pending state needs its own live text.
    expect(toggle.querySelector('.control-toggle-spinner')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Saving setting')
  })

  it('removes the busy state and the live region once loading clears', () => {
    const { rerender } = render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Toggle setting" isLoading />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Toggle setting" />)
    expect(switchEl()).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(switchEl()).toHaveTextContent('Off')
  })

  it('the loading live region sits outside the button so it cannot become its name', () => {
    // If the live text were inside the button it would be concatenated into the
    // accessible name on every state change, making the control unlabelable.
    const { container } = renderStory(ToggleStories.Loading as ToggleStory)

    const status = screen.getByRole('status')
    expect(switchEl().contains(status)).toBe(false)
    expect(container.querySelector('button [aria-live]')).toBeNull()
    expect(switchEl()).toHaveAccessibleName('Toggle setting')
  })

  it('does not emit an empty busy or invalid attribute in the default state', () => {
    renderStory(ToggleStories.Off as ToggleStory)
    const toggle = switchEl()

    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(toggle).not.toHaveAttribute('aria-invalid')
    expect(toggle).not.toHaveAttribute('aria-describedby')
  })

  it('clears the error, the alert and the describedby on recovery', () => {
    const { rerender } = render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Toggle setting" error="Rejected" />
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Toggle setting" />)
    // A stale alert left in the DOM would keep re-announcing on every re-render.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(switchEl()).not.toHaveAttribute('aria-invalid')
    expect(switchEl()).not.toHaveAttribute('aria-describedby')
  })

  it('renders the full error string without truncating it', () => {
    // Long server copy must survive; a clipped message is not diagnosable.
    const message =
      'Unable to update this setting: your organization policy blocks anonymous wallet toggles.'
    render(<Toggle checked={false} onChange={vi.fn()} ariaLabel="Toggle setting" error={message} />)

    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   5. Recovery — PendingWrite harness: no optimistic flip, no lost update.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('PendingWrite harness — in-flight write and commit', () => {
  it('stages the change, blocks further clicks, then commits exactly once', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<ToggleStories.PendingWriteHarness latencyMs={60} onCommit={onCommit} />)

    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)

    // In flight: busy and inert, but still showing the committed value.
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-busy', 'true')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(onCommit).not.toHaveBeenCalled()

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(true))
    expect(onCommit).toHaveBeenCalledTimes(1)

    // Committed: value advanced, busy state and live region fully cleared.
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).not.toBeDisabled()
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(toggle).toHaveTextContent('On')
  })

  it('collapses a burst of clicks into a single write', async () => {
    // Concurrency: the control goes inert on the first click, so a fast double
    // click cannot dispatch two saves and race their responses.
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<ToggleStories.PendingWriteHarness latencyMs={60} onCommit={onCommit} />)

    const toggle = screen.getByRole('switch')
    await user.dblClick(toggle)
    await user.click(toggle)

    await waitFor(() => expect(onCommit).toHaveBeenCalled())
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('does not update state after unmounting mid-write', async () => {
    // The save resolves after the view is gone; without a cleared timer this
    // logs a React state-update warning and can clobber the next mount.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const { unmount } = render(
      <ToggleStories.PendingWriteHarness latencyMs={0} onCommit={vi.fn()} />
    )

    await user.click(screen.getByRole('switch'))
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('is operable again after recovery and commits the next value', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<ToggleStories.PendingWriteHarness latencyMs={0} onCommit={onCommit} />)

    const toggle = screen.getByRole('switch')
    await user.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))

    await user.click(toggle)
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2))
    expect(onCommit).toHaveBeenLastCalledWith(false)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   6. Recovery — RetryAfterError harness: failure, retry, success.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('RetryAfterError harness — failure and recovery', () => {
  it('fails without losing the committed value, then recovers on retry', async () => {
    const user = userEvent.setup()
    render(<ToggleStories.RetryAfterErrorHarness latencyMs={60} failTimes={1} />)

    const toggle = screen.getByRole('switch')
    const retry = screen.getByRole('button', { name: 'Retry save' })

    // Nothing to retry before the first attempt.
    expect(retry).toBeDisabled()

    await user.click(toggle)
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-busy', 'true')

    // Failure path: the value the server holds is still "off". The user's
    // intent is not silently applied and the previous value is not silently lost.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveAttribute('aria-invalid', 'true')
    expect(toggle).toBeEnabled()
    expect(retry).toBeEnabled()

    // Recovery path. The error is cleared as the retry *starts*, so the
    // committed value is the real completion signal, not the alert's absence.
    await user.click(retry)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(toggle).not.toHaveAttribute('aria-invalid')
    expect(toggle).not.toHaveAttribute('aria-busy')
    expect(retry).toBeDisabled()
  })

  it('recovers an "off" write the same way as an "on" write', async () => {
    // Regression: the failure path must not be hard-coded to one direction.
    const user = userEvent.setup()
    render(<ToggleStories.RetryAfterErrorHarness latencyMs={0} failTimes={1} initialChecked />)

    const toggle = screen.getByRole('switch')
    await user.click(toggle)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Retry save' }))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('commits on the first attempt when failTimes is 0', async () => {
    const user = userEvent.setup()
    render(<ToggleStories.RetryAfterErrorHarness latencyMs={0} failTimes={0} />)

    await user.click(screen.getByRole('switch'))
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps failing and staying consistent when the server never recovers', async () => {
    // Repeated failure must stay diagnosable and must never drift the value.
    const user = userEvent.setup()
    render(<ToggleStories.RetryAfterErrorHarness latencyMs={0} failTimes={3} initialChecked />)

    const toggle = screen.getByRole('switch')
    const retry = screen.getByRole('button', { name: 'Retry save' })

    await user.click(toggle)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(retry)
    await waitFor(() => expect(retry).toBeEnabled())
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    await user.click(retry)
    await waitFor(() => expect(retry).toBeEnabled())
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not update state after unmounting mid-save', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const { unmount } = render(<ToggleStories.RetryAfterErrorHarness latencyMs={0} failTimes={1} />)

    await user.click(screen.getByRole('switch'))
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(errorSpy).not.toHaveBeenCalled()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   7. Backward compatibility — the production callers in Settings.tsx and
      AnalyticsWidget.tsx pass only checked/onChange/ariaLabel (and AnalyticsWidget
      an id). Their markup must be unchanged by this work.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Toggle stories — caller compatibility', () => {
  it('adds no extra DOM for the plain checked/onChange/ariaLabel usage', () => {
    const { container } = render(
      <Toggle checked={false} onChange={vi.fn()} ariaLabel="Enable toasts" />
    )

    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0)
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(0)
    expect(container.querySelectorAll('.control-toggle__error')).toHaveLength(0)
    expect(switchEl()).toHaveAttribute('aria-checked', 'false')
    expect(switchEl()).toHaveAccessibleName('Enable toasts')
  })

  it('keeps the AnalyticsWidget id-on-button shape intact', () => {
    render(
      <Toggle
        id="analytics-widget-compare-toggle"
        checked
        onChange={vi.fn()}
        ariaLabel="Compare current and previous periods"
      />
    )

    expect(switchEl()).toHaveAttribute('id', 'analytics-widget-compare-toggle')
  })

  it('renders structurally identical markup every time a story is mounted', () => {
    // Idempotence: no shared mutable module state between story mounts. React's
    // useId legitimately differs per root, so it is normalized out — the rest
    // of the markup must be byte-identical.
    const normalize = (html: string) => html.replace(/:r[0-9a-z]+:/g, ':id:')

    const first = renderStory(ToggleStories.Error as ToggleStory)
    const firstHtml = normalize(first.container.innerHTML)
    first.unmount()

    const second = renderStory(ToggleStories.Error as ToggleStory)
    expect(normalize(second.container.innerHTML)).toBe(firstHtml)
  })

  it('keeps the switch operable when a story is mounted twice on one page', async () => {
    // Duplicate-instance boundary: two controls on a page must not share ids.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <div>
        <Toggle checked={false} onChange={onChange} ariaLabel="First setting" error="Rejected" />
        <Toggle checked={false} onChange={onChange} ariaLabel="Second setting" error="Rejected" />
      </div>
    )

    const ids = screen.getAllByRole('alert').map((node) => node.id)
    expect(new Set(ids).size).toBe(2)

    await user.click(screen.getByRole('switch', { name: 'First setting' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   8. Controlled-consumer regression — a parent that re-renders the Toggle with
      the value it was handed, which is how Settings.tsx drives it.
   ═══════════════════════════════════════════════════════════════════════════ */

function ControlledToggle({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial)
  const [error, setError] = useState<string | undefined>(undefined)

  return (
    <Toggle
      checked={checked}
      onChange={(next) => {
        // Simulates a rejected write: nothing is committed and the reason is
        // surfaced. A second toggle clears the error to model a retry.
        setError(next ? undefined : 'Could not save this setting.')
        if (next) setChecked(next)
      }}
      ariaLabel="Enable toasts"
      error={error}
    />
  )
}

describe('Toggle stories — controlled consumer', () => {
  it('applies a successful write and leaves no error behind', async () => {
    const user = userEvent.setup()
    render(<ControlledToggle />)

    await user.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rolls back to the committed value when the write is rejected', async () => {
    const user = userEvent.setup()
    render(<ControlledToggle initial />)

    await user.click(screen.getByRole('switch'))
    // The switch reports the value the server holds, not the one the user asked
    // for — no phantom state after a failed write.
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save this setting.')
  })
})
