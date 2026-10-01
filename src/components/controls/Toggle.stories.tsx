import { useCallback, useEffect, useRef, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import Toggle from './Toggle'

const meta: Meta<typeof Toggle> = {
  title: 'Components/Controls/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
    checked: {
      control: 'boolean',
      description: 'Committed value. Toggle is controlled and never flips this on its own.',
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessible name. Required unless the switch is wrapped in a <label htmlFor>.',
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
    onRetry: { action: 'retried' },
  },
  args: {
    checked: false,
    ariaLabel: 'Toggle setting',
  },
}

export default meta
type Story = StoryObj<typeof Toggle>

/* ─── Committed values ──────────────────────────────────────────────────── */

export const Off: Story = {
  args: {
    checked: false,
  },
}

export const On: Story = {
  args: {
    checked: true,
  },
}

/* ─── Validation failure ────────────────────────────────────────────────── */

export const Error: Story = {
  args: {
    error: 'Error state',
  },
}

/**
 * Boundary: a validation failure on an already-enabled setting. The rejected
 * write must not silently revert the committed value — the switch stays "On"
 * and reports the error, so the user can see what state the server is in.
 */
export const ErrorWhileOn: Story = {
  args: {
    checked: true,
    error: 'Could not save: setting is managed by your organization.',
  },
}

/**
 * Boundary: caller-owned validation. `aria-invalid` without an `error` string
 * renders no message, so the caller must supply its own `aria-describedby`
 * target. Useful for pre-validate-on-blur forms that own their error copy.
 */
export const InvalidWithoutMessage: Story = {
  args: {
    'aria-invalid': 'true',
    'aria-describedby': 'toggle-external-help',
  },
  render: (args) => (
    <div>
      <Toggle {...args} />
      <span id="toggle-external-help">This setting is not available on your plan.</span>
    </div>
  ),
}

/* ─── Permission ────────────────────────────────────────────────────────── */

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const DisabledWhileOn: Story = {
  args: {
    checked: true,
    disabled: true,
  },
}

export const DisabledWithReason: Story = {
  args: {
    checked: false,
    disabled: true,
    disabledReason: 'Ask an admin to enable advanced settlement',
  },
}

/* ─── In-flight write ───────────────────────────────────────────────────── */

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

/**
 * Boundary: a pending write that has not committed yet. `aria-checked` still
 * reports the last committed value, never the optimistic one — this is the
 * state a user stares at during a slow save.
 */
export const LoadingWhileOn: Story = {
  args: {
    checked: true,
    isLoading: true,
  },
}

/**
 * Boundary: `disabled` and `isLoading` set together. Loading already implies
 * disabled, so the control must be inert exactly once, with no state in which
 * both flags produce a different result.
 */
export const LoadingWhileDisabled: Story = {
  args: {
    checked: false,
    isLoading: true,
    disabled: true,
  },
}

export const Stale: Story = {
  args: {
    checked: true,
    isStale: true,
  },
}

export const Required: Story = {
  args: {
    'aria-required': 'true',
    ariaLabel: 'Required toggle setting',
  },
}

/**
 * Boundary: no `ariaLabel`. The accessible name comes from the wrapping
 * `<label htmlFor>`, which is how the Settings page wires Toggles it renders
 * without a redundant label. Removing both leaves the switch unnamed.
 */
export const LabelledExternally: Story = {
  args: {
    checked: false,
    ariaLabel: undefined,
  },
  render: (args) => (
    <label htmlFor="toggle-external-label">
      Enable toasts
      <Toggle {...args} id="toggle-external-label" />
    </label>
  ),
}

/* ─── Interactive: in-flight write, no optimistic flip ──────────────────── */

export interface PendingWriteHarnessProps {
  initialChecked?: boolean
  /** Delay between click and commit. */
  latencyMs?: number
  onCommit?: (next: boolean) => void
}

/**
 * Drives Toggle the way a real settings write does: the click is staged, the
 * control goes busy, and the committed value only changes once the "server"
 * responds. The visible value therefore never runs ahead of persisted state.
 */
export function PendingWriteHarness({
  initialChecked = false,
  latencyMs = 800,
  onCommit,
}: PendingWriteHarnessProps) {
  const [checked, setChecked] = useState(initialChecked)
  const [isLoading, setIsLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const handleChange = useCallback(
    (next: boolean) => {
      setIsLoading(true)
      timer.current = setTimeout(() => {
        setChecked(next)
        setIsLoading(false)
        onCommit?.(next)
      }, latencyMs)
    },
    [latencyMs, onCommit]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '280px' }}>
      <Toggle
        checked={checked}
        onChange={handleChange}
        ariaLabel="Enable toasts"
        isLoading={isLoading}
      />
      <span style={{ fontSize: '0.875rem', color: 'var(--credence-text-secondary)' }}>
        {isLoading ? 'Saving…' : `Saved — setting is ${checked ? 'on' : 'off'}`}
      </span>
    </div>
  )
}

export const PendingWrite: Story = {
  render: () => <PendingWriteHarness />,
}

/* ─── Interactive: failure, retry, recovery ─────────────────────────────── */

export interface RetryAfterErrorHarnessProps {
  initialChecked?: boolean
  latencyMs?: number
  /** Consecutive saves that fail before one succeeds. */
  failTimes?: number
}

/**
 * A write that fails the first `failTimes` attempts and then succeeds. The
 * committed value is untouched by the failure, the error is announced, and the
 * retry either re-stages the same value or returns the user to a known-good
 * state — no silent loss of the user's intent in either path.
 */
export function RetryAfterErrorHarness({
  initialChecked = false,
  latencyMs = 800,
  failTimes = 1,
}: RetryAfterErrorHarnessProps) {
  const [checked, setChecked] = useState(initialChecked)
  const [error, setError] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const pending = useRef<boolean | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(timer.current), [])

  const save = useCallback(
    (next: boolean) => {
      pending.current = next
      setError(undefined)
      setIsLoading(true)
      timer.current = setTimeout(() => {
        setIsLoading(false)
        // Failure path: the committed value is deliberately left alone so the
        // switch does not drift away from what the server actually stored.
        if (attempt + 1 <= failTimes) {
          setAttempt((n) => n + 1)
          setError('Could not save this setting. Your previous value is still active.')
          return
        }
        setChecked(pending.current === true)
        setAttempt(0)
      }, latencyMs)
    },
    [attempt, failTimes, latencyMs]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '320px' }}>
      <Toggle
        checked={checked}
        onChange={save}
        ariaLabel="Enable toasts"
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

export const RetryableError: Story = {
  args: {
    checked: false,
    error: 'Could not save your setting',
    onRetry: () => {},
  },
}
