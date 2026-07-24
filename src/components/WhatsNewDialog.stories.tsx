import type { Meta, StoryObj } from '@storybook/react'
import WhatsNewDialog from './WhatsNewDialog'

const meta: Meta<typeof WhatsNewDialog> = {
  title: 'Components/WhatsNewDialog',
  component: WhatsNewDialog,
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
  },
  args: {
    open: true,
  },
}

export default meta
type Story = StoryObj<typeof WhatsNewDialog>

export const Open: Story = {
  args: {
    open: true,
  },
}

export const Closed: Story = {
  args: {
    open: false,
  },
}
