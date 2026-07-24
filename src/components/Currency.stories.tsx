import type { Meta, StoryObj } from '@storybook/react'
import Currency from './Currency'

const meta: Meta<typeof Currency> = {
  title: 'Components/Display/Currency',
  component: Currency,
  tags: ['autodocs'],
  args: {
    amount: 1234.5,
    currency: 'USD',
    locale: 'en-US',
  },
}

export default meta
type Story = StoryObj<typeof Currency>

export const Default: Story = {}

export const EuroSpain: Story = {
  args: {
    currency: 'EUR',
    locale: 'es-ES',
  },
}

export const YenJapan: Story = {
  args: {
    currency: 'JPY',
    locale: 'ja-JP',
  },
}

export const InvalidAmount: Story = {
  args: {
    amount: Number.NaN,
  },
}
