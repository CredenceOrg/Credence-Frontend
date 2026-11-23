import type { Meta, StoryObj } from '@storybook/react'
import AddressInput from './AddressInput'

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
}

export default meta
type Story = StoryObj<typeof AddressInput>

export const Default: Story = {
  args: {
    value: '',
  },
}

export const Filled: Story = {
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

export const Invalid: Story = {
  args: {
    value: 'invalid-address',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const ChecksumError: Story = {
  args: {
    // Format-valid but fails CRC-16 checksum – mirrors the real error state
    value: 'GAAZI4TCRCTY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
    error: 'Invalid address checksum. Please verify the address.',
  },
}

export const Disabled: Story = {
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    disabled: true,
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

/**
 * The "Recognized:" echo uses the `addressDisplay` setting from SettingsContext.
 * These stories show how each mode renders — wire them up in Storybook by
 * decorating with a SettingsProvider override if needed.
 *
 * "full"     → GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H
 * "short"    → gBRPYHIL2CI3...X2H   (default)
 * "friendly" → GBRPYH…X2H
 */
export const EchoFull: Story = {
  name: 'Echo – full address',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

export const EchoShort: Story = {
  name: 'Echo – short address (default)',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

export const EchoFriendly: Story = {
  name: 'Echo – friendly address',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

/**
 * Boundary and recovery coverage

 * These stories exercise the edge cases that must remain deterministic and
 * recoverable in production: empty input, whitespace-only input, overlength
 * input, lowercase input, duplicate addresses, and the transition from a
 * failed validation back to a valid address. The invariant is that the user's
 * entered value is never silently dropped and that a recovery story returns
 * the component to a clean, valid state.
 */

export const EmptyBoundary: Story = {
  name: 'Boundary – empty input',
  args: {
    value: '',
  },
}

export const WhitespaceOnly: Story = {
  name: 'Boundary – whitespace only',
  args: {
    value: '   ',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const TooShort: Story = {
  name: 'Boundary – too short',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const TooLong: Story = {
  name: 'Boundary – too long',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2HGBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const Lowercase: Story = {
  name: 'Boundary – lowercase input',
  args: {
    value: 'gbrpyhil2ci3fnq4bxlfmndlfjunpu2hy3zmfshonuceoasw7qc7ox2h',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const NonLeadingG: Story = {
  name: 'Boundary – non-G prefix',
  args: {
    value: 'ABRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const DuplicateAddress: Story = {
  name: 'Boundary – duplicate address',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: 'This address has already been added.',
  },
}

export const RecoveryFromError: Story = {
  name: 'Recovery – error to valid',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

export const RecoveryFromLoading: Story = {
  name: 'Recovery – loading to valid',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    isLoading: false,
  },
}

export const RetryAfterFailure: Story = {
  name: 'Recovery – retry after failure',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: undefined,
  },
}

export const PermissionDenied: Story = {
  name: 'Permission – denied',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    disabled: true,
    error: 'You do not have permission to edit this address.',
  },
}

export const StaleValue: Story = {
  name: 'Stale – value outdated',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: 'This address is out of date. Please re-enter the current address.',
  },
}
