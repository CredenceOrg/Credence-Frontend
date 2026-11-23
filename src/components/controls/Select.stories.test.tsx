import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Select from './Select'
import * as SelectStories from './Select.stories'

type SelectProps = React.ComponentProps<typeof Select>
type SelectStory = { args?: Record<string, unknown>; render?: (args: never, ctx: never) => unknown }

/**
 * The story's effective args, reproducing Storybook's meta-then-story merge.
 * `onChange` is defaulted because the meta supplies it via `argTypes` actions
 * rather than `args` — without it a story would render with a missing handler.
 */
function storyArgs(story: SelectStory): SelectProps {
  const metaArgs = (SelectStories.default?.args ?? {}) as Record<string, unknown>
  return { onChange: vi.fn(), ...metaArgs, ...(story.args ?? {}) } as SelectProps
}

/** Renders a story the way Storybook would, honouring a custom `render`. */
function renderStory(story: SelectStory) {
  const args = storyArgs(story)
  if (!story.render) return render(<Select {...args} />)
  return render(<>{(story.render as (a: unknown, c: unknown) => React.ReactNode)(args, {})}</>)
}

/**
 * Every exported story. Filtered on capitalized name + object type, which
 * excludes the harnesses (exported functions) and the `default` meta export.
 * An empty story object (`Default`) is still a story, so this deliberately does
 * not require `args` or `render` to be present.
 */
const ALL_STORIES = Object.entries(SelectStories).filter(
  ([name, value]) => /^[A-Z]/.test(name) && typeof value === 'object' && value !== null
) as [string, SelectStory][]

const STATIC_STORIES = ALL_STORIES.filter(
  ([name]) => name !== 'PendingWrite' && name !== 'RetryAfterError'
)

const combobox = (name?: string | RegExp) => screen.getByRole('combobox', name ? { name } : {})

const options = [
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
]

afterEach(() => {
  vi.restoreAllMocks()
})

