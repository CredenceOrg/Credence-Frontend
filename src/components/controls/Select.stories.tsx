import { useCallback, useEffect, useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import Select from './Select'

const tierOptions = [
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' },
]

const meta: Meta<typeof Select> = {
  title: 'Components/Controls/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
    value: {
      control: 'text',
      description: 'Committed value. Select is controlled and never moves on its own.',
    },
    options: {
      control: 'object',
      description: 'Available options. Values are expected to be unique.',
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessible name. Required unless the select is wrapped in a <label htmlFor>.',
    },
    disabled: { control: 'boolean', description: 'Permission gate — control is not actionable.' },
    isLoading: {
      control: 'boolean',
      description: 'A write is in flight. Implies disabled and announces a pending state.',
    },
    error: {
      control: 'text',
      description: 'Validation message. Forces aria-invalid and is announced via role="alert".',
    },
  },
  args: {
    value: 'gold',
    options: tierOptions,
    // Every story needs an accessible name unless it supplies its own via a
    // wrapping <label htmlFor>. Without this default the state stories render an
    // unnamed combobox, which is unusable with a screen reader and makes the
    // autodocs page misleading. LabelledExternally overrides it with undefined.
    ariaLabel: 'Reward tier',
  },
}

export default meta
type Story = StoryObj<typeof Select>

/* ─── Committed value ───────────────────────────────────────────────────── */

export const Default: Story = {}

/* ─── Validation failure ────────────────────────────────────────────────── */

export const Error: Story = {
  args: {
    error: 'Selection required',
  },
}

/**
 * Boundary: a validation failure on an already-committed selection. The
 * rejected write must not silently revert or silently appear to have succeeded
 * — the select keeps showing what the server actually stored.
 */
export const ErrorWhileCommitted: Story = {
  args: {
    value: 'platinum',
    error: 'Could not save: your plan does not include Platinum.',
  },
}

/**
 * Boundary: caller-owned validation. `aria-invalid` without an `error` string
 * renders no message, so the caller must own the `aria-describedby` target.
 */
export const InvalidWithoutMessage: Story = {
  args: {
    'aria-invalid': 'true',
    'aria-describedby': 'select-external-help',
  },
  render: (args) => (
    <div>
      <Select {...args} />
      <span id="select-external-help">This tier is not available on your plan.</span>
    </div>
  ),
}

/* ─── Permission ────────────────────────────────────────────────────────── */

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const DisabledWhileCommitted: Story = {
  args: {
    value: 'platinum',
    disabled: true,
  },
}

/* ─── In-flight write ───────────────────────────────────────────────────── */

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

/**
 * Boundary: a pending write that has not committed. The select keeps reporting
 * the last committed value, never the optimistic one.
 */
export const LoadingWhileCommitted: Story = {
  args: {
    value: 'platinum',
    isLoading: true,
  },
}

/**
 * Boundary: `disabled` and `isLoading` together. Loading already implies
 * disabled, so the control must be inert exactly once.
 */
export const LoadingWhileDisabled: Story = {
  args: {
    isLoading: true,
    disabled: true,
  },
}

export const Required: Story = {
  args: {
    'aria-required': 'true',
  },
}

/**
 * Boundary: no `ariaLabel`. The name comes from the wrapping `<label htmlFor>`,
 * which is how the Settings page wires Selects. Removing both leaves it unnamed.
 */
export const LabelledExternally: Story = {
  args: {
    value: 'gold',
    ariaLabel: undefined,
  },
  render: (args) => (
    <label htmlFor="select-external-label">
      Reward tier
      <Select {...args} id="select-external-label" />
    </label>
  ),
}

/* ─── Data boundaries ───────────────────────────────────────────────────── */

/**
 * Boundary: an empty option list. Renders a real, empty, disabled-looking
 * control rather than a phantom option — the caller must not be able to read a
 * value back out of a list that has nothing in it.
 */
export const EmptyOptions: Story = {
  args: {
    value: '',
    options: [],
  },
}

