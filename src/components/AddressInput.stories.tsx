import type { Meta, StoryObj } from '@storybook/react';
import AddressInput from './AddressInput';

const meta: Meta<typeof AddressInput> = {
  title: 'Components/Forms/AddressInput',
  component: AddressInput,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
    onValidationChange: { action: 'validated' },
  },
  args: {
    id: 'address-input',
    label: 'Stellar Address',
    value: '',
  },
};

export default meta;
type Story = StoryObj<typeof AddressInput>;

export const Default: Story = {
  args: {
    value: '',
  },
};

export const Filled: Story = {
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
};

export const Invalid: Story = {
  args: {
    value: 'invalid-address',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
};

export const ChecksumError: Story = {
  args: {
    // Format-valid but fails CRC-16 checksum – mirrors the real error state
    value: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
    error: 'Invalid address checksum. Please verify the address.',
  },
};

export const Disabled: Story = {
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};