/* ═══════════════════════════════════════════════════════════════════════════
   1. Catalog integrity — the stories module is the entry point under test, so
      its shape is part of the contract.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Select stories catalog', () => {
  it('exports the meta object with autodocs and a stable title', () => {
    expect(SelectStories.default.title).toBe('Components/Controls/Select')
    expect(SelectStories.default.component).toBe(Select)
    expect(SelectStories.default.tags).toContain('autodocs')
  })

  it('defaults to a valid committed value present in the default options', () => {
    const meta = SelectStories.default.args as { value: string; options: { value: string }[] }
    // A default whose value is absent from its own options would render the
    // first option instead, making the docs quietly wrong.
    expect(meta.options.map((o) => o.value)).toContain(meta.value)
  })

  it('covers every state in the component state model', () => {
    expect(ALL_STORIES.map(([name]) => name)).toEqual(
      expect.arrayContaining([
        'Default',
        'Error',
        'ErrorWhileCommitted',
        'InvalidWithoutMessage',
        'Disabled',
        'DisabledWhileCommitted',
        'Loading',
        'LoadingWhileCommitted',
        'LoadingWhileDisabled',
        'Required',
        'LabelledExternally',
        'EmptyOptions',
        'DuplicateOptionValues',
        'StaleValueNotInOptions',
        'PendingWrite',
        'RetryAfterError',
      ])
    )
  })

  it.each(ALL_STORIES)('renders %s without throwing', (_name, story) => {
    expect(() => renderStory(story)).not.toThrow()
  })

  it.each(STATIC_STORIES)('%s gives its combobox an accessible name', (_name, story) => {
    renderStory(story)
    // LabelledExternally supplies the name via a wrapping <label htmlFor>
    // rather than the ariaLabel prop.
    expect(combobox()).toHaveAccessibleName()
  })

  it('Default renders every option with the committed value selected', () => {
    renderStory(SelectStories.Default as SelectStory)

    expect(screen.getAllByRole('option')).toHaveLength(4)
    expect(combobox()).toHaveValue('gold')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   2. Boundary inputs — empty, conflicting, duplicated and stale data.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Select stories — validation and data boundaries', () => {
  it('treats an empty error string as "no error" rather than an invalid field', () => {
    // Boundary: callers pass computed messages; an unresolved promise yields ''.
    // An empty role="alert" would announce a blank error.
    render(<Select value="gold" onChange={vi.fn()} options={options} error="" />)

    expect(combobox()).not.toHaveAttribute('aria-invalid')
    expect(combobox()).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('lets a truthy error override an explicit aria-invalid="false"', () => {
    // Invariant 2: a stale aria-invalid must never downgrade a live validation
    // failure into a field that looks valid.
    render(
      <Select
        value="gold"
        onChange={vi.fn()}
        options={options}
        error="Rejected by policy"
        aria-invalid="false"
      />
    )

    expect(combobox()).not.toHaveAttribute('aria-invalid', 'false')
    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    ['boolean true', true],
    ['string "true"', 'true'],
  ] as const)('marks the select invalid for aria-invalid set as %s', (_label, value) => {
    render(<Select value="gold" onChange={vi.fn()} options={options} aria-invalid={value} />)

    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
    // Caller-owned validation supplies its own message; we must not invent one.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['boolean false', false],
    ['string "false"', 'false'],
  ] as const)('leaves the select valid for aria-invalid set as %s', (_label, value) => {
    render(<Select value="gold" onChange={vi.fn()} options={options} aria-invalid={value} />)

    expect(combobox()).not.toHaveAttribute('aria-invalid')
  })

  it('renders the error message and links it to the select', () => {
    render(<Select value="gold" onChange={vi.fn()} options={options} error="Selection required" />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Selection required')
    // Invariant 3: an invalid state with no describedby target is not diagnosable.
    expect(combobox().getAttribute('aria-describedby')).toBe(alert.id)
    expect(alert.id).not.toBe('')
  })

  it('preserves a caller-supplied aria-describedby and appends its own', () => {
    // Invariant 4: FormField injects its own describedby; wrapping Select in one
    // must not drop the error message out of the description.
    render(
      <Select
        value="gold"
        onChange={vi.fn()}
        options={options}
        error="Rejected by policy"
        aria-describedby="field-hint field-error"
      />
    )

    const ids = (combobox().getAttribute('aria-describedby') ?? '').split(' ')
    expect(ids).toContain('field-hint')
    expect(ids).toContain('field-error')
    expect(ids).toContain(screen.getByRole('alert').id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not collide its error id with a FormField-generated one', () => {
    render(
      <Select
        id="tier"
        value="gold"
        onChange={vi.fn()}
        options={options}
        error="Selection required"
      />
    )

    expect(screen.getByRole('alert').id).not.toBe('tier-error')
  })

  it('InvalidWithoutMessage keeps the caller-supplied description wired', () => {
    renderStory(SelectStories.InvalidWithoutMessage as SelectStory)

    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
    expect(combobox()).toHaveAttribute('aria-describedby', 'select-external-help')
    expect(screen.getByText('This tier is not available on your plan.')).toBeInTheDocument()
  })

  it('EmptyOptions renders no phantom options', () => {
    renderStory(SelectStories.EmptyOptions as SelectStory)

    expect(combobox()).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    // Nothing can be read back out of an empty list.
    expect((combobox() as HTMLSelectElement).value).toBe('')
  })

  it('renders duplicate option values without corrupting the option order', async () => {
    // Boundary: a value-derived React key would emit a duplicate-key warning and
    // could reconcile the wrong option across a re-render.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <Select
        value="gold"
        onChange={onChange}
        options={[
          { value: 'gold', label: 'Gold' },
          { value: 'gold', label: 'Gold (duplicate)' },
          { value: 'silver', label: 'Silver' },
        ]}
        ariaLabel="Reward tier"
      />
    )

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Gold',
      'Gold (duplicate)',
      'Silver',
    ])
    // Still emits the exact value, so the caller can reject it knowingly.
    await user.selectOptions(combobox(), 'silver')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('silver')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('keeps a stale value outside options pinned to the native first-option fallback', () => {
    // Boundary: a retired tier from another environment. The fallback is
    // deliberately not auto-corrected — the caller owns that decision — but it
    // must not silently read back as a tier the user never chose.
    renderStory(SelectStories.StaleValueNotInOptions as SelectStory)

    expect(combobox()).toHaveValue('bronze')
    expect((screen.getByRole('option', { name: 'Bronze' }) as HTMLOptionElement).selected).toBe(
      true
    )
    expect((screen.getByRole('option', { name: 'Platinum' }) as HTMLOptionElement).selected).toBe(
      false
    )
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   3. State transitions — which states are interactive, and what they emit.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Select stories — state transitions', () => {
  it('emits the selected value and does not move on its own', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Select value="gold" onChange={onChange} options={options} ariaLabel="Reward tier" />)

    await user.selectOptions(combobox(), 'platinum')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('platinum')
    // Invariant 5: still controlled — a rejected write snaps back to 'gold'.
    expect(combobox()).toHaveValue('gold')
  })

  it('rejects interaction entirely while Loading', async () => {
    // Invariant 1: a pending write cannot be committed over by a second selection.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Select value="gold" onChange={onChange} options={options} isLoading ariaLabel="Tier" />)

    const select = combobox()
    expect(select).toBeDisabled()
    await user.selectOptions(select, 'platinum')

    expect(onChange).not.toHaveBeenCalled()
    expect(select).toHaveValue('gold')
  })

  it('rejects interaction when Loading and Disabled are both set', async () => {
    // Boundary: duplicated permission + busy flags must not change the outcome.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Select
        value="gold"
        onChange={onChange}
        options={options}
        isLoading
        disabled
        ariaLabel="Tier"
      />
    )

    expect(combobox()).toBeDisabled()
    await user.selectOptions(combobox(), 'platinum')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('rejects interaction when Disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Select value="gold" onChange={onChange} options={options} disabled ariaLabel="Tier" />)

    expect(combobox()).toBeDisabled()
    await user.selectOptions(combobox(), 'platinum')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stays interactive while Error, so a rejected write can be retried', async () => {
    // An error must not brick the control — the user needs a way back out.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Select
        value="gold"
        onChange={onChange}
        options={options}
        error="Rejected"
        ariaLabel="Tier"
      />
    )

    const select = combobox()
    expect(select).not.toBeDisabled()
    await user.selectOptions(select, 'silver')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('silver')
  })

  it('ErrorWhileCommitted preserves the committed value and reports the failure', () => {
    renderStory(SelectStories.ErrorWhileCommitted as SelectStory)

    expect(combobox()).toHaveValue('platinum')
    expect(combobox()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('does not include Platinum')
  })

  it('LoadingWhileCommitted reports the committed value, never the optimistic one', () => {
    renderStory(SelectStories.LoadingWhileCommitted as SelectStory)

    expect(combobox()).toHaveValue('platinum')
    expect(combobox()).toHaveAttribute('aria-busy', 'true')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   4. Observability — loading and error must be perceivable, not silent.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Select stories — diagnosability', () => {
  it('Loading announces a pending state even though the spinner is decorative', () => {
    // The spinner overlays the native control as a sibling, so it must be
    // located through the wrapper rather than through the <select>.
    const { container } = renderStory(SelectStories.Loading as SelectStory)
    const select = combobox()

    expect(select).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.control-select-spinner')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(screen.getByRole('status')).toHaveTextContent('Saving selection')
  })

  it('the loading live region sits outside the select so it cannot become its name', () => {
    const { container } = renderStory(SelectStories.Loading as SelectStory)

    const status = screen.getByRole('status')
    expect(container.querySelector('select')?.contains(status)).toBe(false)
    expect(container.querySelector('select [aria-live]')).toBeNull()
  })

  it('removes the busy state and live region once loading clears', () => {
    const { rerender } = render(
      <Select value="gold" onChange={vi.fn()} options={options} isLoading ariaLabel="Tier" />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(<Select value="gold" onChange={vi.fn()} options={options} ariaLabel="Tier" />)
    expect(combobox()).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not emit an empty busy or invalid attribute in the default state', () => {
    renderStory(SelectStories.Default as SelectStory)
    const select = combobox()

    expect(select).not.toHaveAttribute('aria-busy')
    expect(select).not.toHaveAttribute('aria-invalid')
    expect(select).not.toHaveAttribute('aria-describedby')
  })

  it('clears the error, the alert and the describedby on recovery', () => {
    const { rerender } = render(
      <Select value="gold" onChange={vi.fn()} options={options} error="Rejected" />
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(<Select value="gold" onChange={vi.fn()} options={options} />)
    // A stale alert left in the DOM would keep re-announcing on every re-render.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(combobox()).not.toHaveAttribute('aria-invalid')
    expect(combobox()).not.toHaveAttribute('aria-describedby')
  })

  it('renders the full error string without truncating it', () => {
    const message =
      'Unable to change tier: your organization policy blocks downgrades below Silver.'
    render(<Select value="gold" onChange={vi.fn()} options={options} error={message} />)

    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   5. Recovery — PendingWrite harness: no optimistic move, no lost update.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('PendingWrite harness — in-flight write and commit', () => {
  it('stages the selection, blocks further changes, then commits exactly once', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<SelectStories.PendingWriteHarness latencyMs={60} onCommit={onCommit} />)

    const select = combobox()
    expect(select).toHaveValue('gold')

    await user.selectOptions(select, 'bronze')

    // In flight: busy and inert, but still showing the committed value.
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('aria-busy', 'true')
    expect(select).toHaveValue('gold')
    expect(onCommit).not.toHaveBeenCalled()

    await waitFor(() => expect(onCommit).toHaveBeenCalledWith('bronze'))
    expect(onCommit).toHaveBeenCalledTimes(1)

    // Committed: value advanced, busy state and live region fully cleared.
    expect(select).toHaveValue('bronze')
    expect(select).not.toBeDisabled()
    expect(select).not.toHaveAttribute('aria-busy')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('collapses a burst of selections into a single write', async () => {
    // Concurrency: the control goes inert on the first change, so a fast second
    // and third selection cannot dispatch competing writes and race responses.
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<SelectStories.PendingWriteHarness latencyMs={60} onCommit={onCommit} />)

    const select = combobox()
    await user.selectOptions(select, 'bronze')
    await user.selectOptions(select, 'platinum').catch(() => {
      /* blocked while the write is in flight */
    })
    select.focus()
    await user.keyboard('{ArrowDown}').catch(() => {
      /* blocked while the write is in flight */
    })

    await waitFor(() => expect(onCommit).toHaveBeenCalled())
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(select).toHaveValue('bronze')
  })

  it('does not update state after unmounting mid-write', async () => {
    // The save resolves after the view is gone; without a cleared timer this logs
    // a React state-update warning and can clobber the next mount.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const { unmount } = render(
      <SelectStories.PendingWriteHarness latencyMs={0} onCommit={vi.fn()} />
    )

    await user.selectOptions(combobox(), 'bronze')
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('is operable again after recovery and commits the next value', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<SelectStories.PendingWriteHarness latencyMs={0} onCommit={onCommit} />)

    const select = combobox()
    await user.selectOptions(select, 'bronze')
    await waitFor(() => expect(select).toHaveValue('bronze'))

    await user.selectOptions(select, 'platinum')
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2))
    expect(onCommit).toHaveBeenLastCalledWith('platinum')
    expect(select).toHaveValue('platinum')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   6. Recovery — RetryAfterError harness: failure, retry, success.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('RetryAfterError harness — failure and recovery', () => {
  it('fails without losing the committed value, then recovers on retry', async () => {
    const user = userEvent.setup()
    render(<SelectStories.RetryAfterErrorHarness latencyMs={60} failTimes={1} />)

    const select = combobox()
    const retry = screen.getByRole('button', { name: 'Retry save' })

    // Nothing to retry before the first attempt.
    expect(retry).toBeDisabled()

    await user.selectOptions(select, 'platinum')
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('aria-busy', 'true')

    // Failure path: the value the server holds is still Gold. The user's intent
    // is not silently applied and the previous value is not silently lost.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(select).toHaveValue('gold')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toBeEnabled()
    expect(retry).toBeEnabled()

    // Recovery path. The error clears as the retry *starts*, so the committed
    // value is the real completion signal, not the alert's absence.
    await user.click(retry)
    await waitFor(() => expect(select).toHaveValue('platinum'))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(select).not.toHaveAttribute('aria-invalid')
    expect(select).not.toHaveAttribute('aria-busy')
    expect(retry).toBeDisabled()
  })

  it('recovers a downgrade the same way as an upgrade', async () => {
    // Regression: the failure path must not be hard-coded to one direction.
    const user = userEvent.setup()
    render(
      <SelectStories.RetryAfterErrorHarness latencyMs={60} failTimes={1} initialValue="platinum" />
    )

    const select = combobox()
    await user.selectOptions(select, 'bronze')
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(select).toHaveValue('platinum')

    await user.click(screen.getByRole('button', { name: 'Retry save' }))
    await waitFor(() => expect(select).toHaveValue('bronze'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('commits on the first attempt when failTimes is 0', async () => {
    const user = userEvent.setup()
    render(<SelectStories.RetryAfterErrorHarness latencyMs={0} failTimes={0} />)

    await user.selectOptions(combobox(), 'platinum')
    await waitFor(() => expect(combobox()).toHaveValue('platinum'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps failing and staying consistent when the server never recovers', async () => {
    // Repeated failure must stay diagnosable and must never drift the value.
    const user = userEvent.setup()
    render(
      <SelectStories.RetryAfterErrorHarness latencyMs={0} failTimes={3} initialValue="silver" />
    )

    const select = combobox()
    const retry = screen.getByRole('button', { name: 'Retry save' })

    await user.selectOptions(select, 'platinum')
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(select).toHaveValue('silver')

    await user.click(retry)
    await waitFor(() => expect(retry).toBeEnabled())
    expect(select).toHaveValue('silver')

    await user.click(retry)
    await waitFor(() => expect(retry).toBeEnabled())
    expect(select).toHaveValue('silver')
    expect(select).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not update state after unmounting mid-save', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    const { unmount } = render(<SelectStories.RetryAfterErrorHarness latencyMs={0} failTimes={1} />)

    await user.selectOptions(combobox(), 'bronze')
    unmount()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(errorSpy).not.toHaveBeenCalled()
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   7. Backward compatibility — the production callers in Settings.tsx,
      Attestations.tsx, Transactions.tsx and AttestationForm.tsx pass only
      value/onChange/options (and often ariaLabel). Their markup must be
      unchanged by this work.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Select stories — caller compatibility', () => {
  it('adds no extra DOM for the plain value/onChange/options usage', () => {
    const { container } = render(
      <Select value="gold" onChange={vi.fn()} options={options} ariaLabel="Reward tier" />
    )

    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0)
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(0)
    expect(container.querySelectorAll('.control-select__error')).toHaveLength(0)
    expect(combobox()).toHaveValue('gold')
    expect(combobox()).toHaveAccessibleName('Reward tier')
  })

  it('renders the same option DOM shape as before the change', () => {
    // The key is now index-scoped; React strips keys from the DOM, so the
    // rendered markup is unchanged.
    const { container } = render(
      <Select value="gold" onChange={vi.fn()} options={options} ariaLabel="Reward tier" />
    )

    const rendered = Array.from(container.querySelectorAll('option')).map((o) => [
      o.getAttribute('value'),
      o.textContent,
    ])
    expect(rendered).toEqual([
      ['bronze', 'Bronze'],
      ['silver', 'Silver'],
      ['gold', 'Gold'],
      ['platinum', 'Platinum'],
    ])
  })

  it('keeps two selects on one page from sharing error ids', async () => {
    // Duplicate-instance boundary: two controls must not collide in the DOM.
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <div>
        <Select
          value="gold"
          onChange={onChange}
          options={options}
          ariaLabel="First"
          error="Rejected"
        />
        <Select
          value="gold"
          onChange={onChange}
          options={options}
          ariaLabel="Second"
          error="Rejected"
        />
      </div>
    )

    const ids = screen.getAllByRole('alert').map((node) => node.id)
    expect(new Set(ids).size).toBe(2)

    await user.selectOptions(combobox('First'), 'silver')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('silver')
  })
})

/* ═══════════════════════════════════════════════════════════════════════════
   8. Controlled-consumer regression — a parent that re-renders Select with the
      value it was handed, which is how Settings.tsx drives it.
   ═══════════════════════════════════════════════════════════════════════════ */

function ControlledSelect({ initial = 'gold' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | undefined>(undefined)

  return (
    <Select
      value={value}
      onChange={(next) => {
        // Simulates a rejected downgrade: nothing is committed and the reason
        // is surfaced. An accepted selection clears the error.
        if (next === 'bronze') {
          setError('Downgrades are not allowed on your plan.')
          return
        }
        setError(undefined)
        setValue(next)
      }}
      options={options}
      ariaLabel="Reward tier"
      error={error}
    />
  )
}

describe('Select stories — controlled consumer', () => {
  it('applies an accepted selection and leaves no error behind', async () => {
    const user = userEvent.setup()
    render(<ControlledSelect />)

    await user.selectOptions(combobox(), 'platinum')
    expect(combobox()).toHaveValue('platinum')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rolls back to the committed value when the write is rejected', async () => {
    const user = userEvent.setup()
    render(<ControlledSelect />)

    await user.selectOptions(combobox(), 'bronze')
    // The select reports the value the server holds, not the one the user asked
    // for — no phantom selection after a failed write.
    expect(combobox()).toHaveValue('gold')
    expect(screen.getByRole('alert')).toHaveTextContent('Downgrades are not allowed')
  })

  it('recovers once an accepted selection follows a rejection', async () => {
    const user = userEvent.setup()
    render(<ControlledSelect />)

    await user.selectOptions(combobox(), 'bronze')
    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.selectOptions(combobox(), 'silver')
    expect(combobox()).toHaveValue('silver')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
