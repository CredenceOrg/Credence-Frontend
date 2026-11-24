import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import Banner from './Banner'

const meta: Meta<typeof Banner> = {
  title: 'Components/Banner',
  component: Banner,
  tags: ['autodocs'],
  argTypes: {
    severity: {
      control: 'select',
      options: ['info', 'warn', 'incident'],
      description: 'Visual tone and urgency of the message.',
    },
    title: {
      control: 'text',
      description: 'Optional short title displayed above the message.',
    },
    children: {
      control: 'text',
      description: 'Message content.',
    },
    dismissible: {
      control: 'boolean',
      description: 'Whether the banner shows a dismiss button.',
    },
    onDismiss: {
      action: 'dismissed',
    },
    action: {
      control: 'object',
      description: 'Optional link or button action.',
    },
  },
  args: {
    severity: 'info',
    title: 'Scheduled maintenance',
    children: 'Some features may be temporarily unavailable while maintenance is in progress.',
  },
}

export default meta
type Story = StoryObj<typeof Banner>

export const Information: Story = {
  args: {
    severity: 'info',
  },
}

export const Warning: Story = {
  args: {
    severity: 'warn',
    title: 'Action required',
    children: 'Review your account settings to keep your wallet connected.',
  },
}

export const Incident: Story = {
  args: {
    severity: 'incident',
    title: 'Network incident',
    children: 'Transactions may be delayed while the network issue is being resolved.',
  },
}

export const WithLinkAction: Story = {
  args: {
    severity: 'info',
    action: {
      label: 'View status',
      href: 'https://status.example.com',
    },
  },
}

export const WithButtonAction: Story = {
  args: {
    severity: 'warn',
    action: {
      label: 'Review settings',
      onClick: fn(),
    },
  },
}

export const Dismissible: Story = {
  args: {
    severity: 'info',
    dismissible: true,
  },
}
