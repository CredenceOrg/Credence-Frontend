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

export const Retry: Story = {
  args: {
    error: 'Failed to update setting. Retry available.',
    onChange: (): void => {},
  },
}

export const Stale: Story = {
  args: {
    checked: true,
    error: 'Value may be out of date. Refresh to confirm.',
  },
}

export const PermissionDenied: Story = {
  args: {
    disabled: true,
    error: 'You do not have permission to change this setting.',
  },
}

export const DisabledAndLoading: Story = {
  args: {
    disabled: true,
    isLoading: true,
  },
}

export const ErrorAndLoading: Story = {
  args: {
    error: 'Error state',
    isLoading: true,
  },
}
