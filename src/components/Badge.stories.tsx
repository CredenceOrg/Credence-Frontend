import type { Meta, StoryObj } from '@storybook/react'
import Badge from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'Components/Primitives/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'bronze',
        'silver',
        'gold',
        'platinum',
        'active',
        'locked',
        'slashed',
        'grace-period',
        'unknown',
      ],
      description: 'Tier or status variant',
    },
    label: {
      control: 'text',
      description: 'Optional display label override',
    },
    srPrefix: {
      control: 'text',
      description: 'Screen-reader-only prefix',
    },
    ariaLabel: {
      control: 'text',
      description: 'Accessible label',
    },
  },
  args: {
    variant: 'active',
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Active: Story = {
  args: {
    variant: 'active',
  },
}

export const Locked: Story = {
  args: {
    variant: 'locked',
  },
}

export const Platinum: Story = {
  args: {
    variant: 'platinum',
  },
}

export const Slashed: Story = {
  args: {
    variant: 'slashed',
  },
}

export const Unknown: Story = {
  args: {
    variant: 'unknown',
  },
}

export const CustomLabel: Story = {
  args: {
    variant: 'active',
    label: 'Custom Label',
  },
}

export const WithSrPrefix: Story = {
  args: {
    variant: 'gold',
    srPrefix: 'Status:',
  },
}

/** All variants side-by-side */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Badge variant="bronze" />
      <Badge variant="silver" />
      <Badge variant="gold" />
      <Badge variant="platinum" />
      <Badge variant="active" />
      <Badge variant="locked" />
      <Badge variant="slashed" />
      <Badge variant="grace-period" />
      <Badge variant="unknown" />
    </div>
  ),
}
