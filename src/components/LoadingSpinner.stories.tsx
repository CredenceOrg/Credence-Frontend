import type { Meta, StoryObj } from '@storybook/react'
import LoadingSpinner from './LoadingSpinner'

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Components/LoadingSpinner',
  component: LoadingSpinner,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    label: { control: 'text' },
  },
  args: {
    size: 'md',
    label: 'Loading…',
  },
}

export default meta
type Story = StoryObj<typeof LoadingSpinner>

export const Default: Story = {
  args: {
    size: 'md',
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
  },
}

export const CustomLabel: Story = {
  args: {
    label: 'Calculating score…',
  },
}
