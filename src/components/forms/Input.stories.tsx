import type { Meta, StoryObj } from '@storybook/react'
import { FormField } from './FormField'
import { Input } from './Input'
import { Textarea } from './Textarea'

const meta: Meta<typeof Input> = {
  title: 'Components/Forms/Input',
  component: Input,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  render: () => (
    <FormField id="input-default" label="Display name" hint="Shown on your public profile">
      <Input placeholder="Ada Lovelace" />
    </FormField>
  ),
}

export const WithError: Story = {
  render: () => (
    <FormField id="input-error" label="Quiet hours start" error="Use HH:mm (24-hour).">
      <Input compact placeholder="22:00" defaultValue="25:00" />
    </FormField>
  ),
}

export const WithSuccess: Story = {
  render: () => (
    <FormField id="input-success" label="Quiet hours end" success="Format looks valid.">
      <Input compact placeholder="07:00" defaultValue="07:00" />
    </FormField>
  ),
}

export const Disabled: Story = {
  render: () => (
    <FormField id="input-disabled" label="Network">
      <Input disabled defaultValue="Testnet" />
    </FormField>
  ),
}

export const Multiline: Story = {
  render: () => (
    <FormField
      id="textarea-evidence"
      label="Evidence"
      hint="Supporting proof (max 28 bytes)"
      error="Evidence is required."
    >
      <Textarea placeholder="Provide proof or verification details..." />
    </FormField>
  ),
}
