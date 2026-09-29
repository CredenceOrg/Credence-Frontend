import type { Meta, StoryObj } from '@storybook/react'
import Toggle from './Toggle'

const meta: Meta<typeof Toggle> = {
  title: 'Components/Controls/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
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