/**
 * Boundary: duplicate option values. Invalid input, but it must not corrupt the
 * rendered order or produce duplicate React keys. The select still emits
 * exactly the value it was given.
 */
export const DuplicateOptionValues: Story = {
  args: {
    value: 'gold',
    options: [
      { value: 'gold', label: 'Gold' },
      { value: 'gold', label: 'Gold (duplicate)' },
      { value: 'silver', label: 'Silver' },
    ],
  },
}

/**
 * Boundary: a stale persisted value that no longer exists in `options` (a
 * retired tier, a value from another environment). The native fallback shows
 * the first option. This is deliberately not auto-corrected — the caller owns
 * the decision — but it is pinned here so the behavior stays visible.
 */
export const StaleValueNotInOptions: Story = {
  args: {
    value: 'diamond',
    options: tierOptions,
  },
}

/* ─── Interactive: in-flight write, no optimistic move ──────────────────── */

export interface PendingWriteHarnessProps {
  initialValue?: string
  /** Delay between selection and commit. */
  latencyMs?: number
  onCommit?: (next: string) => void
}

/**
 * Drives Select the way a real settings write does: the selection is staged,
 * the control goes busy, and the committed value only moves once the "server"
 * responds. The visible selection never runs ahead of persisted state.
 */
export function PendingWriteHarness({
  initialValue = 'gold',
  latencyMs = 800,
  onCommit,
}: PendingWriteHarnessProps) {
  const [value, setValue] = useState(initialValue)
  const [isLoading, setIsLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleChange = useCallback(
    (next: string) => {
      setIsLoading(true)
      timer.current = setTimeout(() => {
        setValue(next)
        setIsLoading(false)
        onCommit?.(next)
      }, latencyMs)
    },
    [latencyMs, onCommit]
  )

  const current = tierOptions.find((o) => o.value === value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '280px' }}>
      <Select
        value={value}
        onChange={handleChange}
        options={tierOptions}
        ariaLabel="Reward tier"
        isLoading={isLoading}
      />
      <span style={{ fontSize: '0.875rem', color: 'var(--credence-text-secondary)' }}>
        {isLoading ? 'Saving…' : `Saved — tier is ${current?.label ?? value}`}
      </span>
    </div>
  )
}

export const PendingWrite: Story = {
  render: () => <PendingWriteHarness />,
}

/* ─── Interactive: failure, retry, recovery ─────────────────────────────── */

export interface RetryAfterErrorHarnessProps {
  initialValue?: string
  latencyMs?: number
  /** Consecutive saves that fail before one succeeds. */
  failTimes?: number
}

/**
 * A write that fails the first `failTimes` attempts and then succeeds. The
 * committed value is untouched by the failure, the error is announced, and the
 * retry either re-applies the same value or leaves the user on a known-good
 * selection — no silent loss of intent in either path.
 */
export function RetryAfterErrorHarness({
  initialValue = 'gold',
  latencyMs = 800,
  failTimes = 1,
}: RetryAfterErrorHarnessProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const pending = useRef<string | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const save = useCallback(
    (next: string) => {
      pending.current = next
      setError(undefined)
      setIsLoading(true)
      timer.current = setTimeout(() => {
        setIsLoading(false)
        // Failure path: the committed value is deliberately left alone so the
        // control does not drift away from what the server actually stored.
        if (attempt + 1 <= failTimes) {
          setAttempt((n) => n + 1)
          setError('Could not save this selection. Your previous tier is still active.')
          return
        }
        setValue(pending.current ?? value)
        setAttempt(0)
      }, latencyMs)
    },
    [attempt, failTimes, latencyMs, value]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '320px' }}>
      <Select
        value={value}
        onChange={save}
        options={tierOptions}
        ariaLabel="Reward tier"
        isLoading={isLoading}
        error={error}
      />
      <button
        type="button"
        onClick={() => pending.current !== undefined && save(pending.current)}
        disabled={isLoading || !error}
        style={{ alignSelf: 'flex-start' }}
      >
        Retry save
      </button>
    </div>
  )
}

export const RetryAfterError: Story = {
  render: () => <RetryAfterErrorHarness />,
}
