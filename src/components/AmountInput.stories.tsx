import type { Meta, StoryObj } from '@storybook/react';
import AmountInput from './AmountInput';

const meta: Meta<typeof AmountInput> = {
  title: 'Components/Forms/AmountInput',
  component: AmountInput,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
    onValidityChange: { action: 'validityChanged' },
  },
  args: {
    value: '',
    balance: 1000,
    currencyLabel: 'USDC',
  },
};

export default meta;
type Story = StoryObj<typeof AmountInput>;

export const Default: Story = {
  args: {
    value: '',
  },
};

export const Filled: Story = {
  args: {
    value: '500.00',
  },
};

export const OverBalance: Story = {
  args: {
    value: '1500.00',
    balance: 1000,
  },
};

export const Error: Story = {
  args: {
    value: '5.00',
    error: 'Minimum bond is 10 USDC',
  },
};

export const Disabled: Story = {
  args: {
    value: '100.00',
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};
