import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import AsyncSelect from './AsyncSelect'

const meta: Meta<typeof AsyncSelect> = {
  title: 'Controls/AsyncSelect',
  component: AsyncSelect,
  args: {
    ariaLabel: 'Async Select Example',
  },
}

export default meta
type Story = StoryObj<typeof AsyncSelect>

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState('1')
    return (
      <AsyncSelect
        {...args}
        value={value}
        onChange={setValue}
        loadOptions={async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          return [
            { value: '1', label: 'First Option' },
            { value: '2', label: 'Second Option' },
            { value: '3', label: 'Third Option' },
          ]
        }}
      />
    )
  },
}

export const ErrorState: Story = {
  render: (args) => {
    const [value, setValue] = useState('')
    return (
      <AsyncSelect
        {...args}
        value={value}
        onChange={setValue}
        loadOptions={async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          throw new Error('Failed to load options')
        }}
      />
    )
  },
}
