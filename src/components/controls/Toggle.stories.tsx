import type { Meta, StoryObj } from '@storybook/react'
import Toggle from './Toggle'

const meta: Meta<typeof Toggle> = {
  title: 'Components/Controls/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
    onRetry: { action: 'retried' },
  },
  args: {
    checked: false,
    ariaLabel: 'Toggle setting',
  },
}

export default meta
type Story = StoryObj<typeof Toggle>

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

export const Error: Story = {
  args: {
    error: 'Error state',
  },
}

export const Disabled: Story = {
  args: {
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

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

export const Stale: Story = {
  args: {
    checked: true,
    isStale: true,
  },
}

export const RetryableError: Story = {
  args: {
    checked: false,
    error: 'Could not save your setting',
    onRetry: () => {},
  },
}
