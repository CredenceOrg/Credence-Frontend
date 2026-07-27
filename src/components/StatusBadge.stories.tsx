import type { Meta, StoryObj } from '@storybook/react'
import StatusBadge from './StatusBadge'

const meta: Meta<typeof StatusBadge> = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['pending', 'active', 'completed', 'failed'],
      description: 'Lifecycle status variant.',
    },
    label: {
      control: 'text',
      description: 'Optional display label override. Defaults to the capitalised variant name.',
    },
    srPrefix: {
      control: 'text',
      description:
        'Screen-reader-only prefix rendered before the visible label (e.g. "Bond status:").',
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessible label for the badge element. Defaults to the display label.',
    },
    className: {
      control: 'text',
      description: 'Additional CSS class names appended to the badge root.',
    },
  },
  args: {
    variant: 'pending',
  },
}

export default meta
type Story = StoryObj<typeof StatusBadge>

export const Default: Story = {
  args: {
    variant: 'pending',
  },
}

export const Pending: Story = {
  args: {
    variant: 'pending',
  },
}

export const Active: Story = {
  args: {
    variant: 'active',
  },
}

export const Completed: Story = {
  args: {
    variant: 'completed',
  },
}

export const Failed: Story = {
  args: {
    variant: 'failed',
  },
}

export const CustomLabel: Story = {
  args: {
    variant: 'pending',
    label: 'Awaiting review',
  },
}

export const WithSrPrefix: Story = {
  args: {
    variant: 'failed',
    srPrefix: 'Bond status:',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The `srPrefix` prop injects an `.sr-only` span before the visible label so screen readers announce "Bond status: Failed" rather than just "Failed".',
      },
    },
  },
}

/** All four variants side-by-side for quick visual comparison. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <StatusBadge variant="pending" />
      <StatusBadge variant="active" />
      <StatusBadge variant="completed" />
      <StatusBadge variant="failed" />
    </div>
  ),
}
