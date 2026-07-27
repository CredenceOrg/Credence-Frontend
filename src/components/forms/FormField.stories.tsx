import type { Meta, StoryObj } from '@storybook/react';
import { FormField } from './FormField';

const meta: Meta<typeof FormField> = {
  title: 'Components/Forms/FormField',
  component: FormField,
  tags: ['autodocs'],
  args: {
    id: 'form-field-id',
    label: 'Form Label',
    children: <input style={{
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      width: '100%'
    }} placeholder="Default input" />,
  },
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {};

export const WithHint: Story = {
  args: {
    hint: 'This is a helpful hint for the user.',
  },
};

export const WithError: Story = {
  args: {
    error: 'This field is required.',
  },
};

export const WithHintAndError: Story = {
  args: {
    hint: 'Enter your full name.',
    error: 'Special characters are not allowed.',
  },
};

export const SrOnlyLabel: Story = {
  args: {
    srOnlyLabel: true,
    label: 'Search attestations',
    children: (
      <input
        style={{
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          width: '100%',
        }}
        placeholder="Search attestations…"
      />
    ),
  },
};
