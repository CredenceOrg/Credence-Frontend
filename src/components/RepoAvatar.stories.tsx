import type { Meta, StoryObj } from '@storybook/react'
import RepoAvatar from './RepoAvatar'

const meta: Meta<typeof RepoAvatar> = {
  title: 'Components/RepoAvatar',
  component: RepoAvatar,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    name: { control: 'text' },
    src: { control: 'text' },
    alt: { control: 'text' },
  },
  args: {
    size: 'md',
    name: 'CredenceOrg/Credence-Frontend',
  },
}

export default meta
type Story = StoryObj<typeof RepoAvatar>

export const Default: Story = {
  args: {
    size: 'md',
    name: 'CredenceOrg/Credence-Frontend',
  },
}

export const Small: Story = {
  args: {
    size: 'sm',
    name: 'CredenceOrg/Credence-Frontend',
  },
}

export const Large: Story = {
  args: {
    size: 'lg',
    name: 'CredenceOrg/Credence-Frontend',
  },
}

export const WithImage: Story = {
  args: {
    size: 'md',
    name: 'CredenceOrg/Credence-Frontend',
    src: 'https://avatars.githubusercontent.com/u/1000000?v=4',
  },
}

export const IconFallback: Story = {
  args: {
    size: 'md',
  },
}
